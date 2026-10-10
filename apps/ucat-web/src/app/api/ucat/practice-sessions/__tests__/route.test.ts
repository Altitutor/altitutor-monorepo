/** @jest-environment node */

import type { NextRequest } from "next/server";
import { captureApiError } from "@/lib/sentry/capture-api-error";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import {
  preparePracticeStems,
  PracticeStemSelectionError,
} from "@/features/practice/server/prepare-practice-stems";
import { POST } from "../route";

jest.mock("@/lib/sentry/capture-api-error", () => ({
  captureApiError: jest.fn(),
}));
jest.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: jest.fn(),
}));
jest.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: { from: jest.fn() },
}));
jest.mock("@/features/practice/server/prepare-practice-stems", () => {
  const actual = jest.requireActual(
    "@/features/practice/server/prepare-practice-stems",
  );
  return { ...actual, preparePracticeStems: jest.fn() };
});

const mockCaptureApiError = jest.mocked(captureApiError);
const mockServerClient = jest.mocked(getSupabaseServerClient);
const mockPreparePracticeStems = jest.mocked(preparePracticeStems);
const userId = "ed000000-0000-4000-8000-000000000001";
const studentId = "ed000000-0000-4000-8000-000000000002";
const taskId = "ed000000-0000-4000-8000-000000000003";
const sectionId = "ed000000-0000-4000-8000-000000000004";
const generationId = "ed000000-0000-4000-8000-000000000005";
const invalidTask = { code: "22023", message: "invalid_study_plan_task" };

function failedInsertFixture(
  outcome: {
    data: { id: string } | null;
    error: { code: string; message: string } | null;
  } = { data: null, error: invalidTask },
) {
  const { supabaseAdmin } = jest.requireMock("@/lib/supabase/admin") as {
    supabaseAdmin: { from: jest.Mock };
  };
  const taskRead = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    abortSignal: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn(async () => ({
      data: {
        id: taskId,
        status: "skipped",
        task_type: "practice",
        section_id: sectionId,
        generation_id: generationId,
        updated_at: "2026-10-10T05:10:31Z",
      },
      error: null,
    })),
  };
  const generationRead = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    abortSignal: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn(async () => ({
      data: { superseded_at: null },
      error: null,
    })),
  };
  supabaseAdmin.from.mockImplementation((table: string) => {
    if (table === "students")
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn(async () => ({
          data: { id: studentId },
          error: null,
        })),
      };
    if (table === "student_practice_sessions")
      return {
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn(async () => outcome),
      };
    if (table === "ucat_student_study_plan_tasks") return taskRead;
    if (table === "ucat_student_study_plan_generations") return generationRead;
    throw new Error("Unexpected table " + table);
  });
  mockPreparePracticeStems.mockResolvedValue({ stems: [] } as never);
  return { taskRead, generationRead, from: supabaseAdmin.from };
}

function rejectedRequest(studyPlanTaskId: string = taskId): NextRequest {
  return {
    json: async () => ({
      sectionKey: "decision_making",
      ucatSectionId: sectionId,
      filtersSnapshot: {
        studyPlanTaskId,
        questionCount: 10,
        privateText: "password=secret cookie=secret email=private@example.test",
      },
    }),
  } as unknown as NextRequest;
}

describe("POST /api/ucat/practice-sessions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockServerClient.mockResolvedValue({
      auth: {
        getUser: jest.fn(async () => ({
          data: { user: { id: userId } },
          error: null,
        })),
      },
    } as never);

    const { supabaseAdmin } = jest.requireMock("@/lib/supabase/admin") as {
      supabaseAdmin: { from: jest.Mock };
    };
    supabaseAdmin.from.mockReturnValue({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          maybeSingle: jest.fn(async () => ({
            data: { id: "student-1" },
            error: null,
          })),
        })),
      })),
    });
  });

  it("captures the submitted planned task and scoped post-failure state on the existing API error", async () => {
    const { taskRead } = failedInsertFixture();
    const response = await POST(rejectedRequest());
    expect(response.status).toBe(500);
    expect(mockCaptureApiError).toHaveBeenCalledTimes(1);
    expect(mockCaptureApiError).toHaveBeenCalledWith(
      invalidTask,
      "/api/ucat/practice-sessions",
      {
        study_plan_start: expect.objectContaining({
          student_id: studentId,
          task_id: taskId,
          section_id: sectionId,
          observation: "after_insert_failure",
          task_lookup: "found",
          task_status: "skipped",
          task_type: "practice",
          generation_id: generationId,
          generation_superseded: false,
        }),
      },
    );
    expect(taskRead.eq).toHaveBeenCalledWith("id", taskId);
    expect(taskRead.eq).toHaveBeenCalledWith("student_id", studentId);
    expect(JSON.stringify(mockCaptureApiError.mock.calls)).not.toContain(
      "private@example.test",
    );
  });

  it("does not add diagnostic reads on successful practice starts", async () => {
    const { from } = failedInsertFixture({
      data: { id: "practice-1" },
      error: null,
    });
    const response = await POST(rejectedRequest());
    expect(response.status).toBe(200);
    expect(mockCaptureApiError).not.toHaveBeenCalled();
    expect(from).not.toHaveBeenCalledWith("ucat_student_study_plan_tasks");
    expect(from).not.toHaveBeenCalledWith(
      "ucat_student_study_plan_generations",
    );
  });

  it("does not add diagnostic reads for unrelated insert errors", async () => {
    const error = { code: "23505", message: "conflict" };
    const { from } = failedInsertFixture({ data: null, error });
    const response = await POST(rejectedRequest());
    expect(response.status).toBe(500);
    expect(mockCaptureApiError).toHaveBeenCalledWith(
      error,
      "/api/ucat/practice-sessions",
      undefined,
    );
    expect(from).not.toHaveBeenCalledWith("ucat_student_study_plan_tasks");
  });

  it("preserves the original rejection if diagnostic state lookup fails", async () => {
    const { taskRead } = failedInsertFixture();
    taskRead.maybeSingle.mockRejectedValueOnce(
      new Error("diagnostic unavailable"),
    );
    const response = await POST(rejectedRequest());
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "invalid_study_plan_task" });
    expect(mockCaptureApiError).toHaveBeenCalledWith(
      invalidTask,
      "/api/ucat/practice-sessions",
      {
        study_plan_start: expect.objectContaining({
          task_id: taskId,
          task_lookup: "failed",
        }),
      },
    );
  });

  it("returns an expected empty-filter result without reporting an exception", async () => {
    mockPreparePracticeStems.mockRejectedValue(
      new PracticeStemSelectionError("No question stems match these filters."),
    );

    const response = await POST({
      json: async () => ({
        sectionKey: "decision_making",
        ucatSectionId: "section-1",
        filtersSnapshot: { questionCount: 10 },
      }),
    } as unknown as NextRequest);

    expect(response.status).toBe(400);
    expect(mockCaptureApiError).not.toHaveBeenCalled();
  });

  it("still reports unexpected preparation failures", async () => {
    const error = new Error("Database unavailable");
    mockPreparePracticeStems.mockRejectedValue(error);

    const response = await POST({
      json: async () => ({
        sectionKey: "decision_making",
        ucatSectionId: "section-1",
        filtersSnapshot: { questionCount: 10 },
      }),
    } as unknown as NextRequest);

    expect(response.status).toBe(500);
    expect(mockCaptureApiError).toHaveBeenCalledWith(
      error,
      "/api/ucat/practice-sessions",
    );
  });
});
