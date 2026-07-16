"use client";

import posthog from "posthog-js";

export const MARKETING_ANALYTICS_CONTEXT = {
  app: "marketing-web",
  product: "general",
  surface: "marketing",
} as const;

export function captureMarketingEvent(
  event: string,
  properties: Record<string, unknown> = {},
) {
  if (!posthog.__loaded) return;

  posthog.capture(event, {
    ...MARKETING_ANALYTICS_CONTEXT,
    ...properties,
  });
}
