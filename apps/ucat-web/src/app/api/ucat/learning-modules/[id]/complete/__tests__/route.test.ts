/** @jest-environment node */

import type { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database, Json } from "@altitutor/shared";
import { requireStudentAdminClient } from "@/lib/ucat/skill-trainer/api-auth";
import { captureApiError } from "@/lib/sentry/capture-api-error";
import { POST } from "../route";

jest.mock("@/lib/ucat/skill-trainer/api-auth", () => ({
  requireStudentAdminClient: jest.fn(),
}));
jest.mock("@/lib/sentry/capture-api-error", () => ({ captureApiError: jest.fn() }));
jest.mock("@/lib/analytics/posthog-server", () => ({
  captureUcatLearningActivityCompletedInBackground: jest.fn(),
}));
jest.mock("@/features/preparation/server/preparation-refresh-worker", () => ({
  processPendingPreparationRefreshes: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("@vercel/functions", () => ({ waitUntil: jest.fn() }));

const studentId = "ed000000-0000-4000-8000-000000000001";
const lessonId = "ed000000-0000-4000-8000-000000000002";
const blockId = "ed000000-0000-4000-8000-000000000003";

type Progress = {
  interaction_state: Json;
  completed_at: string | null;
  manually_completed: boolean;
};

function fixture(writeError = false) {
  let progress: Progress | null = null;
  let lessonCompletion = 0;
  const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
    status, headers: { "Content-Type": "application/json" },
  });
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    const table = url.pathname.split("/").at(-1);
    const method = init?.method ?? "GET";
    if (table === "ucat_learning_module_blocks") return json([{ id: blockId }]);
    if (table === "ucat_student_learning_module_progress") {
      if (method === "POST") {
        lessonCompletion = JSON.parse(String(init?.body)).completion_percent;
      }
      return json([]);
    }
    if (method === "HEAD") {
      return new Response(null, {
        headers: { "Content-Range": `0-0/${progress?.completed_at ? 1 : 0}` },
      });
    }
    if (table === "ucat_student_learning_module_block_progress" && method === "GET") {
      return json(progress ? [{ id: "progress-1" }] : []);
    }
    if (method === "POST") {
      if (writeError) return json({ code: "42501", message: "write denied" }, 403);
      // The automatic PATCH commits after the manual request's read, before its write.
      progress ??= {
        interaction_state: { answer: "A" }, completed_at: null, manually_completed: false,
      };
      if (table === "ucat_student_learning_module_block_progress") {
        return json({ code: "23505", message: "duplicate key value violates unique constraint" }, 409);
      }
      if (table === "upsert_ucat_learning_module_block_progress") {
        const body = JSON.parse(String(init?.body));
        progress = {
          interaction_state: body.p_interaction_state ?? progress.interaction_state,
          completed_at: body.p_completed ? "2026-10-31T00:00:00Z" : progress.completed_at,
          manually_completed: body.p_manually_completed ?? progress.manually_completed,
        };
        return new Response(null, { status: 204 });
      }
    }
    throw new Error(`Unexpected fixture request: ${method} ${url.pathname}`);
  };
  const admin = createClient<Database>("https://fixture.supabase.test", "fixture-service-key", {
    global: { fetch }, auth: { persistSession: false, autoRefreshToken: false },
  });
  jest.mocked(requireStudentAdminClient).mockResolvedValue({
    ok: true, studentId, userId: studentId, timezone: "Australia/Adelaide", admin,
  });
  return { progress: () => progress, lessonCompletion: () => lessonCompletion };
}

describe("POST lesson completion", () => {
  beforeEach(() => jest.clearAllMocks());

  it("completes when automatic progress creates the same block and retains its answer", async () => {
    const state = fixture();
    const response = await POST({} as NextRequest, { params: Promise.resolve({ id: lessonId }) });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(state.progress()).toEqual({
      interaction_state: { answer: "A" },
      completed_at: expect.any(String),
      manually_completed: true,
    });
    expect(state.lessonCompletion()).toBe(100);
    expect(captureApiError).not.toHaveBeenCalled();
  });

  it("continues to report an actual progress write failure", async () => {
    fixture(true);
    const response = await POST({} as NextRequest, { params: Promise.resolve({ id: lessonId }) });
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "write denied" });
    expect(captureApiError).toHaveBeenCalledWith(expect.any(Error), "/api/ucat/learning-modules/[id]/complete");
  });
});
