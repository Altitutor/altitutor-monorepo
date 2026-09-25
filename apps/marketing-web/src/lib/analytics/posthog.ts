"use client";

export const MARKETING_ANALYTICS_CONTEXT = {
  app: "marketing-web",
  product: "general",
  surface: "marketing",
} as const;

let client: Promise<typeof import("posthog-js").default> | undefined;

/** Keep analytics out of the initial page bundle, and load only when configured. */
export function getMarketingAnalytics() {
  const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
  if (!token) return undefined;
  client ??= import("posthog-js").then(({ default: posthog }) => {
    posthog.init(token, {
      api_host:
        process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
      defaults: "2026-05-30",
      capture_pageview: false,
      capture_pageleave: true,
      autocapture: false,
      capture_dead_clicks: false,
      cross_subdomain_cookie: true,
      person_profiles: "identified_only",
      disable_session_recording: true,
      disable_surveys: true,
    });
    posthog.register({
      ...MARKETING_ANALYTICS_CONTEXT,
      environment:
        process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ??
        process.env.NODE_ENV ??
        "development",
    });
    return posthog;
  });
  return client;
}

export function captureMarketingEvent(
  event: string,
  properties: Record<string, unknown> = {},
) {
  void getMarketingAnalytics()
    ?.then((posthog) => {
      posthog.capture(event, { ...MARKETING_ANALYTICS_CONTEXT, ...properties });
    })
    .catch(() => {
      /* Analytics must not interrupt the site when blocked. */
    });
}
