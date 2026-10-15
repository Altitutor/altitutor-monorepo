import {
  isAuthRefreshDiscardedError,
  type SupabaseClient,
} from "@supabase/supabase-js";
import type { Database } from "@altitutor/shared";

const RECHECK_ATTEMPTS = 5;
const RECHECK_DELAY_MS = 50;

export type SessionRecoveryObservation = {
  phase: "start" | "end";
  trigger: "missing-session" | "refresh-discarded";
  attempt_count: number;
  elapsed_ms: number;
  outcome?: "restored" | "missing" | "signed-out" | "error";
};

/**
 * A server request can update a session cookie while browser reads resume after
 * idle. An in-flight browser read can briefly see no session or a discarded
 * refresh, then fall back to the anon key. Recheck storage for a short bounded
 * window when this client recently held a session; never reuse an old token.
 */
export function recoverTransientBrowserSession(
  client: SupabaseClient<Database>,
  observer?: (observation: SessionRecoveryObservation) => void,
): SupabaseClient<Database> {
  const getSession = client.auth.getSession.bind(client.auth);
  let hadSession = false;
  let signOutEpoch = 0;
  let recovery: ReturnType<typeof getSession> | null = null;

  client.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_OUT") {
      hadSession = false;
      signOutEpoch += 1;
    } else if (session) hadSession = true;
  });

  client.auth.getSession = async () => {
    const result = await getSession();
    if (result.data.session) {
      hadSession = true;
      return result;
    }
    if (result.error && !isAuthRefreshDiscardedError(result.error)) {
      hadSession = false;
      return result;
    }
    if (!hadSession && !isAuthRefreshDiscardedError(result.error))
      return result;

    if (!recovery) {
      const initialEpoch = signOutEpoch;
      const began = performance.now();
      const trigger = isAuthRefreshDiscardedError(result.error)
        ? "refresh-discarded"
        : "missing-session";
      let attempts = 0;
      let outcome: NonNullable<SessionRecoveryObservation["outcome"]> = "error";
      const observe = (phase: SessionRecoveryObservation["phase"]) => {
        try {
          observer?.({
            phase,
            trigger,
            attempt_count: attempts,
            elapsed_ms: Math.round(performance.now() - began),
            ...(phase === "end" ? { outcome } : {}),
          });
        } catch {
          // Diagnostic observers must never affect authentication or recovery.
        }
      };
      recovery = (async () => {
        observe("start");
        try {
          let latest = result;
          for (let attempt = 0; attempt < RECHECK_ATTEMPTS; attempt += 1) {
            if (signOutEpoch !== initialEpoch) {
              outcome = "signed-out";
              return result;
            }
            if (attempt > 0) {
              await new Promise((resolve) =>
                setTimeout(resolve, RECHECK_DELAY_MS),
              );
            }
            attempts += 1;
            latest = await getSession();
            if (signOutEpoch !== initialEpoch) {
              outcome = "signed-out";
              return result;
            }
            if (latest.data.session) {
              hadSession = true;
              outcome = "restored";
              return latest;
            }
            if (latest.error && !isAuthRefreshDiscardedError(latest.error)) {
              hadSession = false;
              return latest;
            }
          }
          hadSession = false;
          outcome = "missing";
          return latest;
        } finally {
          recovery = null;
          observe("end");
        }
      })();
    }
    return recovery;
  };

  return client;
}
