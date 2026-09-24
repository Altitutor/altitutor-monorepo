/** @jest-environment node */

import type { NextRequest } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { persistQuestionAttemptBatch } from "@/lib/ucat/question-attempts/persist-question-attempt-batch";
import { POST } from "../route";

jest.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: jest.fn(),
}));
jest.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: { from: jest.fn() },
}));
jest.mock(
  "@/lib/ucat/question-attempts/persist-question-attempt-batch",
  () => ({
    persistQuestionAttemptBatch: jest.fn(),
  }),
);
jest.mock("@/lib/ucat/learning/progress-service", () => ({
  maybeAutoCompleteQuestionBlock: jest.fn(),
}));
jest.mock("@/lib/analytics/posthog-server", () => ({
  captureUcatLearningActivityCompletedInBackground: jest.fn(),
}));
jest.mock("@/lib/sentry/capture-api-error", () => ({
  captureApiError: jest.fn(),
}));

const mockServerClient = jest.mocked(getSupabaseServerClient);
const mockPersistBatch = jest.mocked(persistQuestionAttemptBatch);

describe("POST /api/ucat/question-attempts/batch", () => {
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

  it("returns a client error for malformed JSON without attempting a write", async () => {
    const response = await POST({
      json: async () => {
        throw new SyntaxError("Malformed JSON");
      },
    } as unknown as NextRequest);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Invalid request body",
    });
    expect(mockPersistBatch).not.toHaveBeenCalled();
  });
});
