import "server-only";

import { waitUntil } from "@vercel/functions";
import { PostHog } from "posthog-node";
import {
  buildInPersonBookingEvent,
  type InPersonBookingDurableEvent,
  type InPersonPublicBookingType,
} from "./in-person-booking-event";

function postHogClient(token: string) {
  return new PostHog(token, {
    host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
    flushAt: 1,
    flushInterval: 0,
    requestTimeout: 2_000,
    fetchRetryCount: 0,
  });
}

async function captureInPersonBookingEvent(input: {
  event: InPersonBookingDurableEvent;
  distinctId: string;
  sessionId: string;
  sessionType: InPersonPublicBookingType;
  studentId?: string | null;
  occurredAt?: string;
  posthogSessionId?: string | null;
  properties?: Record<string, string | number | boolean | string[] | null>;
}): Promise<void> {
  const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
  if (!token) return;

  const client = postHogClient(token);
  try {
    client.capture(buildInPersonBookingEvent(input));
    await client.flush();
  } catch (error) {
    console.error(
      "[posthog] Failed to capture in-person booking event",
      error instanceof Error ? error.message : "Unknown error",
    );
  }
}

/** Records a durable public-booking outcome after the corresponding database write. */
export function captureInPersonBookingEventInBackground(
  input: Parameters<typeof captureInPersonBookingEvent>[0],
): void {
  waitUntil(captureInPersonBookingEvent(input));
}
