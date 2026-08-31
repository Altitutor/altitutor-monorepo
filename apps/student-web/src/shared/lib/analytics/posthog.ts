"use client";

import posthog from "posthog-js";

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

export { posthog };
