"use client";

import posthog from "posthog-js";

export const UCAT_ANALYTICS_CONTEXT = {
  app: "ucat-web",
  product: "ucat",
} as const;

export function getUcatAnalyticsSurface(pathname: string) {
  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/signup") ||
    pathname.startsWith("/forgot-password") ||
    pathname.startsWith("/reset-password")
  ) {
    return "auth";
  }
  if (pathname.startsWith("/checkout") || pathname.startsWith("/subscribe")) {
    return "checkout";
  }
  return "application";
}

export function captureUcatEvent(
  event: string,
  properties: Record<string, unknown> = {},
) {
  if (!posthog.__loaded) return;

  posthog.capture(event, {
    ...UCAT_ANALYTICS_CONTEXT,
    ...properties,
  });
}

export { posthog };
