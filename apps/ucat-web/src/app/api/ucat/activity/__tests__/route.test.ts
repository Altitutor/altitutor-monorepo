import { GET } from "@/app/api/ucat/activity/route";
import { captureApiError } from "@/lib/sentry/capture-api-error";
import { getSupabaseServerClient } from "@/lib/supabase/server";

jest.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: jest.fn(),
}));
jest.mock("@/lib/sentry/capture-api-error", () => ({
  captureApiError: jest.fn(),
}));
jest.mock("next/server", () => ({
  NextResponse: {
    json: (
      body: unknown,
      init?: { status?: number; headers?: Record<string, string> },
    ) => ({
      status: init?.status ?? 200,
      headers: new Headers(init?.headers),
      json: async () => body,
    }),
  },
}));

const mockGetSupabaseServerClient = jest.mocked(getSupabaseServerClient);
const mockCaptureApiError = jest.mocked(captureApiError);

describe("GET /api/ucat/activity", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 401 without capturing a missing auth session", async () => {
    mockGetSupabaseServerClient.mockResolvedValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: null },
          error: {
            name: "AuthSessionMissingError",
            message: "Auth session missing!",
          },
        }),
      },
    } as never);

    const response = await GET();

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
    expect(mockCaptureApiError).not.toHaveBeenCalled();
  });
});
