import { resolveSentryCollection } from "@altitutor/shared";
import * as Sentry from "@sentry/nextjs";
import type { AuthChangeEvent, SupabaseClient } from "@supabase/supabase-js";

const navigationObservers = new Set<() => void>();

/** Deliberately accepts no route, navigation payload or URL. */
export function recordAdminAuthNavigation() {
  navigationObservers.forEach((observe) => observe());
}

type Entry = {
  sequence: number;
  at: number;
  kind:
    | AuthChangeEvent
    | "start"
    | "online"
    | "offline"
    | "visibility"
    | "navigation"
    | "pageshow"
    | "pagehide"
    | "refresh-start"
    | "refresh-end"
    | "denial"
    | "first-success";
  session?: boolean;
  status?: number;
  visible?: boolean;
  expiry?: string;
  online?: boolean;
};

type RequestObservation = {
  category: "table" | "rpc";
  authorization:
    | "missing"
    | "configured-anonymous-key"
    | "other-bearer"
    | "other-authorization";
  status: number;
  started: number;
  completed: number;
  session: boolean | "unknown";
  expiry: string;
  sessionAge: string;
};

function ageBucket(milliseconds: number) {
  return milliseconds < 1000
    ? "under-1s"
    : milliseconds < 60000
      ? "under-1m"
      : milliseconds < 3600000
        ? "under-1h"
        : "over-1h";
}

