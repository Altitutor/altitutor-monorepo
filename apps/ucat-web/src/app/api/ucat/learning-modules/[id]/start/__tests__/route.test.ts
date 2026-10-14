/** @jest-environment node */

import type { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@altitutor/shared";
import { captureApiError } from "@/lib/sentry/capture-api-error";
import { requireStudentAdminClient } from "@/lib/ucat/skill-trainer/api-auth";
import { checkQuotaForAction } from "@/lib/ucat/quota/quota-service";
import { POST } from "../route";

jest.mock("@/lib/sentry/capture-api-error", () => ({
  captureApiError: jest.fn(),
}));
jest.mock("@/lib/ucat/skill-trainer/api-auth", () => ({
  requireStudentAdminClient: jest.fn(),
}));
jest.mock("@/lib/ucat/quota/quota-service", () => ({
  checkQuotaForAction: jest.fn(),
  quotaExceededResponse: jest.fn(),
}));

const studentId = "ed000000-0000-4000-8000-000000000002";
const taskId = "ed000000-0000-4000-8000-000000000003";
const moduleId = "ed000000-0000-4000-8000-000000000004";
const mockCapture = jest.mocked(captureApiError);

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function fixture(rpcCode: string | null = "22023", succeeds = false) {
  const fetch = jest.fn(async (url: Parameters<typeof globalThis.fetch>[0]) => {
    const path = new URL(String(url)).pathname;
    if (path.endsWith("/ucat_learning_modules"))
      return json([{ id: moduleId, kind: "lesson" }]);
    if (path.endsWith("/rpc/start_ucat_learning_module"))
      return succeeds
        ? json({ status: "started", created: false })
        : json(
            { code: rpcCode, message: "invalid_study_plan_learning_task" },
            400,
          );
    return json([]);
  });
  const admin = createClient<Database>(
    "https://fixture.supabase.test",
    "fixture-service-key",
    {
      global: { fetch },
      auth: { autoRefreshToken: false, persistSession: false },
    },
  );
  jest
    .mocked(requireStudentAdminClient)
    .mockResolvedValue({
      ok: true,
      studentId,
      userId: studentId,
      timezone: "Australia/Adelaide",
      admin,
    });
  jest.mocked(checkQuotaForAction).mockResolvedValue({ allowed: true });
  return fetch;
}

describe("POST learning-module start diagnostics", () => {
  beforeEach(() => jest.clearAllMocks());

  it("adds no diagnostic reads or captures when lesson start succeeds", async () => {
    const fetch = fixture("22023", true);
    const response = await POST(
      { json: async () => ({ studyPlanTaskId: taskId }) } as NextRequest,
      { params: Promise.resolve({ id: moduleId }) },
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ created: false });
    expect(mockCapture).not.toHaveBeenCalled();
    expect(
      fetch.mock.calls.map(([url]) => new URL(String(url)).pathname),
    ).toEqual([
      "/rest/v1/ucat_learning_modules",
      "/rest/v1/rpc/start_ucat_learning_module",
    ]);
  });

  it.each(["42501", null])(
    "does not diagnose the same error text with a different or missing SQLSTATE (%s)",
    async (code) => {
      const fetch = fixture(code);
      const response = await POST(
        { json: async () => ({ studyPlanTaskId: taskId }) } as NextRequest,
        { params: Promise.resolve({ id: moduleId }) },
      );
      expect(response.status).toBe(500);
      expect(await response.json()).toEqual({
        error: "invalid_study_plan_learning_task",
      });
      expect(mockCapture).toHaveBeenCalledWith(
        code ? expect.objectContaining({ code }) : expect.any(Error),
        "/api/ucat/learning-modules/[id]/start",
        undefined,
      );
      expect(
        fetch.mock.calls.map(([url]) => new URL(String(url)).pathname),
      ).toEqual([
        "/rest/v1/ucat_learning_modules",
        "/rest/v1/rpc/start_ucat_learning_module",
      ]);
    },
  );

  it("enriches the existing exact rejection with submitted task and module identity", async () => {
    fixture();
    const response = await POST(
      {
        json: async () => ({
          studyPlanTaskId: taskId,
          privateText: "password=private",
        }),
      } as NextRequest,
      { params: Promise.resolve({ id: moduleId }) },
    );
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: "invalid_study_plan_learning_task",
    });
    expect(mockCapture).toHaveBeenCalledTimes(1);
    expect(mockCapture).toHaveBeenCalledWith(
      expect.any(Error),
      "/api/ucat/learning-modules/[id]/start",
      {
        study_plan_start: expect.objectContaining({
          observation: "after_start_failure",
          operation: "learning",
          student_id: studentId,
          task_id: taskId,
          module_id: moduleId,
          observed_at: expect.any(String),
          elapsed_ms: expect.any(Number),
        }),
      },
    );
    expect(JSON.stringify(mockCapture.mock.calls)).not.toContain("private");
  });
});
