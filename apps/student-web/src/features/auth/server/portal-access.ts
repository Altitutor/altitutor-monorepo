import "server-only";

import { cache } from "react";
import * as Sentry from "@sentry/nextjs";
import { createServerComponentClient } from "@/shared/lib/supabase/server-component";

const ACCESS_DEADLINE_MS = 10_000;
const JWT_CLOCK_SKEW_RETRY_MS = 1_000;

type AccessError = {
  code?: string;
  message?: string;
  name?: string;
  status?: number;
};
type PortalAccessPayload = {
  student_id: string | null;
  active_staff_role: "ADMINSTAFF" | "TUTOR" | null;
};
type QueryResult = { data: unknown; error: AccessError | null };

export type StudentPortalAccess =
  | { status: "allowed"; userId: string; studentId: string }
  | { status: "redirect_admin" }
  | { status: "redirect_tutor" }
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
    fingerprint: ["portal-access-unavailable", "student-web", stage],
    tags: {
      app: "student-web",
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
      reject(new Error("Student portal access deadline exceeded"));
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

function parsePayload(value: unknown): PortalAccessPayload | null {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    return null;
  const record = value as Record<string, unknown>;
  const role = record.active_staff_role;
  return {
    student_id:
      typeof record.student_id === "string" ? record.student_id : null,
    active_staff_role: role === "ADMINSTAFF" || role === "TUTOR" ? role : null,
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
      fingerprint: ["portal-access-jwt-clock-skew", "student-web"],
      tags: {
        app: "student-web",
        dependency_stage: "portal_access",
        supabase_error_code: first.error?.code ?? "PGRST303",
        retry_outcome: "recovered",
      },
      extra: { elapsed_ms: Math.max(0, Date.now() - startedAt) },
    });
  }
  return retry;
}

export const loadStudentPortalAccess = cache(
  async (verifiedUserId: string | null): Promise<StudentPortalAccess> => {
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

      let result: QueryResult;
      try {
        result = await deadline.race(
          queryWithClockSkewRetry(
            () => supabase.rpc("current_student_portal_access"),
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
      const payload = parsePayload(result.data);
      if (!payload) {
        captureUnavailable("portal_access", startedAt, {
          code: "invalid_access_payload",
        });
        return { status: "unavailable" };
      }
      if (payload.active_staff_role === "ADMINSTAFF")
        return { status: "redirect_admin" };
      if (payload.active_staff_role === "TUTOR")
        return { status: "redirect_tutor" };
      if (!payload.student_id) return { status: "denied" };
      return { status: "allowed", userId, studentId: payload.student_id };
    } finally {
      deadline.dispose();
    }
  },
);
