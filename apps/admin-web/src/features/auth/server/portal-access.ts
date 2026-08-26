import "server-only";

import { cache } from "react";
import * as Sentry from "@sentry/nextjs";
import type { Database } from "@altitutor/shared";
import { createServerComponentClient } from "@/shared/lib/supabase/server-component";

const ACCESS_DEADLINE_MS = 10_000;
const JWT_CLOCK_SKEW_RETRY_MS = 1_000;

type Profile = Database["public"]["Views"]["vtutor_profile"]["Row"];
type AccessError = {
  code?: string;
  message?: string;
  name?: string;
  status?: number;
};
type QueryResult<T> = { data: T | null; error: AccessError | null };

export type AdminPortalAccess =
  | { status: "allowed"; userId: string; profile: Profile }
  | { status: "redirect_tutor" }
  | { status: "unauthenticated" }
  | { status: "denied" }
  | { status: "unavailable" };

function errorField(error: unknown, field: string) {
  if (typeof error !== "object" || error === null) return null;
  const value = (error as Record<string, unknown>)[field];
  return typeof value === "string" || typeof value === "number"
    ? String(value)
    : null;
}

function isJwtClockSkewError(error: AccessError | null) {
  return (
    error?.code === "PGRST303" ||
    error?.message?.includes("JWT issued at future") === true
  );
}

function captureUnavailable(
  stage: "authentication" | "portal_access",
  startedAt: number,
  error: unknown,
) {
  Sentry.captureMessage("Portal access dependency unavailable", {
    level: "error",
    fingerprint: ["portal-access-unavailable", "admin-web", stage],
    tags: {
      app: "admin-web",
      dependency_stage: stage,
      http_status: "503",
      supabase_error_code:
        errorField(error, "code") ?? errorField(error, "name") ?? "unknown",
    },
    extra: {
      elapsed_ms: Math.max(0, Date.now() - startedAt),
      error_message: errorField(error, "message"),
      error_status: errorField(error, "status"),
    },
  });
}

function captureRecoveredClockSkew(startedAt: number, error: AccessError) {
  Sentry.captureMessage("Portal access JWT clock skew recovered", {
    level: "warning",
    fingerprint: ["portal-access-jwt-clock-skew", "admin-web"],
    tags: {
      app: "admin-web",
      dependency_stage: "portal_access",
      supabase_error_code: error.code ?? "PGRST303",
      retry_outcome: "recovered",
    },
    extra: { elapsed_ms: Math.max(0, Date.now() - startedAt) },
  });
}

function createDeadline() {
  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const expiration = new Promise<never>((_resolve, reject) => {
    timeout = setTimeout(() => {
      controller.abort();
      reject(new Error("Admin portal access deadline exceeded"));
    }, ACCESS_DEADLINE_MS);
  });

  return {
    fetch(input: RequestInfo | URL, init: RequestInit = {}) {
      return fetch(input, { ...init, signal: controller.signal });
    },
    race<T>(operation: PromiseLike<T>) {
      return Promise.race([Promise.resolve(operation), expiration]);
    },
    dispose() {
      if (timeout) clearTimeout(timeout);
    },
  };
}

async function queryWithClockSkewRetry<T>(
  operation: () => PromiseLike<QueryResult<T>>,
  startedAt: number,
) {
  const first = await operation();
  if (!isJwtClockSkewError(first.error)) return first;

  await new Promise((resolve) => setTimeout(resolve, JWT_CLOCK_SKEW_RETRY_MS));
  const retry = await operation();
  if (!retry.error && first.error)
    captureRecoveredClockSkew(startedAt, first.error);
  return retry;
}

export const loadAdminPortalAccess = cache(
  async (): Promise<AdminPortalAccess> => {
  const startedAt = Date.now();
  const deadline = createDeadline();
  try {
    let supabase: Awaited<ReturnType<typeof createServerComponentClient>>;
    try {
      supabase = await createServerComponentClient(deadline.fetch);
    } catch (error) {
      captureUnavailable("authentication", startedAt, error);
      return { status: "unavailable" };
    }

      let claimsResult: Awaited<ReturnType<typeof supabase.auth.getClaims>>;
      try {
        claimsResult = await deadline.race(supabase.auth.getClaims());
      } catch (error) {
        captureUnavailable("authentication", startedAt, error);
        return { status: "unavailable" };
      }

      if (claimsResult.error?.name === "AuthSessionMissingError") {
        return { status: "unauthenticated" };
      }
      if (claimsResult.error) {
        captureUnavailable("authentication", startedAt, claimsResult.error);
        return { status: "unavailable" };
      }

      const userId = claimsResult.data?.claims?.sub;
      if (!userId) return { status: "unauthenticated" };

      let profileResult: QueryResult<Profile>;
      try {
        profileResult = await deadline.race(
          queryWithClockSkewRetry(
            () => supabase.from("vtutor_profile").select("*").maybeSingle(),
            startedAt,
          ),
        );
      } catch (error) {
        captureUnavailable("portal_access", startedAt, error);
        return { status: "unavailable" };
      }

      if (profileResult.error) {
        captureUnavailable("portal_access", startedAt, profileResult.error);
        return { status: "unavailable" };
      }
      if (profileResult.data?.role === "ADMINSTAFF") {
        return { status: "allowed", userId, profile: profileResult.data };
      }
      if (profileResult.data?.role === "TUTOR")
        return { status: "redirect_tutor" };
      return { status: "denied" };
    } finally {
      deadline.dispose();
    }
  },
);
