/** @jest-environment node */
import * as Sentry from "@sentry/nextjs";
import { createClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";
import type { Database } from "@altitutor/shared";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { POST as practiceStart } from "@/app/api/ucat/practice-sessions/route";

import { POST as learningStart } from "@/app/api/ucat/learning-modules/[id]/start/route";

jest.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: jest.fn(),
}));
jest.mock("@/lib/supabase/admin", () => ({ supabaseAdmin: null }));
const studentId = "ed000000-0000-4000-8000-000000000002";
const taskId = "ed000000-0000-4000-8000-000000000003";
const sectionId = "ed000000-0000-4000-8000-000000000004";
const moduleId = "ed000000-0000-4000-8000-000000000006";
const generationId = "ed000000-0000-4000-8000-000000000005";
const events: Sentry.Event[] = [];
const inserts: Record<string, unknown>[] = [];
let outcome = "22023";
const launch = () => ({
  version: 1,
  captured_at_ms: Date.now(),
  surface: "study-plan",
  control: "task-list",
  launch_action: "start",
  task_status: "planned",
  task_type: "practice",
  plan_age_ms: 120000,
  visibility: "hidden",
  focused: false,
  recent_action: "skip",
  recent_action_age_ms: 1000,
});
function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
type Envelope = Parameters<
  ReturnType<
    NonNullable<Parameters<typeof Sentry.init>[0]["transport"]>
  >["send"]
>[0];
beforeAll(() => {
  Sentry.init({
    dsn: "https://public@sentry.invalid/1",
    defaultIntegrations: false,
    transport: () => ({
      send: async (envelope: Envelope) => {
        for (const [header, payload] of envelope[1])
          if (header.type === "event") events.push(payload as Sentry.Event);
        return {};
      },
      flush: async () => true,
    }),
  });
});
afterAll(async () => {
  await Sentry.close();
});
beforeEach(() => {
  outcome = "22023";
  events.length = 0;
  inserts.length = 0;
  const fetch: typeof globalThis.fetch = async (raw, init) => {
    const url = new URL(String(raw));
    if (url.pathname.endsWith("/student_practice_sessions")) {
      inserts.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
      return outcome === "success"
        ? json([{ id: taskId }])
        : json(
            {
              code: outcome,
              message:
                outcome === "22023" ? "invalid_study_plan_task" : "unrelated",
            },
            400,
          );
    }
    if (url.pathname.endsWith("/ucat_learning_modules"))
      return json([{ id: moduleId, kind: "lesson" }]);
    if (url.pathname.endsWith("/rpc/start_ucat_learning_module"))
      return outcome === "success"
        ? json({ status: "started", created: false })
        : json(
            {
              code: outcome,
              message:
                outcome === "22023"
                  ? "invalid_study_plan_learning_task"
                  : "unrelated",
            },
            400,
          );
    if (url.pathname.endsWith("/ucat_student_learning_module_progress"))
      return json([]);
    if (url.pathname.endsWith("/students")) return json([{ id: studentId }]);
    if (url.pathname.includes("/rpc/")) return json(null);
    if (url.pathname.endsWith("/ucat_student_study_plan_tasks"))
      return json([
        {
          id: taskId,
          student_id: studentId,
          status: "skipped",
          task_type: "practice",
          section_id: sectionId,
          generation_id: generationId,
        },
      ]);
    if (url.pathname.endsWith("/ucat_student_study_plan_generations"))
      return json([
        { id: generationId, student_id: studentId, superseded_at: null },
      ]);
    throw new Error("Unexpected fixture path: " + url.pathname);
  };
  const admin = createClient<Database>(
    "https://fixture.supabase.test",
    "fixture-service-key",
    {
      global: { fetch },
      auth: { autoRefreshToken: false, persistSession: false },
    },
  );
  Sentry.instrumentSupabaseClient(admin);
  (
    jest.requireMock("@/lib/supabase/admin") as { supabaseAdmin: unknown }
  ).supabaseAdmin = admin;
  jest.mocked(getSupabaseServerClient).mockResolvedValue({
    auth: {
      getUser: async () => ({
        data: { user: { id: studentId } },
        error: null,
      }),
    },
  } as never);
});
async function run(metadata: unknown = launch()) {
  const response = await practiceStart(
    new NextRequest("https://ucat.example.test/api/ucat/practice-sessions", {
      method: "POST",
      body: JSON.stringify({
        sectionKey: "verbal_reasoning",
        ucatSectionId: sectionId,
        filtersSnapshot: { studyPlanTaskId: taskId, questionCount: 10 },
        stemsSnapshot: [],
        studyPlanLaunch: metadata,
      }),
    }),
  );
  await Sentry.flush(2000);
  return response;
}
it("joins stale client observations to the existing server rejection without persisting diagnostic metadata", async () => {
  const metadata = launch();
  const response = await run({
    ...metadata,
    password: "DO-NOT-COPY",
    url: "https://private.test/?token=DO-NOT-COPY",
  });
  expect(response.status).toBe(500);
  expect(await response.json()).toEqual({ error: "invalid_study_plan_task" });
  const handled = events.filter(
    (event) => event.tags?.["api.handled"] === "true",
  );
  expect(handled).toHaveLength(1);
  expect(handled[0].extra?.study_plan_launch).toEqual(metadata);
  expect(handled[0].extra?.study_plan_start).toEqual(
    expect.objectContaining({ task_status: "skipped" }),
  );
  expect(JSON.stringify(handled)).not.toContain("DO-NOT-COPY");
  expect(JSON.stringify(inserts)).not.toContain("studyPlanLaunch");
  expect(JSON.stringify(inserts)).not.toContain("plan_age_ms");
});

