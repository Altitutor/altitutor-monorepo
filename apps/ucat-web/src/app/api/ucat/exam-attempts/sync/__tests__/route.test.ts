/** @jest-environment node */

import type { NextRequest } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { syncExamAttempt } from "@/lib/ucat/exam-attempt/service";
import { captureApiError } from "@/lib/sentry/capture-api-error";
import { PracticeSessionEndedError } from "@/lib/ucat/practice-sessions/practice-session-ended";
import { PATCH } from "../route";

jest.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: jest.fn(),
}));
jest.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: { from: jest.fn() },
}));
jest.mock("@/lib/ucat/exam-attempt/service", () => ({
  ...jest.requireActual("@/lib/ucat/exam-attempt/service"),
  syncExamAttempt: jest.fn(),
}));
jest.mock("@/lib/sentry/capture-api-error", () => ({
  captureApiError: jest.fn(),
}));

const mockServerClient = jest.mocked(getSupabaseServerClient);
const mockSyncExamAttempt = jest.mocked(syncExamAttempt);
const mockCaptureApiError = jest.mocked(captureApiError);

describe("PATCH /api/ucat/exam-attempts/sync", () => {
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

  it("returns an expected terminal response when the practice session is no longer active", async () => {
    mockSyncExamAttempt.mockRejectedValue(new PracticeSessionEndedError());

    const response = await PATCH({
      json: async () => ({
        kind: "practice",
        attemptId: "practice-session-1",
        engineSnapshot: {},
        currentSegmentEndsAt: null,
      }),
    } as unknown as NextRequest);

    expect(response.status).toBe(410);
    await expect(response.json()).resolves.toEqual({
      code: "PRACTICE_SESSION_ENDED",
      error: "This practice session has ended",
    });
    expect(mockCaptureApiError).not.toHaveBeenCalled();
  });
});
