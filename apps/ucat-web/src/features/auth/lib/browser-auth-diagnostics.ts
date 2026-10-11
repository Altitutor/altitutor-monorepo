import * as Sentry from "@sentry/nextjs";
import type { Database } from "@altitutor/shared";
import {
  isAuthRefreshDiscardedError,
  type SupabaseClient,
} from "@supabase/supabase-js";
import { isMobileAuthBrowserContext } from "@/lib/privacy/mobile-auth-telemetry";

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
};

const VIEW_OPERATIONS: Record<string, Operation> = {
  "/rest/v1/vstudent_profile": "profile",
  "/rest/v1/vstudent_ucat_my_access": "access",
  "/rest/v1/vstudent_sessions": "sessions",
  "/rest/v1/vstudent_operational_sessions": "sessions",
};

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
        .some((cookie) => /^student-auth(?:\.\d+)?=/.test(cookie.trim()));
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
  let previousSessionPresent = false;
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
      association,
      ...(operation ? { trigger_operation: operation } : {}),
    };
    recent
      .filter((entry) => now - entry.time_ms <= 30_000)
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
    recent.push(entry);
    if (recent.length > 20) recent.shift();
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
    if (!evidence || Date.now() - evidence.time > 30_000) return event;
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
      record({
        kind: "session-start",
        previous_session_present: previousSessionPresent,
      });
      const result = await getSession();
      record({
        kind: "session-end",
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

  return { fetch: diagnosticFetch, observeClient };
}