async function runLesson(
  metadata: unknown = { ...launch(), task_type: "learn" },
) {
  const response = await learningStart(
    new NextRequest(
      "https://ucat.example.test/api/ucat/learning-modules/" +
        moduleId +
        "/start",
      {
        method: "POST",
        body: JSON.stringify({
          studyPlanTaskId: taskId,
          studyPlanLaunch: metadata,
        }),
      },
    ),
    { params: Promise.resolve({ id: moduleId }) },
  );
  await Sentry.flush(2000);
  return response;
}
it("enriches the existing Learning rejection with its submitted launch snapshot", async () => {
  const metadata = { ...launch(), task_type: "learn" };
  const response = await runLesson(metadata);
  expect(response.status).toBe(500);
  const handled = events.filter(
    (event) => event.tags?.["api.handled"] === "true",
  );
  expect(handled).toHaveLength(1);
  expect(handled[0].extra?.study_plan_launch).toEqual(metadata);
});

it.each([
  ["missing", null],
  ["unknown-control", { ...launch(), control: "PRIVATE" }],
  ["expired", { ...launch(), captured_at_ms: Date.now() - 300001 }],
  ["future", { ...launch(), captured_at_ms: Date.now() + 60000 }],
  ["wrong-type", { ...launch(), task_type: "learn" }],
  ["unknown-status", { ...launch(), task_status: "password=PRIVATE" }],
  ["arbitrary-surface", { ...launch(), surface: "/private?token=PRIVATE" }],
  ["invalid-age", { ...launch(), plan_age_ms: -1 }],
  ["oversized-age", { ...launch(), plan_age_ms: 604800001 }],
  ["array", [launch()]],
])(
  "omits %s client observations while preserving the original rejection",
  async (_name, metadata) => {
    const response = await run(metadata);
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "invalid_study_plan_task" });
    const handled = events.filter(
      (event) => event.tags?.["api.handled"] === "true",
    );
    expect(handled).toHaveLength(1);
    expect(handled[0].extra?.study_plan_launch).toBeUndefined();
    expect(JSON.stringify(handled)).not.toContain("PRIVATE");
  },
);
it.each(["success", "42501"])(
  "does not attach launch observations for %s outcomes",
  async (code) => {
    outcome = code;
    const response = await run();
    expect(response.status).toBe(code === "success" ? 200 : 500);
    expect(
      events.every((event) => event.extra?.study_plan_launch === undefined),
    ).toBe(true);
    events.length = 0;
    const lessonResponse = await runLesson();
    expect(lessonResponse.status).toBe(code === "success" ? 200 : 500);
    expect(
      events.every((event) => event.extra?.study_plan_launch === undefined),
    ).toBe(true);
  },
);
it("discards untrusted recent-action fields without losing the valid launch snapshot", async () => {
  const metadata = launch();
  await run({
    ...metadata,
    recent_action: "private action",
    recent_action_age_ms: -1,
  });
  const expected: Record<string, unknown> = { ...metadata };
  delete expected.recent_action;
  delete expected.recent_action_age_ms;
  expect(
    events.find((event) => event.tags?.["api.handled"] === "true")?.extra
      ?.study_plan_launch,
  ).toEqual(expected);
});
