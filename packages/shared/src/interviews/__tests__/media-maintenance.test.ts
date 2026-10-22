import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../supabase/generated";
import { reconcileInterviewMedia } from "../server/maintenance";

describe("independent interview recovery jobs", () => {
  it("backs off a failed room shutdown and still recovers the next round", async () => {
    const jobs = [
      { round_id: "broken", revision: 1, lease_token: "lease1" },
      { round_id: "healthy", revision: 1, lease_token: "lease2" },
    ];
    const rpc = jest.fn(async (name: string) => {
      if (name === "interview_claim_media_job")
        return { data: jobs.shift() ? [claimed.shift()] : [], error: null };
      if (name === "interview_media_state")
        return {
          data: {
            id: currentRound,
            phase: "waiting",
            progress: [],
            recordings: [],
          },
          error: null,
        };
      return { data: null, error: null };
    });
    const claimed = [...jobs];
    let currentRound = "";
    const originalRpc = rpc.getMockImplementation()!;
    rpc.mockImplementation(async (name: string, ...args: unknown[]) => {
      if (name === "interview_media_state")
        currentRound = (args[0] as { p_round_id: string }).p_round_id;
      return originalRpc(name);
    });
    const client = {
      rpc,
      from: () => ({
        select: () => ({
          eq: async (_key: string, id: string) => ({
            data:
              id === "broken"
                ? [
                    {
                      id: "session",
                      round_id: "broken",
                      attempt_id: "attempt",
                      phase_key: "old",
                      room_name: "broken-room",
                      room_url: "https://example.daily.co/broken-room",
                      expires_at: "2099-01-01",
                      closed_at: null,
                      recording_enabled: false,
                      recording_requested_at: null,
                      recording_error: null,
                      kind: "video",
                      recording_active: false,
                    },
                  ]
                : [],
            error: null,
          }),
        }),
      }),
    } as unknown as SupabaseClient<Database>;
    const request = jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("{}", { status: 503 }));
    try {
      await expect(reconcileInterviewMedia(client, "key")).resolves.toBe(1);
      expect(rpc).toHaveBeenCalledWith(
        "interview_complete_media_job",
        expect.objectContaining({ p_round_id: "broken", p_delay_seconds: 300 }),
      );
      expect(rpc).toHaveBeenCalledWith(
        "interview_complete_media_job",
        expect.objectContaining({ p_round_id: "healthy" }),
      );
    } finally {
      request.mockRestore();
    }
  });
});

import {
  expireInterviewRecordings,
  maintainInterviewMedia,
  type InterviewMaintenanceFailure,
} from "../server/maintenance";

type ExpiringRecording = {
  id: string;
  provider_id: string;
  storage_path: string | null;
  kind: "audio" | "video";
};
function expiryClient(rows: ExpiringRecording[], events: string[] = []) {
  const updated: Array<{ id: string; patch: unknown }> = [];
  const query: Record<string, unknown> = {};
  for (const method of ["select", "lte", "neq", "limit", "order"])
    query[method] = () => query;
  query.then = (resolve: (value: unknown) => void) => {
    events.push("expiry");
    resolve({ data: rows, error: null });
  };
  const rpc = jest.fn(async () => {
    events.push("reconcile");
    return { data: [], error: null };
  });
  const remove = jest.fn(async () => ({ error: null }));
  const client = {
    rpc,
    from: () => ({
      ...query,
      update: (patch: unknown) => ({
        eq: async (_key: string, id: string) => {
          updated.push({ id, patch });
          return { error: null };
        },
      }),
    }),
    storage: { from: () => ({ remove }) },
  } as unknown as SupabaseClient<Database>;
  return { client, updated, remove };
}

describe("recording expiry does not starve interview recovery", () => {
  it("expires an audio capture anchor locally without making a Daily deletion request", async () => {
    const { client, updated } = expiryClient([
      {
        id: "anchor",
        provider_id: "audio-capture:station-capture",
        storage_path: null,
        kind: "audio",
      },
    ]);
    const request = jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("{}", { status: 503 }));
    try {
      await expect(expireInterviewRecordings(client, "key")).resolves.toBe(1);
      expect(request).not.toHaveBeenCalled();
      expect(updated).toContainEqual({
        id: "anchor",
        patch: expect.objectContaining({ state: "expired" }),
      });
    } finally {
      request.mockRestore();
    }
  });
  it("retains a failed deletion for later retry but still expires the next recording", async () => {
    const { client, updated } = expiryClient([
      {
        id: "bad",
        provider_id: "daily-bad",
        storage_path: null,
        kind: "video",
      },
      {
        id: "good",
        provider_id: "daily-good",
        storage_path: null,
        kind: "video",
      },
    ]);
    const failures: InterviewMaintenanceFailure[] = [];
    const request = jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("{}", { status: 503 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    try {
      expect(
        await expireInterviewRecordings(client, "key", {
          onFailure: (failure) => failures.push(failure),
        }),
      ).toBe(1);
      expect(updated).toContainEqual({
        id: "bad",
        patch: expect.objectContaining({
          expiry_error: expect.any(String),
          expiry_retry_at: expect.any(String),
        }),
      });
      expect(updated).toContainEqual({
        id: "good",
        patch: expect.objectContaining({ state: "expired" }),
      });
      expect(failures).toEqual([
        expect.objectContaining({ stage: "expiry", id: "bad" }),
      ]);
    } finally {
      request.mockRestore();
    }
  });
  it("prioritizes recovery and stops starting deletions when the shared run budget is exhausted", async () => {
    const events: string[] = [];
    const { client } = expiryClient(
      Array.from({ length: 30 }, (_, i) => ({
        id: `recording-${i}`,
        provider_id: `daily-${i}`,
        storage_path: null,
        kind: "video" as const,
      })),
      events,
    );
    let clock = 1_000;
    const now = jest.spyOn(Date, "now").mockImplementation(() => clock);
    const request = jest
      .spyOn(globalThis, "fetch")
      .mockImplementation(async () => {
        clock += 10_000;
        return new Response(null, { status: 204 });
      });
    try {
      const result = await maintainInterviewMedia(client, "key", {
        deadlineAt: 51_000,
      });
      expect(events[0]).toBe("reconcile");
      expect(request.mock.calls.length).toBeLessThanOrEqual(5);
      expect(result.budgetExhausted).toBe(true);
    } finally {
      now.mockRestore();
      request.mockRestore();
    }
  });
  it("returns within the shared deadline when a deletion never resolves", async () => {
    jest.useFakeTimers();
    const { client, updated } = expiryClient([
      {
        id: "hung",
        provider_id: "daily-hung",
        storage_path: null,
        kind: "video",
      },
    ]);
    const request = jest
      .spyOn(globalThis, "fetch")
      .mockImplementation(() => new Promise<Response>(() => undefined));
    try {
      const run = maintainInterviewMedia(client, "key", {
        deadlineAt: Date.now() + 5_000,
      });
      await jest.advanceTimersByTimeAsync(5_001);
      const result = await run;
      expect(result.budgetExhausted).toBe(true);
      expect(result.failures).toContainEqual(
        expect.objectContaining({ stage: "expiry", id: "hung" }),
      );
      expect(updated).toContainEqual({
        id: "hung",
        patch: expect.objectContaining({
          expiry_retry_at: expect.any(String),
          expiry_error: expect.any(String),
        }),
      });
    } finally {
      request.mockRestore();
      jest.useRealTimers();
    }
  });
});
