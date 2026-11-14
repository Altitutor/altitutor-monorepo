import * as Sentry from "@sentry/nextjs";

type Stage =
  | "server_client"
  | "auth"
  | "student"
  | "active_resolution"
  | "active_slot";
const SLOW_REQUEST_MS = 3000;

/**
 * Timings include transport; active_slot is nested inside active_resolution.
 * Their difference is the remaining hydration/catch-up work, not another RPC.
 */
export function createDiscoveryTiming() {
  const started = performance.now();
  const observedAt = new Date().toISOString();
  const stages: Partial<Record<Stage, number>> = {};
  const record = (stage: Stage, duration: number) => {
    stages[stage] = Math.round(Math.max(0, duration));
  };

  return {
    record,
    async measure<T>(
      stage: Stage,
      operation: () => PromiseLike<T>,
    ): Promise<T> {
      const start = performance.now();
      try {
        return await operation();
      } finally {
        record(stage, performance.now() - start);
      }
    },
    finish(status: number, headers?: Headers) {
      const total = Math.round(Math.max(0, performance.now() - started));
      headers?.set(
        "Server-Timing",
        [
          ...Object.entries(stages).map(
            ([stage, duration]) => `${stage};dur=${duration}`,
          ),
          `total;dur=${total}`,
        ].join(", "),
      );
      if (total < SLOW_REQUEST_MS) return;
      // Fixed names and numeric durations only: never copy request/DB values.
      // The SDK attaches its existing request trace/release/environment context.
      try {
        Sentry.captureMessage("Slow UCAT active-attempt discovery", {
          level: "info",
          fingerprint: ["ucat-active-attempt-discovery-timing"],
          tags: {
            "api.route": "/api/ucat/exam-attempts/active",
            diagnostic: "active-attempt-timing",
          },
          extra: {
            observed_at: observedAt,
            total_ms: total,
            status,
            stages_ms: stages,
          },
        });
      } catch {
        // Optional telemetry must never replace a successful response or error.
      }
    },
  };
}
