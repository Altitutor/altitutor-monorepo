/** @jest-environment node */
import * as Sentry from "@sentry/nextjs";
import { captureApiError } from "@/lib/sentry/capture-api-error";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@altitutor/shared";
import { getRejectedStudyPlanDiagnostics } from "../rejected-start-diagnostics";

const studentId = "ed000000-0000-4000-8000-000000000002";
const taskId = "ed000000-0000-4000-8000-000000000003";
const sectionId = "ed000000-0000-4000-8000-000000000004";
const generationId = "ed000000-0000-4000-8000-000000000005";
const moduleId = "ed000000-0000-4000-8000-000000000006";
const ownerId = "ed000000-0000-4000-8000-000000000007";
const progressId = "ed000000-0000-4000-8000-000000000008";
const ownerGenerationId = "ed000000-0000-4000-8000-000000000009";
const input = { operation: "practice" as const, studentId, taskId, sectionId };
const task = {
  id: taskId,
  student_id: studentId,
  status: "skipped",
  task_type: "practice",
  section_id: sectionId,
  generation_id: generationId,
};
function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
function fixture(fetch: typeof globalThis.fetch) {
  return createClient<Database>(
    "https://fixture.supabase.test",
    "fixture-service-key",
    {
      global: { fetch },
      auth: { autoRefreshToken: false, persistSession: false },
    },
  );
}

