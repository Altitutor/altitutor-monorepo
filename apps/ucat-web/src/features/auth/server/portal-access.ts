import "server-only";

import { cache } from "react";
import * as Sentry from "@sentry/nextjs";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const ACCESS_DEADLINE_MS = 10_000;
const JWT_CLOCK_SKEW_RETRY_MS = 1_000;

type AccessError = {
  code?: string;
  message?: string;
  name?: string;
  status?: number;
};
type QueryResult = { data: unknown; error: AccessError | null };

export type UcatPortalAccessPayload = {
  studentId: string | null;
  activeStaffRole: "ADMINSTAFF" | "TUTOR" | null;
  hasOnlineAccess: boolean;
  hasInPersonAccess: boolean;
  hasUcatAccess: boolean;
  onlineTier: string | null;
  isQuotaExempt: boolean;
  onboardingCompleted: boolean;
  signupCompleted: boolean | null;
  signupStep: number;
  unlimitedTrialEligible: boolean;
  analyticsAccountClass: "external" | "internal_test";
  testYear: number | null;
  testDate: string | null;
};

export type UcatPortalAccess =
  | { status: "allowed"; userId: string; access: UcatPortalAccessPayload }
  | { status: "unauthenticated" }
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
    fingerprint: ["portal-access-unavailable", "ucat-web", stage],
    tags: {
      app: "ucat-web",
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
      reject(new Error("UCAT portal access deadline exceeded"));
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

function boolean(record: Record<string, unknown>, key: string) {
  return record[key] === true;
}

function nullableString(record: Record<string, unknown>, key: string) {
  return typeof record[key] === "string" ? record[key] : null;
}

function nullableNumber(record: Record<string, unknown>, key: string) {
  return typeof record[key] === "number" ? record[key] : null;
}

function parsePayload(value: unknown): UcatPortalAccessPayload | null {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    return null;
  const record = value as Record<string, unknown>;
  const studentId = nullableString(record, "student_id");
  const role = record.active_staff_role;
  return {
    studentId,
    activeStaffRole: role === "ADMINSTAFF" || role === "TUTOR" ? role : null,
    hasOnlineAccess: boolean(record, "has_online_access"),
    hasInPersonAccess: boolean(record, "has_in_person_access"),
    hasUcatAccess: boolean(record, "has_ucat_access"),
    onlineTier: nullableString(record, "online_tier"),
    isQuotaExempt: boolean(record, "is_quota_exempt"),
    onboardingCompleted: Boolean(record.ucat_onboarding_completed_at),
    signupCompleted: studentId
      ? Boolean(record.ucat_signup_completed_at)
      : null,
    signupStep: nullableNumber(record, "ucat_signup_step") ?? 1,
    unlimitedTrialEligible: boolean(record, "unlimited_trial_eligible"),
    analyticsAccountClass:
      record.ucat_analytics_account_class === "internal_test"
        ? "internal_test"
        : "external",
    testYear: nullableNumber(record, "ucat_test_year"),
    testDate: nullableString(record, "ucat_test_date"),
  };
}

function isClockSkew(error: AccessError | null) {
  return (
    error?.code === "PGRST303" ||
    error?.message?.includes("JWT issued at future") === true
  );
}

async function queryWithClockSkewRetry(
  operation: () => PromiseLike<QueryResult>,
  startedAt: number,
) {
  const first = await operation();
  if (!isClockSkew(first.error)) return first;
  await new Promise((resolve) => setTimeout(resolve, JWT_CLOCK_SKEW_RETRY_MS));
  const retry = await operation();
  if (!retry.error) {
    Sentry.captureMessage("Portal access JWT clock skew recovered", {
      level: "warning",
      fingerprint: ["portal-access-jwt-clock-skew", "ucat-web"],
      tags: {
        app: "ucat-web",
        dependency_stage: "portal_access",
        supabase_error_code: first.error?.code ?? "PGRST303",
        retry_outcome: "recovered",
      },
      extra: { elapsed_ms: Math.max(0, Date.now() - startedAt) },
    });
  }
  return retry;
}

export async function resolveUcatPortalAccess(
  verifiedUserId?: string | null,
): Promise<UcatPortalAccess> {
  const startedAt = Date.now();
  const deadline = createDeadline();
  try {
    if (verifiedUserId === null) return { status: "unauthenticated" };

    let supabase: Awaited<ReturnType<typeof getSupabaseServerClient>>;
    try {
      supabase = await getSupabaseServerClient(deadline.fetch);
    } catch (error) {
      captureUnavailable(
        verifiedUserId === undefined ? "authentication" : "portal_access",
        startedAt,
        error,
      );
      return { status: "unavailable" };
    }
    let userId = verifiedUserId;
    if (userId === undefined) {
      let claims: Awaited<ReturnType<typeof supabase.auth.getClaims>>;
      try {
        claims = await deadline.race(supabase.auth.getClaims());
      } catch (error) {
        captureUnavailable("authentication", startedAt, error);
        return { status: "unavailable" };
      }
      if (claims.error?.name === "AuthSessionMissingError")
        return { status: "unauthenticated" };
      if (claims.error) {
        captureUnavailable("authentication", startedAt, claims.error);
        return { status: "unavailable" };
      }
      userId = claims.data?.claims?.sub;
      if (!userId) return { status: "unauthenticated" };
    }

    let result: QueryResult;
    try {
      result = await deadline.race(
        queryWithClockSkewRetry(
          () => supabase.rpc("current_ucat_portal_access"),
          startedAt,
        ),
      );
    } catch (error) {
      captureUnavailable("portal_access", startedAt, error);
      return { status: "unavailable" };
    }
    if (result.error) {
      captureUnavailable("portal_access", startedAt, result.error);
      return { status: "unavailable" };
    }
    const access = parsePayload(result.data);
    if (!access) {
      captureUnavailable("portal_access", startedAt, {
        code: "invalid_access_payload",
      });
      return { status: "unavailable" };
    }
    return { status: "allowed", userId, access };
  } finally {
    deadline.dispose();
  }
}

export const loadUcatPortalAccess = cache(resolveUcatPortalAccess);
