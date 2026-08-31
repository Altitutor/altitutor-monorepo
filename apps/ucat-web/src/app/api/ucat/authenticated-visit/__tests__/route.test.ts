/** @jest-environment node */

import { POST } from "@/app/api/ucat/authenticated-visit/route";
import { processPendingPreparationRefreshes } from "@/features/preparation/server/preparation-refresh-worker";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { waitUntil } from "@vercel/functions";

jest.mock("@/lib/sentry/capture-api-error", () => ({
  captureApiError: jest.fn(),
}));
jest.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: jest.fn(),
}));
jest.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: { from: jest.fn() },
}));
jest.mock("@/features/preparation/server/preparation-refresh-worker", () => ({
  processPendingPreparationRefreshes: jest.fn(),
}));
jest.mock("@vercel/functions", () => ({ waitUntil: jest.fn() }));

const mockGetSupabaseServerClient = jest.mocked(getSupabaseServerClient);

describe("authenticated UCAT visit route", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.VERCEL_ENV;
    const maybeSingle = jest.fn().mockResolvedValue({
      data: { id: "student-1" },
      error: null,
    });
    jest.mocked(supabaseAdmin!.from).mockReturnValue({
      select: () => ({
        eq: () => ({ maybeSingle }),
      }),
    } as never);
    jest
      .mocked(processPendingPreparationRefreshes)
      .mockResolvedValue({ claimed: 1, completed: 1, failed: 0 });
  });

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
      planChanged: false,
    });
    expect(rpc).toHaveBeenCalledWith("record_current_ucat_authenticated_visit");
  });

  it("starts its queued refresh outside the production cron environment", async () => {
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
    expect(processPendingPreparationRefreshes).toHaveBeenCalledWith({
      studentId: "student-1",
      limit: 1,
    });
    expect(waitUntil).toHaveBeenCalledWith(expect.any(Promise));
  });

  it("leaves production refreshes to the globally bounded cron worker", async () => {
    process.env.VERCEL_ENV = "production";
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
    expect(processPendingPreparationRefreshes).not.toHaveBeenCalled();
    expect(waitUntil).not.toHaveBeenCalled();
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
