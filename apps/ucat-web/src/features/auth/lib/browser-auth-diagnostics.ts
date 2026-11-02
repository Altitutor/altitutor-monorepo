import { isAuthCookie } from "@/lib/supabase/auth-cookie";
import * as Sentry from "@sentry/nextjs";
import type { Database } from "@altitutor/shared";
import {
  isAuthRefreshDiscardedError,
  type SupabaseClient,
} from "@supabase/supabase-js";
import { isMobileAuthBrowserContext } from "@/lib/privacy/mobile-auth-telemetry";
import type { SessionRecoveryObservation } from "@/lib/supabase/recover-transient-session";

type Operation = "password" | "refresh" | "profile" | "access" | "sessions";
type CredentialMode = "anonymous-key" | "bearer" | "missing" | "unknown";
type Boundary = {
  sequence: number;
  time_ms: number;
  kind:
    | "request-start"
    | "request-end"
    | "auth-event"
    | "session-start"
    | "session-end";
  cookie_present: boolean | null;
  online: boolean | null;
  visibility: "visible" | "hidden" | "unknown";
  operation?: Operation;
  request_sequence?: number;
  session_sequence?: number;
  credential_mode?: CredentialMode;
  fetch_credentials?: "omit" | "same-origin" | "include";
  elapsed_ms?: number;
  response_status?: number | null;
  response_received?: boolean;
  provider_request_id?: string;
  aborted?: boolean;
  auth_event?:
    | "INITIAL_SESSION"
    | "SIGNED_IN"
    | "SIGNED_OUT"
    | "TOKEN_REFRESHED"
    | "PASSWORD_RECOVERY"
    | "MFA_CHALLENGE_VERIFIED"
    | "USER_UPDATED"
    | "other";
  session_present?: boolean;
  previous_session_present?: boolean;
  session_error?: "none" | "refresh-discarded" | "other";
  session_threw?: boolean;
};

const VIEW_OPERATIONS: Record<string, Operation> = {
  "/rest/v1/vstudent_profile": "profile",
  "/rest/v1/vstudent_ucat_my_access": "access",
  "/rest/v1/vstudent_sessions": "sessions",
  "/rest/v1/vstudent_operational_sessions": "sessions",
};

const MAX_HISTORY = 20;
const MAX_AGE_MS = 30_000;

function providerRequestId(response: Response): string | undefined {
  // Cross-origin exposure varies. Only the two provider correlation headers,
  // containing a complete UUID, may leave the browser; arbitrary values cannot.
  for (const name of ["sb-request-id", "x-request-id"]) {
    const value = response.headers.get(name);
    if (
      value?.length === 36 &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        value,
      )
    ) {
      return value.toLowerCase();
    }
  }
  return undefined;
}

function environment(): Pick<
  Boundary,
  "cookie_present" | "online" | "visibility"
> {
  let cookiePresent: boolean | null = null;
  try {
    if (typeof document !== "undefined") {
      cookiePresent = document.cookie
        .split(";")
        .some((cookie) => isAuthCookie(cookie.trim().split("=", 1)[0]));
    }
  } catch {
    /* Cookie access can be disabled by the browser. */
  }
  const visibility =
    typeof document === "undefined" ? "unknown" : document.visibilityState;
  return {
    cookie_present: cookiePresent,
    online:
      typeof navigator !== "undefined" && typeof navigator.onLine === "boolean"
        ? navigator.onLine
        : null,
    visibility:
      visibility === "visible" || visibility === "hidden"
        ? visibility
        : "unknown",
  };
}

/** Token-free, bounded history for the two unresolved auth investigations.
 * The existing Supabase instrumentation remains the only error-event producer.
 */
