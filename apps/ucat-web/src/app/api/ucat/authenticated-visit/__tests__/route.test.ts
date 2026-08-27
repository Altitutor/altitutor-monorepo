/** @jest-environment node */

import { POST } from "@/app/api/ucat/authenticated-visit/route";
import { getSupabaseServerClient } from "@/lib/supabase/server";

jest.mock("@/lib/sentry/capture-api-error", () => ({
  captureApiError: jest.fn(),
}));
jest.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: jest.fn(),
}));

const mockGetSupabaseServerClient = jest.mocked(getSupabaseServerClient);

describe("authenticated UCAT visit route", () => {
  it("records the visit and exposes pending background maintenance", async () => {
    const rpc = jest.fn().mockResolvedValue({
      data: [{ recorded: true, refresh_pending: true }],
      error: null,
    });
    mockGetSupabaseServerClient.mockResolvedValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: { id: "user-1" } },
          error: null,
        }),
      },
      rpc,
    } as never);

    const response = await POST();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      recorded: true,
      refreshPending: true,
    });
    expect(rpc).toHaveBeenCalledWith("record_current_ucat_authenticated_visit");
  });

  it("rejects an unauthenticated caller", async () => {
    mockGetSupabaseServerClient.mockResolvedValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: null },
          error: null,
        }),
      },
    } as never);

    const response = await POST();

    expect(response.status).toBe(401);
  });
});