describe("rejected Study-plan diagnostics through the real Supabase SDK", () => {
  afterEach(() => jest.useRealTimers());

  it("does not expose returned task, progress or owner rows outside the submitted Student and module", async () => {
    const foreignStudent = "ff000000-0000-4000-8000-000000000001";
    const foreignTask = "ff000000-0000-4000-8000-000000000002";
    const fetch = jest.fn(
      async (raw: Parameters<typeof globalThis.fetch>[0]) => {
        const url = new URL(String(raw));
        if (url.pathname.endsWith("/ucat_student_study_plan_tasks"))
          return jsonResponse([
            {
              ...task,
              id: foreignTask,
              student_id: foreignStudent,
              generation_id: ownerGenerationId,
              title: "password=private",
            },
          ]);
        return jsonResponse([
          {
            id: progressId,
            student_id: foreignStudent,
            learning_module_id: moduleId,
            study_plan_task_id: foreignTask,
            completion_percent: 100,
          },
        ]);
      },
    );
    const context = await getRejectedStudyPlanDiagnostics(fixture(fetch), {
      operation: "learning",
      studentId,
      taskId,
      moduleId,
    });
    expect(context.task_lookup).toBe("not_found_or_not_owned");
    expect(context.task_owner_matches).toBe(false);
    expect(context.task_identity_matches).toBe(false);
    expect(context.progress_lookup).toBe("not_found_or_not_owned");
    expect(context.generation_id).toBeUndefined();
    expect(context.progress_id).toBeUndefined();
    const serialized = JSON.stringify(context);
    for (const privateValue of [
      foreignStudent,
      foreignTask,
      ownerGenerationId,
      "private",
    ])
      expect(serialized).not.toContain(privateValue);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it.each(["different-student", "different-module"])(
    "does not expose the progress owner's identity after a %s scoped mismatch",
    async (mismatch) => {
      const fetch = jest.fn(
        async (raw: Parameters<typeof globalThis.fetch>[0]) => {
          const url = new URL(String(raw));
          if (url.pathname.endsWith("/ucat_student_learning_module_progress"))
            return jsonResponse([
              {
                id: progressId,
                student_id: studentId,
                learning_module_id: moduleId,
                study_plan_task_id: ownerId,
                completion_percent: 100,
              },
            ]);
          if (url.searchParams.get("id") === "eq." + taskId)
            return jsonResponse([]);
          return jsonResponse([
            {
              ...task,
              id: ownerId,
              student_id:
                mismatch === "different-student"
                  ? "ff000000-0000-4000-8000-000000000001"
                  : studentId,
              learning_module_id:
                mismatch === "different-module" ? sectionId : moduleId,
            },
          ]);
        },
      );
      const context = await getRejectedStudyPlanDiagnostics(fixture(fetch), {
        operation: "learning",
        studentId,
        taskId,
        moduleId,
      });
      expect(context.progress_lookup).toBe("found");
      expect(context.progress_owner_lookup).toBe("not_found_or_not_owned");
      expect(context.progress_owner_task_id).toBeUndefined();
      expect(context.progress_owner_status).toBeUndefined();
      expect(JSON.stringify(context)).not.toContain(ownerId);
      const ownerUrl = new URL(String(fetch.mock.calls[2][0]));
      expect(ownerUrl.searchParams.get("id")).toBe("eq." + ownerId);
      expect(ownerUrl.searchParams.get("student_id")).toBe("eq." + studentId);
    },
  );

  it("drops arbitrary enum/date text while canonicalizing actual row timestamps", async () => {
    const fetch = jest
      .fn()
      .mockResolvedValueOnce(
        jsonResponse([
          {
            ...task,
            status: "password=private",
            task_type: "token=private",
            updated_at: "2026-02-30T08:00:00Z",
            started_at: "2026-10-14T08:00:00.123456+00:00",
            completed_at: "cookie=private",
            skipped_at: "2026-10-14T24:00:00Z",
            title: "email=private@example.test",
          },
        ]),
      )
      .mockResolvedValueOnce(
        jsonResponse([
          {
            id: generationId,
            student_id: studentId,
            generated_at: "password=private",
            superseded_at: null,
          },
        ]),
      );
    const context = await getRejectedStudyPlanDiagnostics(
      fixture(fetch),
      input,
    );
    expect(context.task_status).toBeNull();
    expect(context.task_type).toBeNull();
    expect(context.task_updated_at).toBeNull();
    expect(context.task_completed_at).toBeNull();
    expect(context.task_skipped_at).toBeNull();
    expect(context.task_started_at).toBe("2026-10-14T08:00:00.123Z");
    expect(context.generation_generated_at).toBeNull();
    expect(JSON.stringify(context)).not.toContain("private");
  });

  it("uses one deadline for concurrent Learning reads and their later generation/owner lookups", async () => {
    jest.useFakeTimers();
    const signals: (AbortSignal | null | undefined)[] = [];
    const fetch = jest.fn(
      (
        raw: Parameters<typeof globalThis.fetch>[0],
        init?: Parameters<typeof globalThis.fetch>[1],
      ) => {
        const url = new URL(String(raw));
        signals.push(init?.signal);
        if (url.pathname.endsWith("/ucat_student_learning_module_progress"))
          return new Promise<Response>((resolve) =>
            setTimeout(
              () =>
                resolve(
                  jsonResponse([
                    {
                      id: progressId,
                      student_id: studentId,
                      learning_module_id: moduleId,
                      study_plan_task_id: ownerId,
                      completion_percent: 100,
                    },
                  ]),
                ),
              600,
            ),
          );
        if (
          url.pathname.endsWith("/ucat_student_study_plan_tasks") &&
          url.searchParams.get("id") === "eq." + taskId
        )
          return new Promise<Response>((resolve) =>
            setTimeout(
              () =>
                resolve(
                  jsonResponse([{ ...task, learning_module_id: moduleId }]),
                ),
              600,
            ),
          );
        return new Promise<Response>(() => {});
      },
    );
    const pending = getRejectedStudyPlanDiagnostics(fixture(fetch), {
      operation: "learning",
      studentId,
      taskId,
      moduleId,
    });
    await jest.advanceTimersByTimeAsync(1000);
    const context = await pending;
    expect(context.task_lookup).toBe("found");
    expect(context.generation_lookup).toBe("failed");
    expect(context.progress_lookup).toBe("found");
    expect(context.progress_owner_lookup).toBe("failed");
    expect(context.elapsed_ms).toBe(1000);
    expect(signals).toHaveLength(4);
    expect(signals.every((signal) => signal?.aborted)).toBe(true);
    expect(jest.getTimerCount()).toBe(0);
  });

  it("does not observe a Learning target whose submitted module identity is invalid", async () => {
    const fetch = jest.fn().mockResolvedValue(jsonResponse([task]));
    const context = await getRejectedStudyPlanDiagnostics(fixture(fetch), {
      operation: "learning",
      studentId,
      taskId,
      moduleId: "password=private",
    });
    expect(context.module_id).toBeNull();
    expect(context.task_lookup).toBe("not_attempted");
    expect(context.progress_lookup).toBe("not_attempted");
    expect(fetch).not.toHaveBeenCalled();
    expect(JSON.stringify(context)).not.toContain("private");
  });

  it("observes the requested Learning task and the progress owner's terminal state without transferring ownership", async () => {
    const urls: URL[] = [];
    const fetch = jest.fn(
      async (raw: Parameters<typeof globalThis.fetch>[0]) => {
        const url = new URL(String(raw));
        urls.push(url);
        if (url.pathname.endsWith("/ucat_student_study_plan_tasks")) {
          const id =
            url.searchParams.get("id") === "eq." + ownerId ? ownerId : taskId;
          return jsonResponse([
            {
              ...task,
              id,
              task_type: "learn",
              learning_module_id: moduleId,
              generation_id: id === ownerId ? ownerGenerationId : generationId,
              status: id === ownerId ? "completed" : "planned",
              updated_at: "2026-10-14T08:00:00Z",
            },
          ]);
        }
        if (url.pathname.endsWith("/ucat_student_study_plan_generations")) {
          const id =
            url.searchParams.get("id") === "eq." + ownerGenerationId
              ? ownerGenerationId
              : generationId;
          return jsonResponse([
            {
              id,
              student_id: studentId,
              superseded_at:
                id === ownerGenerationId ? "2026-10-14T07:15:00Z" : null,
              generated_at: "2026-10-14T07:00:00Z",
            },
          ]);
        }
        if (url.pathname.endsWith("/ucat_student_learning_module_progress"))
          return jsonResponse([
            {
              id: progressId,
              student_id: studentId,
              learning_module_id: moduleId,
              study_plan_task_id: ownerId,
              completion_percent: 100,
              started_at: "2026-10-14T07:30:00Z",
              completed_at: "2026-10-14T07:59:00Z",
            },
          ]);
        throw new Error("Unexpected fixture request");
      },
    );
    const context = await getRejectedStudyPlanDiagnostics(fixture(fetch), {
      operation: "learning",
      studentId,
      taskId,
      moduleId,
    });
    expect(context).toEqual(
      expect.objectContaining({
        observation: "after_start_failure",
        operation: "learning",
        module_id: moduleId,
        task_lookup: "found",
        task_status: "planned",
        task_module_matches: true,
        task_owner_matches: true,
        task_identity_matches: true,
        generation_superseded: false,
        task_updated_at: "2026-10-14T08:00:00.000Z",
        generation_generated_at: "2026-10-14T07:00:00.000Z",
        progress_lookup: "found",
        progress_id: progressId,
        progress_fully_completed: true,
        progress_completed_at: "2026-10-14T07:59:00.000Z",
        progress_task_matches_submitted: false,
        progress_owner_lookup: "found",
        progress_owner_task_id: ownerId,
        progress_owner_status: "completed",
        progress_owner_terminal: true,
        progress_owner_generation_id: ownerGenerationId,
        progress_owner_generation_matches_submitted: false,
        progress_owner_generation_lookup: "found",
        progress_owner_generation_superseded: true,
        progress_owner_generation_superseded_at: "2026-10-14T07:15:00.000Z",
        observed_at: expect.any(String),
        elapsed_ms: expect.any(Number),
      }),
    );
    for (const url of urls)
      expect(url.searchParams.get("student_id")).toBe("eq." + studentId);
    const progressUrl = urls.find((url) =>
      url.pathname.endsWith("/ucat_student_learning_module_progress"),
    );
    expect(progressUrl?.searchParams.get("learning_module_id")).toBe(
      "eq." + moduleId,
    );
  });

  it.each([null, "2026-10-10T05:07:05Z"])(
    "captures scoped state and generation supersession (%s)",
    async (supersededAt) => {
      const fetch = jest.fn(
        async (
          _url: Parameters<typeof globalThis.fetch>[0],
          _init?: Parameters<typeof globalThis.fetch>[1],
        ) => jsonResponse([]),
      );
      fetch.mockResolvedValueOnce(jsonResponse([task]));
      fetch.mockResolvedValueOnce(
        jsonResponse([
          {
            id: generationId,
            student_id: studentId,
            superseded_at: supersededAt,
          },
        ]),
      );
      const context = await getRejectedStudyPlanDiagnostics(
        fixture(fetch),
        input,
      );
      expect(context).toEqual(
        expect.objectContaining({
          operation: "practice",
          observed_at: expect.any(String),
          elapsed_ms: expect.any(Number),
          observation: "after_insert_failure",
          student_id: studentId,
          task_id: taskId,
          section_id: sectionId,
          task_lookup: "found",
          task_status: "skipped",
          task_type: "practice",
          task_section_matches: true,
          generation_id: generationId,
          generation_lookup: "found",
          generation_superseded: supersededAt !== null,
        }),
      );
      const urls = fetch.mock.calls.map(([url]) => new URL(String(url)));
      expect(urls[0].searchParams.get("id")).toBe("eq." + taskId);
      expect(urls[0].searchParams.get("student_id")).toBe("eq." + studentId);
      expect(urls[0].searchParams.get("select")).toBe(
        "id,student_id,status,task_type,section_id,learning_module_id,generation_id,updated_at,started_at,completed_at,skipped_at",
      );
      expect(urls[1].searchParams.get("id")).toBe("eq." + generationId);
      expect(urls[1].searchParams.get("student_id")).toBe("eq." + studentId);
      expect(urls[1].searchParams.get("select")).toBe(
        "id,student_id,generated_at,superseded_at",
      );
      expect(fetch).toHaveBeenCalledTimes(2);
    },
  );

  it("does not query another owner's task or generation after a scoped miss", async () => {
    const fetch = jest.fn().mockResolvedValue(jsonResponse([]));
    const context = await getRejectedStudyPlanDiagnostics(
      fixture(fetch),
      input,
    );
    expect(context.task_lookup).toBe("not_found_or_not_owned");
    expect(context.generation_id).toBeUndefined();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("does not copy arbitrary identifiers or database text into metadata", async () => {
    const fetch = jest.fn().mockResolvedValue(jsonResponse([]));
    const secret = "token=private password=private email=private@example.test";
    const context = await getRejectedStudyPlanDiagnostics(fixture(fetch), {
      ...input,
      taskId: secret,
      sectionId: secret,
    });
    expect(context).toEqual(
      expect.objectContaining({
        operation: "practice",
        observed_at: expect.any(String),
        elapsed_ms: expect.any(Number),
        observation: "after_insert_failure",
        student_id: studentId,
        task_id: null,
        section_id: null,
        task_lookup: "not_attempted",
      }),
    );
    expect(JSON.stringify(context)).not.toContain("private");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("marks generation reads failed without capturing their error text", async () => {
    const fetch = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse([task]))
      .mockResolvedValueOnce(jsonResponse({ message: "password=secret" }, 503));
    const context = await getRejectedStudyPlanDiagnostics(
      fixture(fetch),
      input,
    );
    expect(context.task_lookup).toBe("found");
    expect(context.generation_lookup).toBe("failed");
    expect(context.generation_superseded).toBeUndefined();
    expect(JSON.stringify(context)).not.toContain("secret");
  });

  it("bounds even a diagnostic fetch that ignores abort and clears its timer", async () => {
    jest.useFakeTimers();
    const fetch = jest.fn(
      (
        _url: Parameters<typeof globalThis.fetch>[0],
        _init?: Parameters<typeof globalThis.fetch>[1],
      ) => new Promise<Response>(() => {}),
    );
    const pending = getRejectedStudyPlanDiagnostics(fixture(fetch), input);
    await jest.advanceTimersByTimeAsync(1000);
    const context = await pending;
    expect(context.task_lookup).toBe("failed");
    expect(context.task_id).toBe(taskId);
    const signal = fetch.mock.calls[0]?.[1]?.signal;
    expect(signal?.aborted).toBe(true);
    expect(jest.getTimerCount()).toBe(0);
  });
});

describe("diagnostics with production Supabase Sentry instrumentation", () => {
  type Transport = ReturnType<
    NonNullable<Parameters<typeof Sentry.init>[0]["transport"]>
  >;
  const messages: string[] = [];

  beforeAll(() => {
    Sentry.init({
      dsn: "https://fixture@fixture.sentry.test/1",
      defaultIntegrations: false,
      tracesSampleRate: 0,
      transport: () => ({
        send: async (envelope: Parameters<Transport["send"]>[0]) => {
          for (const [header, payload] of envelope[1]) {
            if (header.type === "event") messages.push(JSON.stringify(payload));
          }
          return {};
        },
        flush: async () => true,
      }),
    });
  });
  beforeEach(() => {
    messages.length = 0;
  });
  afterEach(() => jest.useRealTimers());
  afterAll(async () => {
    await Sentry.close();
  });

  function instrumented(fetch: typeof globalThis.fetch) {
    const client = fixture(fetch);
    Sentry.instrumentSupabaseClient(client);
    return client;
  }

  function captureOriginal(
    context: Awaited<ReturnType<typeof getRejectedStudyPlanDiagnostics>>,
  ) {
    captureApiError(
      new Error("invalid_study_plan_task"),
      "/api/ucat/practice-sessions",
      { study_plan_start: context },
    );
  }

  it("keeps Learning owner-generation lookup failures inside diagnostics and enriches only the original capture", async () => {
    const fetch = jest.fn(
      async (raw: Parameters<typeof globalThis.fetch>[0]) => {
        const url = new URL(String(raw));
        if (url.pathname.endsWith("/ucat_student_study_plan_tasks")) {
          const id =
            url.searchParams.get("id") === "eq." + ownerId ? ownerId : taskId;
          return jsonResponse([
            {
              ...task,
              id,
              task_type: "learn",
              learning_module_id: moduleId,
              status: id === ownerId ? "completed" : "planned",
              generation_id: id === ownerId ? ownerGenerationId : generationId,
            },
          ]);
        }
        if (url.pathname.endsWith("/ucat_student_learning_module_progress"))
          return jsonResponse([
            {
              id: progressId,
              student_id: studentId,
              learning_module_id: moduleId,
              study_plan_task_id: ownerId,
              completion_percent: 100,
              completed_at: "2026-10-14T08:00:00Z",
            },
          ]);
        if (url.searchParams.get("id") === "eq." + ownerGenerationId)
          return jsonResponse(
            { code: "503", message: "diagnostic password=fixture-owner-generation-secret-9b82" },
            503,
          );
        return jsonResponse([
          { id: generationId, student_id: studentId, superseded_at: null },
        ]);
      },
    );
    const context = await getRejectedStudyPlanDiagnostics(instrumented(fetch), {
      operation: "learning",
      studentId,
      taskId,
      moduleId,
    });
    expect(context.progress_owner_generation_lookup).toBe("failed");
    expect(context.progress_owner_terminal).toBe(true);
    await Sentry.flush();
    expect(messages).toHaveLength(0);
    captureApiError(
      new Error("invalid_study_plan_learning_task"),
      "/api/ucat/learning-modules/[id]/start",
      { study_plan_start: context },
    );
    await Sentry.flush();
    expect(messages).toHaveLength(1);
    const event = JSON.parse(messages[0]) as {
      extra?: { study_plan_start?: unknown };
    };
    expect(event.extra?.study_plan_start).toEqual(context);
    expect(messages[0]).toContain("invalid_study_plan_learning_task");
    expect(messages[0]).toContain("after_start_failure");
    expect(messages[0]).not.toContain("fixture-owner-generation-secret-9b82");
  });

  it("suppresses only diagnostic 503 reports and preserves the original rejection", async () => {
    const fetch = jest.fn(async () =>
      jsonResponse({ message: "diagnostic password=secret", code: "503" }, 503),
    );
    const context = await getRejectedStudyPlanDiagnostics(
      instrumented(fetch),
      input,
    );
    expect(context.task_lookup).toBe("failed");
    await Sentry.flush();
    expect(messages).toHaveLength(0);
    captureOriginal(context);
    await Sentry.flush();
    expect(messages).toHaveLength(1);
    expect(messages[0]).toContain("invalid_study_plan_task");
    expect(messages[0]).toContain(taskId);
    expect(messages[0]).toContain("after_insert_failure");
    const event = JSON.parse(messages[0]) as {
      extra?: { study_plan_start?: unknown };
    };
    expect(event.extra?.study_plan_start).toEqual(context);
    expect(messages[0]).not.toContain("secret");
  });

  it("suppresses its abort report and preserves the original rejection", async () => {
    jest.useFakeTimers();
    const fetch = jest.fn(
      (
        _url: Parameters<typeof globalThis.fetch>[0],
        init?: Parameters<typeof globalThis.fetch>[1],
      ) =>
        new Promise<Response>((_, reject) => {
          init?.signal?.addEventListener(
            "abort",
            () => {
              reject(
                new DOMException("Diagnostic fetch aborted", "AbortError"),
              );
            },
            { once: true },
          );
        }),
    );
    const pending = getRejectedStudyPlanDiagnostics(instrumented(fetch), input);
    await jest.advanceTimersByTimeAsync(1000);
    const context = await pending;
    expect(context.task_lookup).toBe("failed");
    jest.useRealTimers();
    await Sentry.flush();
    expect(messages).toHaveLength(0);
    captureOriginal(context);
    await Sentry.flush();
    expect(messages).toHaveLength(1);
    expect(messages[0]).toContain("invalid_study_plan_task");
    expect(messages[0]).toContain(taskId);
    expect(messages[0]).toContain("after_insert_failure");
    const event = JSON.parse(messages[0]) as {
      extra?: { study_plan_start?: unknown };
    };
    expect(event.extra?.study_plan_start).toEqual(context);
  });

  it("keeps unrelated concurrent database errors outside the diagnostic scope", async () => {
    let release: (() => void) | undefined;
    const delayed = new Promise<void>((resolve) => {
      release = resolve;
    });
    const diagnosticFetch = jest.fn(async () => {
      await delayed;
      return jsonResponse({ message: "diagnostic failure", code: "503" }, 503);
    });
    const pending = getRejectedStudyPlanDiagnostics(
      instrumented(diagnosticFetch),
      input,
    );
    const unrelatedFetch = jest
      .fn()
      .mockResolvedValue(
        jsonResponse(
          { message: "unrelated database failure", code: "42501" },
          403,
        ),
      );
    await instrumented(unrelatedFetch).from("students").select("id");
    release?.();
    await pending;
    await Sentry.flush();
    expect(messages).toHaveLength(1);
    expect(messages[0]).toContain("unrelated database failure");
    expect(messages[0]).not.toContain("diagnostic failure");
  });
});
