/** @jest-environment node */
import * as Sentry from "@sentry/nextjs";
import { captureApiError } from "@/lib/sentry/capture-api-error";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@altitutor/shared";
import { getRejectedStudyPlanDiagnostics } from "../rejected-study-plan-diagnostics";

const studentId = "ed000000-0000-4000-8000-000000000002";
const taskId = "ed000000-0000-4000-8000-000000000003";
const sectionId = "ed000000-0000-4000-8000-000000000004";
const generationId = "ed000000-0000-4000-8000-000000000005";
const input = { studentId, taskId, sectionId };
const task = {
  id: taskId,
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
        jsonResponse([{ superseded_at: supersededAt }]),
      );
      const context = await getRejectedStudyPlanDiagnostics(
        fixture(fetch),
        input,
      );
      expect(context).toEqual({
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
      });
      const urls = fetch.mock.calls.map(([url]) => new URL(String(url)));
      expect(urls[0].searchParams.get("id")).toBe("eq." + taskId);
      expect(urls[0].searchParams.get("student_id")).toBe("eq." + studentId);
      expect(urls[0].searchParams.get("select")).toBe(
        "id,status,task_type,section_id,generation_id",
      );
      expect(urls[1].searchParams.get("id")).toBe("eq." + generationId);
      expect(urls[1].searchParams.get("student_id")).toBe("eq." + studentId);
      expect(urls[1].searchParams.get("select")).toBe("superseded_at");
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
    expect(context).toEqual({
      observation: "after_insert_failure",
      student_id: studentId,
      task_id: null,
      section_id: null,
      task_lookup: "not_attempted",
    });
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
