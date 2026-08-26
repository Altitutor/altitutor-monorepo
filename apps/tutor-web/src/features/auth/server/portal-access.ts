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

export type TutorPortalAccess =
  | { status: "allowed"; userId: string; profile: Profile }
  | { status: "unauthenticated" }
  | { status: "denied" }
  | { status: "unavailable" };

function field(error: unknown, key: string) {
  if (typeof error !== "object" || error === null) return null;
  const value = (error as Record<string, unknown>)[key];
  return typeof value === "string" || typeof value === "number"
    ? String(value)
    : null;
}

function captureUnavailable(
  stage: "authentication" | "portal_access",
  startedAt: number,
  error: unknown,
) {
  Sentry.captureMessage("Portal access dependency unavailable", {
    level: "error",
    fingerprint: ["portal-access-unavailable", "tutor-web", stage],
    tags: {
      app: "tutor-web",
      dependency_stage: stage,
      http_status: "503",
      supabase_error_code:
        field(error, "code") ?? field(error, "name") ?? "unknown",
    },
    extra: {
      elapsed_ms: Math.max(0, Date.now() - startedAt),
      error_message: field(error, "message"),
      error_status: field(error, "status"),
    },
  });
}

function createDeadline() {
  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const expiration = new Promise<never>((_resolve, reject) => {
    timeout = setTimeout(() => {
      controller.abort();
      reject(new Error("Tutor portal access deadline exceeded"));
    }, ACCESS_DEADLINE_MS);
  });
  return {
    fetch: (input: RequestInfo | URL, init: RequestInit = {}) =>
      fetch(input, { ...init, signal: controller.signal }),
    race<T>(operation: PromiseLike<T>) {
      return Promise.race([Promise.resolve(operation), expiration]);
    },
    dispose() {
      if (timeout) clearTimeout(timeout);
    },
  };
}

function isClockSkew(error: AccessError | null) {
  return (
    error?.code === "PGRST303" ||
    error?.message?.includes("JWT issued at future") === true
  );
}

async function queryWithClockSkewRetry<T>(
  operation: () => PromiseLike<QueryResult<T>>,
  startedAt: number,
) {
  const first = await operation();
  if (!isClockSkew(first.error)) return first;
  await new Promise((resolve) => setTimeout(resolve, JWT_CLOCK_SKEW_RETRY_MS));
  const retry = await operation();
  if (!retry.error) {
    Sentry.captureMessage("Portal access JWT clock skew recovered", {
      level: "warning",
      fingerprint: ["portal-access-jwt-clock-skew", "tutor-web"],
      tags: {
        app: "tutor-web",
        dependency_stage: "portal_access",
        supabase_error_code: first.error?.code ?? "PGRST303",
        retry_outcome: "recovered",
      },
      extra: { elapsed_ms: Math.max(0, Date.now() - startedAt) },
    });
  }
  return retry;
}

export const loadTutorPortalAccess = cache(
  async (verifiedUserId: string | null): Promise<TutorPortalAccess> => {
    if (!verifiedUserId) return { status: "unauthenticated" };
    const startedAt = Date.now();
    const deadline = createDeadline();
    try {
      let supabase: Awaited<ReturnType<typeof createServerComponentClient>>;
      try {
        supabase = await createServerComponentClient(deadline.fetch);
      } catch (error) {
        captureUnavailable("portal_access", startedAt, error);
        return { status: "unavailable" };
      }
      const userId = verifiedUserId;

      let profile: QueryResult<Profile>;
      try {
        profile = await deadline.race(
          queryWithClockSkewRetry(
            () => supabase.from("vtutor_profile").select("*").maybeSingle(),
            startedAt,
          ),
        );
      } catch (error) {
        captureUnavailable("portal_access", startedAt, error);
        return { status: "unavailable" };
      }
      if (profile.error) {
        captureUnavailable("portal_access", startedAt, profile.error);
        return { status: "unavailable" };
      }
      if (
        profile.data?.status === "ACTIVE" &&
        (profile.data.role === "TUTOR" || profile.data.role === "ADMINSTAFF")
      ) {
        return { status: "allowed", userId, profile: profile.data };
      }
      return { status: "denied" };
    } finally {
      deadline.dispose();
    }
  },
);
