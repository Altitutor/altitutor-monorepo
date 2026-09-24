/** @jest-environment node */

import type { NextRequest } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { finalizeExamAttemptOnServer } from "@/lib/ucat/exam-attempt/finalize-attempt";
import { POST } from "../route";

jest.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: jest.fn(),
}));
jest.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: { from: jest.fn() },
}));
jest.mock("@/lib/ucat/exam-attempt/finalize-attempt", () => ({
  finalizeExamAttemptOnServer: jest.fn(),
}));
jest.mock("@/lib/analytics/posthog-server", () => ({
  captureUcatLearningActivityCompletedInBackground: jest.fn(),
}));
jest.mock("@/lib/ucat/practice-day-discount", () => ({
  maybeGrantPracticeDayDiscount: jest.fn(),
}));
jest.mock("@/features/preparation/server/preparation-refresh-worker", () => ({
  processPendingPreparationRefreshes: jest.fn(),
}));
jest.mock("@vercel/functions", () => ({ waitUntil: jest.fn() }));
jest.mock("@/lib/sentry/capture-api-error", () => ({
  captureApiError: jest.fn(),
}));

const mockServerClient = jest.mocked(getSupabaseServerClient);
const mockFinalize = jest.mocked(finalizeExamAttemptOnServer);

describe("POST /api/ucat/exam-attempts/finalize", () => {
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
  });

  it("rejects an unsupported attempt kind before writing", async () => {
    const response = await POST({
      json: async () => ({
        kind: "unknown",
        attemptId: "attempt-1",
        complete: true,
        answers: [],
      }),
    } as unknown as NextRequest);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Invalid attempt kind",
    });
    expect(mockFinalize).not.toHaveBeenCalled();
  });

  it("returns a client error for malformed JSON", async () => {
    const response = await POST({
      json: async () => {
        throw new SyntaxError("Malformed JSON");
      },
    } as unknown as NextRequest);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Invalid request body",
    });
    expect(mockFinalize).not.toHaveBeenCalled();
  });
});
