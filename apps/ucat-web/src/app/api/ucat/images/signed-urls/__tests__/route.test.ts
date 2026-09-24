/** @jest-environment node */

import type { NextRequest } from "next/server";
import { captureApiError } from "@/lib/sentry/capture-api-error";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { POST } from "../route";

const mockCreateSignedUrls = jest.fn();

jest.mock("@/lib/sentry/capture-api-error", () => ({
  captureApiError: jest.fn(),
}));
jest.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: jest.fn(),
}));
jest.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: {
    from: jest.fn(),
    storage: {
      from: jest.fn(() => ({
        createSignedUrls: mockCreateSignedUrls,
      })),
    },
  },
}));

const mockCaptureApiError = jest.mocked(captureApiError);
const mockServerClient = jest.mocked(getSupabaseServerClient);

describe("POST /api/ucat/images/signed-urls", () => {
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

  it("returns a missing storage object as an expected 404 without reporting it", async () => {
    mockCreateSignedUrls.mockResolvedValue({
      data: [
        {
          error: "Object not found",
          path: "question-images/missing.png",
          signedUrl: null,
        },
      ],
      error: null,
    });

    const response = await POST({
      json: async () => ({ paths: ["question-images/missing.png"] }),
    } as unknown as NextRequest);

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: "Object not found",
      path: "question-images/missing.png",
    });
    expect(mockCreateSignedUrls).toHaveBeenCalledWith(
      ["question-images/missing.png"],
      86400,
    );
    expect(mockCaptureApiError).not.toHaveBeenCalled();
  });
});