export function createBrowserAuthDiagnostics(
  supabaseUrl: string,
  anonymousKey: string,
  fetcher: typeof fetch = (...args) => fetch(...args),
) {
  const origin = new URL(supabaseUrl).origin;
  const recent: Boundary[] = [];
  let sequence = 0;
  let requestSequence = 0;
  let sessionSequence = 0;
  let pendingSessions = 0;
  let previousSessionPresent = false;
  let droppedEntries = 0;
  let expiredEntries = 0;
  let lastRefresh: Boundary | undefined;
  let lastSession: Boundary | undefined;
  let lastAuthEvent: Boundary | undefined;
  let lastPresentSession: number | undefined;
  let lastRecovery:
    | (SessionRecoveryObservation & { time_ms: number })
    | undefined;
  let cookieGap:
    | {
        first: number;
        last: number;
        observations: number;
        restored: boolean;
        truncated: boolean;
      }
    | undefined;
  type Snapshot = { time: number; context: Record<string, unknown> };
  const authErrors = new WeakMap<object, Snapshot>();
  const viewFailures = new Map<Operation, Snapshot>();
  function snapshot(
    association: "sdk-error" | "operation-window",
    operation?: Operation,
  ): Snapshot {
    const now = Date.now();
    const context: Record<string, unknown> = {
      version: 1,
      snapshot_time_ms: now,
      association,
      ...(operation ? { trigger_operation: operation } : {}),
      history: {
        max_entries: MAX_HISTORY,
        max_age_ms: MAX_AGE_MS,
        dropped_entries: droppedEntries,
        expired_entries: expiredEntries,
      },
      pending_get_sessions: pendingSessions,
    };
    if (lastRefresh && now - lastRefresh.time_ms <= MAX_AGE_MS)
      context.last_refresh = {
        ...lastRefresh,
        observed_age_ms: Math.max(0, now - lastRefresh.time_ms),
      };
    if (lastSession && now - lastSession.time_ms <= MAX_AGE_MS)
      context.last_session = {
        ...lastSession,
        observed_age_ms: Math.max(0, now - lastSession.time_ms),
        result: lastSession.session_threw
          ? "threw"
          : lastSession.session_error === "refresh-discarded"
            ? "refresh-discarded"
            : lastSession.session_error === "other"
              ? "error"
              : lastSession.session_present
                ? "present"
                : "missing",
      };
    if (
      lastPresentSession !== undefined &&
      now - lastPresentSession <= MAX_AGE_MS
    )
      context.last_present_session_age_ms = Math.max(
        0,
        now - lastPresentSession,
      );
    if (lastAuthEvent && now - lastAuthEvent.time_ms <= MAX_AGE_MS)
      context.last_auth_event = {
        ...lastAuthEvent,
        observed_age_ms: Math.max(0, now - lastAuthEvent.time_ms),
      };
    if (lastRecovery && now - lastRecovery.time_ms <= MAX_AGE_MS)
      context.recovery = {
        ...lastRecovery,
        observed_age_ms: Math.max(0, now - lastRecovery.time_ms),
      };
    if (cookieGap && now - cookieGap.last <= MAX_AGE_MS) {
      context.cookie_gap = {
        sampling: "boundary-observations",
        observed_span_ms: Math.max(0, cookieGap.last - cookieGap.first),
        last_observed_age_ms: Math.max(0, now - cookieGap.last),
        observations: cookieGap.observations,
        restored_observed: cookieGap.restored,
        window_truncated: cookieGap.truncated,
      };
    }
    recent
      .filter((entry) => now - entry.time_ms <= MAX_AGE_MS)
      .forEach((entry, index) => {
        context[`event_${String(index + 1).padStart(2, "0")}`] = { ...entry };
      });
    return { time: now, context };
  }
  function rememberAuthError(error: object | null, began: number) {
    if (
      error &&
      recent.some(
        (entry) =>
          entry.sequence > began &&
          entry.kind === "request-end" &&
          (entry.operation === "password" || entry.operation === "refresh") &&
          (!entry.response_received || (entry.response_status ?? 0) >= 400),
      )
    ) {
      authErrors.set(error, snapshot("sdk-error"));
    }
  }
  const observed = new WeakSet<SupabaseClient<Database>>();

  function record(
    fields: Omit<
      Boundary,
      "sequence" | "time_ms" | "cookie_present" | "online" | "visibility"
    >,
    failed = false,
  ) {
    if (isMobileAuthBrowserContext()) return;
    const entry: Boundary = {
      sequence: ++sequence,
      time_ms: Date.now(),
      ...environment(),
      ...fields,
    };
    if (entry.kind === "request-end" && entry.operation === "refresh")
      lastRefresh = entry;
    if (entry.kind === "session-end") lastSession = entry;
    if (entry.kind === "auth-event") lastAuthEvent = entry;
    if (entry.session_present) lastPresentSession = entry.time_ms;
    while (recent.length && entry.time_ms - recent[0]!.time_ms > MAX_AGE_MS) {
      recent.shift();
      expiredEntries = Math.min(65_535, expiredEntries + 1);
    }
    if (entry.cookie_present === false) {
      if (!cookieGap || cookieGap.restored) {
        cookieGap = {
          first: entry.time_ms,
          last: entry.time_ms,
          observations: 1,
          restored: false,
          truncated: false,
        };
      } else if (entry.time_ms - cookieGap.first > MAX_AGE_MS) {
        cookieGap = {
          first: entry.time_ms,
          last: entry.time_ms,
          observations: 1,
          restored: false,
          truncated: true,
        };
      } else {
        cookieGap.last = entry.time_ms;
        cookieGap.observations = Math.min(255, cookieGap.observations + 1);
      }
    } else if (entry.cookie_present === true && cookieGap) {
      cookieGap.restored = true;
    }
    recent.push(entry);
    if (recent.length > MAX_HISTORY) {
      recent.shift();
      droppedEntries = Math.min(65_535, droppedEntries + 1);
    }
    if (failed) {
      if (
        fields.operation &&
        fields.operation !== "password" &&
        fields.operation !== "refresh"
      ) {
        viewFailures.set(
          fields.operation,
          snapshot("operation-window", fields.operation),
        );
      }
      try {
        Sentry.addBreadcrumb({
          category: "ucat.auth.boundary",
          level: "info",
          data: entry,
        });
      } catch {
        /* Diagnostic transport must not change an auth result. */
      }
    }
  }

  Sentry.addEventProcessor((event, hint) => {
    if (isMobileAuthBrowserContext()) return event;
    const mechanisms =
      event.exception?.values?.map((value) => value.mechanism?.type) ?? [];
    const original = hint.originalException;
    let evidence =
      typeof original === "object" && original !== null
        ? authErrors.get(original)
        : undefined;
    if (!mechanisms.includes("auto.db.supabase.auth")) evidence = undefined;
    if (
      mechanisms.includes("auto.db.supabase.postgres") ||
      event.contexts?.supabase
    ) {
      const message =
        original instanceof Error
          ? original.message
          : event.exception?.values?.[0]?.value;
      const path = Object.keys(VIEW_OPERATIONS).find(
        (path) =>
          message ===
          `permission denied for view ${path.slice("/rest/v1/".length)}`,
      );
      if (path) evidence = viewFailures.get(VIEW_OPERATIONS[path]!);
    }
    if (!evidence || Date.now() - evidence.time > MAX_AGE_MS) return event;
    return {
      ...event,
      contexts: { ...event.contexts, ucat_auth_boundary: evidence.context },
    };
  });

  const diagnosticFetch: typeof fetch = async (input, init) => {
    const request =
      typeof Request !== "undefined" && input instanceof Request
        ? input
        : undefined;
    let operation: Operation | undefined;
    try {
      const url = new URL(request?.url ?? String(input));
      const method = (init?.method ?? request?.method ?? "GET").toUpperCase();
      if (url.origin === origin) {
        if (method === "GET") operation = VIEW_OPERATIONS[url.pathname];
        if (method === "POST" && url.pathname === "/auth/v1/token") {
          const grant = url.searchParams.get("grant_type");
          if (grant === "password") operation = "password";
          if (grant === "refresh_token") operation = "refresh";
        }
      }
    } catch {
      /* Forward invalid URLs unchanged to the original fetch. */
    }
    if (!operation || isMobileAuthBrowserContext()) return fetcher(input, init);
    const headers = new Headers(init?.headers ?? request?.headers);
    const authorization = headers.get("authorization");
    const credentialMode: CredentialMode =
      authorization === `Bearer ${anonymousKey}`
        ? "anonymous-key"
        : authorization?.startsWith("Bearer ")
          ? "bearer"
          : authorization
            ? "unknown"
            : "missing";
    const fields = {
      operation,
      request_sequence: ++requestSequence,
      credential_mode: credentialMode,
      fetch_credentials:
        init?.credentials ?? request?.credentials ?? ("same-origin" as const),
    };
    const began = performance.now();
    record({ kind: "request-start", ...fields });
    try {
      const response = await fetcher(input, init);
      record(
        {
          kind: "request-end",
          ...fields,
          elapsed_ms: Math.round(performance.now() - began),
          response_received: true,
          response_status: response.status,
          provider_request_id: providerRequestId(response),
          aborted: Boolean((init?.signal ?? request?.signal)?.aborted),
        },
        response.status >= 400,
      );
      return response;
    } catch (error) {
      record(
        {
          kind: "request-end",
          ...fields,
          elapsed_ms: Math.round(performance.now() - began),
          response_received: false,
          response_status: null,
          aborted:
            Boolean((init?.signal ?? request?.signal)?.aborted) ||
            (error instanceof Error && error.name === "AbortError"),
        },
        true,
      );
      throw error;
    }
  };

  function observeClient(client: SupabaseClient<Database>) {
    if (observed.has(client)) return client;
    observed.add(client);
    client.auth.onAuthStateChange((event, session) => {
      const allowedEvents = [
        "INITIAL_SESSION",
        "SIGNED_IN",
        "SIGNED_OUT",
        "TOKEN_REFRESHED",
        "PASSWORD_RECOVERY",
        "MFA_CHALLENGE_VERIFIED",
        "USER_UPDATED",
      ] as const;
      const authEvent =
        allowedEvents.find((allowed) => allowed === event) ?? "other";
      record({
        kind: "auth-event",
        auth_event: authEvent,
        session_present: Boolean(session),
        previous_session_present: previousSessionPresent,
      });
      previousSessionPresent = Boolean(session);
    });
    const signIn = client.auth.signInWithPassword.bind(client.auth);
    client.auth.signInWithPassword = async function signInWithPassword(
      ...args
    ) {
      const began = sequence;
      const result = await signIn(...args);
      rememberAuthError(result.error, began);
      return result;
    };
    const getSession = client.auth.getSession.bind(client.auth);
    client.auth.getSession = async function getSessionWithDiagnostics() {
      const began = sequence;
      const beganAt = performance.now();
      const currentSessionSequence = ++sessionSequence;
      pendingSessions += 1;
      record({
        kind: "session-start",
        session_sequence: currentSessionSequence,
        previous_session_present: previousSessionPresent,
      });
      let result: Awaited<ReturnType<typeof getSession>>;
      try {
        result = await getSession();
      } catch (error) {
        pendingSessions -= 1;
        record({
          kind: "session-end",
          session_sequence: currentSessionSequence,
          elapsed_ms: Math.round(performance.now() - beganAt),
          session_error: "other",
          session_threw: true,
        });
        throw error;
      }
      pendingSessions -= 1;
      record({
        kind: "session-end",
        session_sequence: currentSessionSequence,
        elapsed_ms: Math.round(performance.now() - beganAt),
        session_present: Boolean(result.data.session),
        previous_session_present: previousSessionPresent,
        session_error: !result.error
          ? "none"
          : isAuthRefreshDiscardedError(result.error)
            ? "refresh-discarded"
            : "other",
      });
      previousSessionPresent = Boolean(result.data.session);
      rememberAuthError(result.error, began);
      return result;
    };
    return client;
  }

  function observeRecovery(observation: SessionRecoveryObservation) {
    if (isMobileAuthBrowserContext()) return;
    lastRecovery = { ...observation, time_ms: Date.now() };
  }

  return { fetch: diagnosticFetch, observeClient, observeRecovery };
}
