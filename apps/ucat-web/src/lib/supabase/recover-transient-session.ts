import {
  isAuthRefreshDiscardedError,
  type SupabaseClient,
} from "@supabase/supabase-js";
import type { Database } from "@altitutor/shared";

const RECHECK_ATTEMPTS = 5;
const RECHECK_DELAY_MS = 50;

/**
 * A server request can update a session cookie while browser reads resume after
 * idle. An in-flight browser read can briefly see no session or a discarded
 * refresh, then fall back to the anon key. Recheck storage for a short bounded
 * window when this client recently held a session; never reuse an old token.
 */
export function recoverTransientBrowserSession(
  client: SupabaseClient<Database>,
): SupabaseClient<Database> {
  const getSession = client.auth.getSession.bind(client.auth);
  let hadSession = false;
  let signOutEpoch = 0;
  let recovery: ReturnType<typeof getSession> | null = null;

  client.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_OUT") {
      hadSession = false;
      signOutEpoch += 1;
    }
    else if (session) hadSession = true;
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
    if (!hadSession && !isAuthRefreshDiscardedError(result.error)) return result;

    if (!recovery) {
      const initialEpoch = signOutEpoch;
      recovery = (async () => {
        try {
          let latest = result;
          for (let attempt = 0; attempt < RECHECK_ATTEMPTS; attempt += 1) {
            if (signOutEpoch !== initialEpoch) return result;
            if (attempt > 0) {
              await new Promise((resolve) =>
                setTimeout(resolve, RECHECK_DELAY_MS),
              );
            }
            latest = await getSession();
            if (signOutEpoch !== initialEpoch) return result;
            if (latest.data.session) {
              hadSession = true;
              return latest;
            }
            if (latest.error && !isAuthRefreshDiscardedError(latest.error)) {
              hadSession = false;
              return latest;
            }
          }
          hadSession = false;
          return latest;
        } finally {
          recovery = null;
        }
      })();
    }
    return recovery;
  };

  return client;
}
