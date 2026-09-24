"use client";

import posthog from "posthog-js";
import { buildPosthogIdentityHeaders } from "./in-person-booking-event";

export const STUDENT_ANALYTICS_CONTEXT = {
  app: "student-web",
  product: "online-learning",
} as const;

export function getStudentAnalyticsSurface(pathname: string) {
  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/register") ||
    pathname.startsWith("/forgot-password") ||
    pathname.startsWith("/reset-password")
  ) {
    return "auth";
  }
  if (pathname.startsWith("/billing")) return "checkout";
  if (
    pathname.startsWith("/booking") ||
    pathname.startsWith("/booking-success") ||
    pathname.startsWith("/b/")
  ) {
    return "booking";
  }
  return "application";
}

const PUBLIC_TOKEN_ROUTES = [
  "/register/",
  "/invite/",
  "/form/",
  "/r/",
  "/b/",
  "/unenrol/",
] as const;

/** Prevent bearer tokens embedded in public URLs from reaching analytics. */
export function sanitizeStudentAnalyticsPathname(pathname: string) {
  const route = PUBLIC_TOKEN_ROUTES.find((prefix) =>
    pathname.startsWith(prefix),
  );
  if (!route) return pathname;

  const suffix = pathname.slice(route.length).split("/").slice(1).join("/");
  return `${route}[token]${suffix ? `/${suffix}` : ""}`;
}

export function sanitizeStudentAnalyticsUrl(rawUrl: string) {
  try {
    const url = new URL(rawUrl);
    url.pathname = sanitizeStudentAnalyticsPathname(url.pathname);
    const step = url.searchParams.get("step");
    url.search = "";
    if (step && /^\d+$/.test(step)) url.searchParams.set("step", step);
    return url.toString();
  } catch {
    return sanitizeStudentAnalyticsPathname(rawUrl.split("?")[0] ?? rawUrl);
  }
}

export function captureStudentEvent(
  event: string,
  properties: Record<string, unknown> = {},
) {
  if (!posthog.__loaded) return;

  posthog.capture(event, {
    ...STUDENT_ANALYTICS_CONTEXT,
    ...properties,
  });
}

/** Waits for PostHog init so first-paint booking events are not dropped. */
export function captureStudentEventWhenReady(
  event: string,
  properties: Record<string, unknown> = {},
) {
  if (typeof window === "undefined") return;
  if (posthog.__loaded) {
    captureStudentEvent(event, properties);
    return;
  }

  const startedAt = Date.now();
  const timer = window.setInterval(() => {
    if (posthog.__loaded) {
      window.clearInterval(timer);
      captureStudentEvent(event, properties);
    } else if (Date.now() - startedAt > 5000) {
      window.clearInterval(timer);
    }
  }, 100);
}

export function posthogIdentityHeaders(): Record<string, string> {
  if (!posthog.__loaded) return {};

  return buildPosthogIdentityHeaders({
    distinctId: posthog.get_distinct_id(),
    sessionId:
      typeof posthog.get_session_id === "function"
        ? posthog.get_session_id()
        : null,
  });
}

export { posthog };
