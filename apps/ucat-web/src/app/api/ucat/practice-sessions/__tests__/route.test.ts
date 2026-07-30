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

describe("POST /api/ucat/practice-sessions", () => {
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
