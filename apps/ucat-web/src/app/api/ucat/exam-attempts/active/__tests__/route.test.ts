/** @jest-environment node */

import * as Sentry from "@sentry/nextjs";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { GET } from "../route";

jest.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: jest.fn(),
}));
jest.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: { from: jest.fn(), rpc: jest.fn() },
}));
jest.mock("@sentry/nextjs", () => ({
  captureMessage: jest.fn(),
  captureException: jest.fn(),
  getClient: jest.fn(),
}));

const admin = jest.requireMock("@/lib/supabase/admin").supabaseAdmin as {
  from: jest.Mock;
  rpc: jest.Mock;
};
const durations = { auth: 0, student: 0, slot: 0 };
const calls: string[] = [];

describe("active-attempt discovery timing", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-11-13T00:00:00Z"));
    jest.resetAllMocks();
    calls.length = 0;
    Object.assign(durations, { auth: 0, student: 0, slot: 0 });
    jest.mocked(getSupabaseServerClient).mockResolvedValue({
      auth: {
        getUser: async () => {
          calls.push("auth");
          jest.advanceTimersByTime(durations.auth);
          return { data: { user: { id: "private-user" } }, error: null };
        },
      },
    } as never);
    admin.from.mockReturnValue({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => {
            calls.push("student");
            jest.advanceTimersByTime(durations.student);
            return { data: { id: "private-student" }, error: null };
          },
        }),
      }),
    });
    admin.rpc.mockImplementation(async () => {
      calls.push("slot");
      jest.advanceTimersByTime(durations.slot);
      return { data: [], error: null };
    });
  });

  afterEach(() => jest.useRealTimers());

  it("runs the actual dependent route and slot service without a spontaneous delay", async () => {
    const start = performance.now();
    const response = await GET();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ active: null });
    expect(calls).toEqual(["auth", "student", "slot"]);
    expect(performance.now() - start).toBeLessThan(7660);
    expect(Sentry.captureMessage).not.toHaveBeenCalled();
  });

  it("attributes a controlled slow request to its actual stages without private data", async () => {
    Object.assign(durations, { auth: 1353, student: 3077, slot: 3227 });
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("Server-Timing")).toContain(
      "active_slot;dur=3227",
    );
    expect(Sentry.captureMessage).toHaveBeenCalledWith(
      "Slow UCAT active-attempt discovery",
      expect.objectContaining({
        extra: {
          observed_at: "2026-11-13T00:00:00.000Z",
          total_ms: 7657,
          status: 200,
          stages_ms: {
            server_client: 0,
            auth: 1353,
            student: 3077,
            active_slot: 3227,
            active_resolution: 3227,
          },
        },
      }),
    );
    expect(
      JSON.stringify(jest.mocked(Sentry.captureMessage).mock.calls),
    ).not.toContain("private-");
  });

  it("records failed slot timing without replacing the existing error response", async () => {
    admin.rpc.mockImplementation(async () => {
      jest.advanceTimersByTime(4000);
      throw new Error("private-database-error");
    });
    const response = await GET();
    expect(response.status).toBe(500);
    expect(response.headers.get("Server-Timing")).toContain(
      "active_slot;dur=4000",
    );
    expect(Sentry.captureMessage).toHaveBeenCalledTimes(1);
    const diagnostic = jest.mocked(Sentry.captureMessage).mock.calls[0][1];
    expect(diagnostic).toEqual(
      expect.objectContaining({
        extra: expect.objectContaining({ status: 500 }),
      }),
    );
    expect(JSON.stringify(diagnostic)).not.toContain("private-");
  });

  it("records only reached stages for a slow unauthenticated request", async () => {
    jest.mocked(getSupabaseServerClient).mockResolvedValue({
      auth: {
        getUser: async () => {
          jest.advanceTimersByTime(3000);
          return { data: { user: null }, error: null };
        },
      },
    } as never);
    const response = await GET();
    expect(response.status).toBe(401);
    expect(admin.from).not.toHaveBeenCalled();
    expect(response.headers.get("Server-Timing")).toBe(
      "server_client;dur=0, auth;dur=3000, total;dur=3000",
    );
  });

  it("records initialization exceptions while preserving the thrown value", async () => {
    const error = new Error("private-initialization-error");
    jest.mocked(getSupabaseServerClient).mockImplementation(async () => {
      jest.advanceTimersByTime(3000);
      throw error;
    });
    await expect(GET()).rejects.toBe(error);
    expect(Sentry.captureMessage).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        extra: expect.objectContaining({
          status: 500,
          stages_ms: { server_client: 3000 },
        }),
      }),
    );
  });

  it("does not send a diagnostic below the slow threshold", async () => {
    durations.slot = 2999;
    expect((await GET()).status).toBe(200);
    expect(Sentry.captureMessage).not.toHaveBeenCalled();
  });

  it("preserves a successful response when the telemetry sink throws", async () => {
    durations.slot = 3000;
    jest.mocked(Sentry.captureMessage).mockImplementation(() => {
      throw new Error("sink unavailable");
    });
    const response = await GET();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ active: null });
  });
});