/** Default-off evidence capture; it never refreshes, retries or authorizes requests. */
export function createAdminAuthDiagnostics(options: {
  url: string;
  anonymousKey: string;
  fetch?: typeof fetch;
}) {
  const collection = resolveSentryCollection({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    deploymentEnvironment:
      process.env.NEXT_PUBLIC_SENTRY_DEPLOYMENT_ENVIRONMENT,
    nodeEnvironment: process.env.NODE_ENV,
    ci: process.env.CI,
    disabled: process.env.NEXT_PUBLIC_SENTRY_DISABLED,
    testOptIn: process.env.NEXT_PUBLIC_SENTRY_TEST_OPT_IN,
    hostname:
      typeof window === "undefined" ? undefined : window.location.hostname,
    productionHosts: ["admin.altitutor.com"],
  });
  if (
    typeof window === "undefined" ||
    !collection.errors ||
    process.env.NEXT_PUBLIC_ADMIN_AUTH_DIAGNOSTICS !== "true"
  )
    return undefined;

  const base = new URL(options.url);
  const prefix = base.pathname.replace(/\/$/, "");
  const restPath = `${prefix}/rest/v1/`;
  const transport = options.fetch ?? globalThis.fetch.bind(globalThis);
  const timeline: Entry[] = [];
  let sequence = 0;
  let bursts = 0;
  let lastDenialAt = -Infinity;
  let awaitingSuccess = false;
  let denialSequence = 0;
  let disposed = false;
  let generation = 0;
  let unsubscribe: (() => void) | undefined;
  let sessionPresent: boolean | undefined;
  let expiresAt: number | undefined;
  let sessionObservedAt: number | undefined;
  function expiry() {
    if (expiresAt === undefined || !Number.isFinite(expiresAt))
      return "unknown";
    const remaining = expiresAt * 1000 - Date.now();
    return remaining <= 0
      ? "expired"
      : remaining <= 300000
        ? "under-5m"
        : "over-5m";
  }
  function record(entry: Omit<Entry, "sequence" | "at">) {
    timeline.push({ sequence: ++sequence, at: Date.now(), ...entry });
    if (timeline.length > 32) timeline.shift();
  }
  function online() {
    record({ kind: "online" });
  }
  function offline() {
    record({ kind: "offline" });
  }
  function visibility() {
    record({
      kind: "visibility",
      visible: document.visibilityState === "visible",
    });
  }
  function navigation() {
    record({ kind: "navigation" });
  }
  function pageshow() {
    record({ kind: "pageshow" });
  }
  function pagehide(event: PageTransitionEvent) {
    if (!event.persisted) {
      dispose();
      return;
    }
    generation++;
    timeline.length = 0;
    awaitingSuccess = false;
    sessionPresent = undefined;
    expiresAt = undefined;
    sessionObservedAt = undefined;
    record({ kind: "pagehide" });
  }
  function dispose() {
    disposed = true;
    timeline.length = 0;
    window.removeEventListener("online", online);
    window.removeEventListener("offline", offline);
    window.removeEventListener("pagehide", pagehide);
    window.removeEventListener("pageshow", pageshow);
    document.removeEventListener("visibilitychange", visibility);
    unsubscribe?.();
    navigationObservers.delete(navigation);
  }
  window.addEventListener("online", online);
  window.addEventListener("offline", offline);
  window.addEventListener("pagehide", pagehide);
  window.addEventListener("pageshow", pageshow);
  document.addEventListener("visibilitychange", visibility);
  navigationObservers.add(navigation);
  record({
    kind: "start",
    visible: document.visibilityState === "visible",
    online: navigator.onLine,
  });
  function capture(
    outcome: "denial" | "first-success",
    request: RequestObservation,
  ) {
    const snapshot = timeline.map(({ at, ...entry }) => ({
      ...entry,
      age: ageBucket(Date.now() - at),
    }));
    const burst = bursts;
    try {
      Sentry.withScope((scope) => {
        scope.clear();
        // Allowlist the complete event to exclude inherited user, request URLs,
        // breadcrumbs and arbitrary contexts. Existing error reporting is separate.
        scope.addEventProcessor((event) => ({
          event_id: event.event_id,
          timestamp: event.timestamp,
          release: event.release,
          environment: event.environment,
          message: "Admin auth diagnostic",
          level: "info",
          contexts: { admin_auth: { schema: 1, outcome, burst, request } },
          // Extra has enough normalization depth for an array of flat entries.
          extra: { admin_auth_timeline: snapshot },
        }));
        Sentry.captureEvent({ message: "Admin auth diagnostic" });
      });
    } catch {
      // An observer failure must not change an application's fetch result.
    }
  }
  return {
    fetch: (async (input, init) => {
      if (disposed) return transport(input, init);
      let url: URL;
      try {
        url = new URL(
          input instanceof Request ? input.url : String(input),
          window.location.href,
        );
      } catch {
        return transport(input, init);
      }
      const own = url.origin === base.origin;
      const refresh =
        own &&
        url.pathname === `${prefix}/auth/v1/token` &&
        url.searchParams.get("grant_type") === "refresh_token";
      const database = own && url.pathname.startsWith(restPath);
      if (!database && !refresh) return transport(input, init);
      const authorization = new Headers(
        init?.headers ?? (input instanceof Request ? input.headers : undefined),
      ).get("authorization");
      const classification = !authorization
        ? "missing"
        : authorization === `Bearer ${options.anonymousKey}`
          ? "configured-anonymous-key"
          : /^Bearer\s+\S+$/i.test(authorization)
            ? "other-bearer"
            : "other-authorization";
      const started = ++sequence;
      const requestGeneration = generation;
      const session = sessionPresent ?? "unknown";
      const requestExpiry = expiry();
      const sessionAge =
        sessionObservedAt === undefined
          ? "unknown"
          : ageBucket(Date.now() - sessionObservedAt);
      if (refresh) record({ kind: "refresh-start" });
      let response: Response;
      try {
        response = await transport(input, init);
      } catch (error) {
        if (refresh && !disposed && requestGeneration === generation)
          record({ kind: "refresh-end", status: 0 });
        throw error;
      }
      if (!disposed && requestGeneration === generation) {
        if (refresh) record({ kind: "refresh-end", status: response.status });
        const completed = ++sequence;
        const request: RequestObservation = {
          category: url.pathname.startsWith(`${restPath}rpc/`)
            ? "rpc"
            : "table",
          authorization: classification,
          status: response.status,
          started,
          completed,
          session,
          expiry: requestExpiry,
          sessionAge,
        };
        if (
          database &&
          [401, 403].includes(response.status) &&
          bursts < 3 &&
          Date.now() - lastDenialAt >= 60000
        ) {
          bursts++;
          lastDenialAt = Date.now();
          awaitingSuccess = true;
          denialSequence = completed;
          record({ kind: "denial", status: response.status });
          capture("denial", request);
        } else if (
          database &&
          response.ok &&
          awaitingSuccess &&
          started > denialSequence
        ) {
          awaitingSuccess = false;
          record({ kind: "first-success", status: response.status });
          capture("first-success", request);
        }
      }
      return response;
    }) as typeof fetch,
    attach: (client: Pick<SupabaseClient, "auth">) => {
      if (disposed || unsubscribe) return;
      const { data } = client.auth.onAuthStateChange((event, session) => {
        if (disposed) return;
        sessionPresent = Boolean(session);
        sessionObservedAt = Date.now();
        expiresAt = session?.expires_at;
        record({ kind: event, session: sessionPresent, expiry: expiry() });
      });
      unsubscribe = () => data.subscription.unsubscribe();
    },
    dispose,
  };
}
