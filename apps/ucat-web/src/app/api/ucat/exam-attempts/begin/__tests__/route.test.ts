/** @jest-environment node */

import type { NextRequest } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import {
  beginExamAttempt,
  getActiveExamAttempt,
} from "@/lib/ucat/exam-attempt/service";
import type { ActiveExamAttempt } from "@/lib/ucat/exam-attempt/types";
import { POST } from "../route";

jest.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: jest.fn(),
}));
jest.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: { from: jest.fn() },
}));
jest.mock("@/lib/ucat/exam-attempt/service", () => ({
  beginExamAttempt: jest.fn(),
  getActiveExamAttempt: jest.fn(),
}));
jest.mock("@/lib/sentry/capture-api-error", () => ({
  captureApiError: jest.fn(),
}));

const mockServerClient = jest.mocked(getSupabaseServerClient);
const mockBeginExamAttempt = jest.mocked(beginExamAttempt);
const mockGetActiveExamAttempt = jest.mocked(getActiveExamAttempt);

const activeAttempt = {
  kind: "set",
  attemptId: "attempt-1",
  resourceId: "set-1",
  label: "Set 1",
  resumeHref: "/question-set/set-1",
  resultsHref: "/progress/question-sets/attempt-1",
  currentSegmentEndsAt: null,
  engineSnapshot: {},
  mockAttemptId: null,
  setAttemptIdsBySetId: { "set-1": "attempt-1" },
  practiceSessionId: null,
  wasTimed: false,
} as unknown as ActiveExamAttempt;

describe("POST /api/ucat/exam-attempts/begin", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockServerClient.mockResolvedValue({
      auth: {
        getUser: jest.fn(async () => ({
          data: { user: { id: "user-1" } },
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

  it("turns a concurrent begin for the same resource into an idempotent resume", async () => {
    mockBeginExamAttempt.mockRejectedValue(
      new Error("EXAM_ATTEMPT_IN_PROGRESS"),
    );
    mockGetActiveExamAttempt.mockResolvedValue(activeAttempt);

    const response = await POST({
      json: async () => ({
        kind: "set",
        resourceId: "set-1",
        wasTimed: false,
        engineSnapshot: {},
        segmentTimeLimitSeconds: null,
        examMeta: { sourceType: "set", sourceId: "set-1" },
      }),
    } as unknown as NextRequest);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      attempt: activeAttempt,
      resumed: true,
    });
  });

  it("preserves a conflict when another resource owns the active slot", async () => {
    mockBeginExamAttempt.mockRejectedValue(
      new Error("EXAM_ATTEMPT_IN_PROGRESS"),
    );
    mockGetActiveExamAttempt.mockResolvedValue({
      ...activeAttempt,
      resourceId: "set-2",
    });

    const response = await POST({
      json: async () => ({
        kind: "set",
        resourceId: "set-1",
        wasTimed: false,
        engineSnapshot: {},
        segmentTimeLimitSeconds: null,
        examMeta: { sourceType: "set", sourceId: "set-1" },
      }),
    } as unknown as NextRequest);

    expect(response.status).toBe(409);
  });
});
