import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../supabase/generated";
import { DailyInterviewProvider } from "./daily";
import { createInterviewMediaStore } from "./media-store";
import {
  InterviewMediaService,
  type InterviewMediaStore,
} from "./media-service";

export interface InterviewMaintenanceFailure {
  stage: "reconciliation" | "expiry";
  id: string;
  message: string;
}
export interface InterviewMaintenanceOptions {
  /** Absolute deadline shared by every stage, including provider calls and lease cleanup. */
  deadlineAt?: number;
  onFailure?: (failure: InterviewMaintenanceFailure) => void;
}
class MaintenanceDeadline extends Error {
  constructor() {
    super("Interview maintenance time budget exhausted.");
  }
}
function remaining(deadlineAt: number) {
  return Math.max(0, deadlineAt - Date.now());
}
async function bounded<T>(
  deadlineAt: number,
  operation: () => PromiseLike<T>,
): Promise<T> {
  const milliseconds = remaining(deadlineAt);
  if (!milliseconds) throw new MaintenanceDeadline();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve().then(operation),
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(
          () => reject(new MaintenanceDeadline()),
          milliseconds,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
function provider(key: string, deadlineAt: number) {
  return new DailyInterviewProvider(key, (input, init) => {
    const milliseconds = remaining(deadlineAt);
    if (!milliseconds) return Promise.reject(new MaintenanceDeadline());
    const signal = AbortSignal.timeout(milliseconds);
    return fetch(input, {
      ...init,
      signal: init?.signal ? AbortSignal.any([init.signal, signal]) : signal,
    });
  });
}
function boundedStore(
  client: SupabaseClient<Database>,
  deadlineAt: number,
): InterviewMediaStore {
  const store = createInterviewMediaStore(client);
  return {
    round: (id) => bounded(deadlineAt, () => store.round(id)),
    sessions: (id) => bounded(deadlineAt, () => store.sessions(id)),
    ensureSession: (session) =>
      bounded(deadlineAt, () => store.ensureSession(session)),
    updateSession: (id, patch) =>
      bounded(deadlineAt, () => store.updateSession(id, patch)),
    claimRecordingRefresh: (id) =>
      bounded(deadlineAt, () => store.claimRecordingRefresh(id)),
    ensureRecording: (session) =>
      bounded(deadlineAt, () => store.ensureRecording(session)),
    failPendingRecording: (id) =>
      bounded(deadlineAt, () => store.failPendingRecording(id)),
    syncRecording: (session, recording, first) =>
      bounded(deadlineAt, () => store.syncRecording(session, recording, first)),
  };
}
function report(
  options: InterviewMaintenanceOptions,
  stage: InterviewMaintenanceFailure["stage"],
  id: string,
  error: unknown,
) {
  options.onFailure?.({
    stage,
    id,
    message:
      error instanceof Error
        ? error.message
        : "Interview maintenance operation failed.",
  });
}

/** Durable jobs retry after a crash or provider failure; a stale worker cannot release a newer lease. */
export async function reconcileInterviewMedia(
  client: SupabaseClient<Database>,
  key: string,
  roundId?: string,
  options: InterviewMaintenanceOptions = {},
): Promise<number> {
  const deadlineAt = options.deadlineAt ?? Date.now() + 45_000;
  // Reserve time to return failed leases with their existing five-minute backoff.
  const workDeadline = Math.min(deadlineAt - 5_000, Date.now() + 40_000);
  const store = boundedStore(client, workDeadline);
  const service = new InterviewMediaService(store, provider(key, workDeadline));
  let handled = 0;
  let attempted = 0;
  while (Date.now() < workDeadline && attempted < (roundId ? 1 : 10)) {
    const { data, error } = await bounded(workDeadline, () =>
      client.rpc(
        "interview_claim_media_job",
        roundId ? { p_round_id: roundId } : {},
      ),
    );
    if (error) throw error;
    const job = data?.[0];
    if (!job) {
      if (roundId)
        throw new Error(
          "Video update is already being reconciled. Shutdown is not yet confirmed.",
        );
      break;
    }
    attempted++;
    try {
      await bounded(workDeadline, () => service.reconcile(job.round_id));
      const state = await store.round(job.round_id);
      const sessions = await store.sessions(job.round_id);
      const settled =
        state.phase === "completed" &&
        sessions.every(
          (session) => session.kind === "audio" || session.closedAt,
        ) &&
        state.recordings.every(
          (recording) =>
            recording.kind === "audio" ||
            !["pending", "recording"].includes(recording.state),
        );
      const { error: completeError } = await bounded(deadlineAt, () =>
        client.rpc("interview_complete_media_job", {
          p_round_id: job.round_id,
          p_revision: job.revision,
          p_lease_token: job.lease_token,
          p_delay_seconds: state.phase === "completed" ? 300 : 30,
          p_retire: settled,
        }),
      );
      if (completeError) throw completeError;
      handled++;
    } catch (error) {
      report(options, "reconciliation", job.round_id, error);
      try {
        const { error: retryError } = await bounded(deadlineAt, () =>
          client.rpc("interview_complete_media_job", {
            p_round_id: job.round_id,
            p_revision: job.revision,
            p_lease_token: job.lease_token,
            p_delay_seconds: 300,
            p_retire: false,
          }),
        );
        if (retryError) throw retryError;
      } catch (retryError) {
        // The persisted lease still expires if its release cannot reach Postgres.
        report(options, "reconciliation", job.round_id, retryError);
      }
      if (roundId) throw error;
    }
  }
  return handled;
}

export async function expireInterviewRecordings(
  client: SupabaseClient<Database>,
  key?: string,
  options: InterviewMaintenanceOptions = {},
): Promise<number> {
  const deadlineAt = options.deadlineAt ?? Date.now() + 45_000;
  const workDeadline = deadlineAt - 1_000;
  if (Date.now() >= workDeadline) return 0;
  const now = new Date().toISOString();
  const { data, error } = await bounded(workDeadline, () =>
    client
      .from("interview_recordings")
      .select("*")
      .lte("expires_at", now)
      .lte("expiry_retry_at", now)
      .neq("state", "expired")
      .order("expires_at")
      .limit(30),
  );
  if (error) throw error;
  let expired = 0;
  for (const recording of data ?? []) {
    if (Date.now() >= workDeadline) break;
    try {
      // Persist backoff before external I/O. Even a killed worker cannot keep the
      // same slow first row at the front of every subsequent cron invocation.
      const retryAt = new Date(Date.now() + 5 * 60_000).toISOString();
      const { error: claimError } = await bounded(workDeadline, () =>
        client
          .from("interview_recordings")
          .update({
            expiry_retry_at: retryAt,
            expiry_error:
              "Expiry is in progress. Unfinished deletion will be retried.",
          })
          .eq("id", recording.id),
      );
      if (claimError) throw claimError;
      if (recording.storage_path) {
        const { error: removeError } = await bounded(workDeadline, () =>
          client.storage
            .from("interview-recordings")
            .remove([recording.storage_path!]),
        );
        if (removeError) throw removeError;
      } else if (
        recording.kind !== "audio" &&
        recording.provider_id &&
        !recording.provider_id.startsWith("pending:")
      ) {
        if (!key)
          throw new Error(
            "Daily configuration is missing; recording deletion will retry.",
          );
        await bounded(workDeadline, () =>
          provider(key, workDeadline).deleteRecording(recording.provider_id),
        );
      }
      // Audio capture anchors have no storage object or Daily recording to delete.
      const { error: updateError } = await bounded(deadlineAt, () =>
        client
          .from("interview_recordings")
          .update({ state: "expired", expiry_error: null })
          .eq("id", recording.id),
      );
      if (updateError) throw updateError;
      expired++;
    } catch (error) {
      report(options, "expiry", recording.id, error);
      try {
        const { error: updateError } = await bounded(deadlineAt, () =>
          client
            .from("interview_recordings")
            .update({
              expiry_retry_at: new Date(Date.now() + 5 * 60_000).toISOString(),
              expiry_error:
                error instanceof Error
                  ? error.message
                  : "Recording expiry failed. Deletion will retry.",
            })
            .eq("id", recording.id),
        );
        if (updateError) throw updateError;
      } catch (updateError) {
        report(options, "expiry", recording.id, updateError);
      }
    }
  }
  return expired;
}

/** Live room recovery is always attempted first; retention shares the remaining budget. */
export async function maintainInterviewMedia(
  client: SupabaseClient<Database>,
  key?: string,
  options: InterviewMaintenanceOptions = {},
) {
  const deadlineAt = options.deadlineAt ?? Date.now() + 50_000;
  const failures: InterviewMaintenanceFailure[] = [];
  const shared = {
    deadlineAt,
    onFailure: (failure: InterviewMaintenanceFailure) => {
      failures.push(failure);
      options.onFailure?.(failure);
    },
  };
  let reconciled = 0;
  let expired = 0;
  if (key) {
    try {
      reconciled = await reconcileInterviewMedia(
        client,
        key,
        undefined,
        shared,
      );
    } catch (error) {
      report(shared, "reconciliation", "queue", error);
    }
  }
  try {
    expired = await expireInterviewRecordings(client, key, shared);
  } catch (error) {
    report(shared, "expiry", "queue", error);
  }
  return {
    reconciled,
    expired,
    failures,
    budgetExhausted: remaining(deadlineAt) <= 1_000,
  };
}
