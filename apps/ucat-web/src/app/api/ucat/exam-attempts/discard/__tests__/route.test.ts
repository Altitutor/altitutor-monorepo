/** @jest-environment node */

import type { NextRequest } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { discardExamAttempt } from "@/lib/ucat/exam-attempt/service";
import { POST } from "../route";

jest.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: jest.fn(),
}));
jest.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: { from: jest.fn() },
}));
jest.mock("@/lib/ucat/exam-attempt/service", () => ({
  discardExamAttempt: jest.fn(),
}));
jest.mock("@/lib/sentry/capture-api-error", () => ({
  captureApiError: jest.fn(),
}));

const mockServerClient = jest.mocked(getSupabaseServerClient);
const mockDiscardExamAttempt = jest.mocked(discardExamAttempt);

describe("POST /api/ucat/exam-attempts/discard", () => {
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
    expect(mockDiscardExamAttempt).not.toHaveBeenCalled();
  });
});
