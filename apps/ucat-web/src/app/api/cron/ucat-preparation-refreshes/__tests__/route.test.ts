/** @jest-environment node */

import { NextRequest } from "next/server";
import { GET } from "@/app/api/cron/ucat-preparation-refreshes/route";
import { processPendingPreparationRefreshes } from "@/features/preparation/server/preparation-refresh-worker";
import { supabaseAdmin } from "@/lib/supabase/admin";

jest.mock("server-only", () => ({}));
jest.mock("@sentry/nextjs", () => ({ captureMessage: jest.fn() }));
jest.mock("@/features/preparation/server/preparation-refresh-worker", () => ({
  processPendingPreparationRefreshes: jest.fn(),
}));
jest.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: { rpc: jest.fn() },
}));

describe("UCAT preparation refresh cron", () => {
  it("runs three bounded worker lanes and stops when a lane finds no work", async () => {
    jest
      .mocked(supabaseAdmin!.rpc)
      .mockResolvedValueOnce({
        data: [{ students_processed: 1, tasks_skipped: 2 }],
        error: null,
      } as never)
      .mockResolvedValueOnce({ data: 2, error: null } as never)
      .mockResolvedValueOnce({ data: [], error: null } as never);
    jest
      .mocked(processPendingPreparationRefreshes)
      .mockResolvedValueOnce({ claimed: 1, completed: 1, failed: 0 })
      .mockResolvedValueOnce({ claimed: 1, completed: 0, failed: 1 })
      .mockResolvedValueOnce({ claimed: 0, completed: 0, failed: 0 });

    const response = await GET(
      new NextRequest("http://localhost/api/cron/ucat-preparation-refreshes"),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      rollover: { students_processed: 1, tasks_skipped: 2 },
      scheduled: 2,
      claimed: 2,
      completed: 1,
      failed: 1,
    });
    expect(processPendingPreparationRefreshes).toHaveBeenCalledTimes(3);
    for (let call = 1; call <= 3; call += 1) {
      expect(processPendingPreparationRefreshes).toHaveBeenNthCalledWith(call, {
        limit: 1,
      });
    }
  });
});
