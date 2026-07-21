import "server-only";

import { waitUntil } from "@vercel/functions";
import { PostHog } from "posthog-node";
import {
  buildUcatLearningActivityCompletedEvent,
  type UcatLearningActivityCompletedInput,
} from "./ucat-retention-event";

/**
 * Records a durable learning completion after the corresponding database write.
 * Analytics is fail-open so a telemetry outage can never block student progress.
 */
export async function captureUcatLearningActivityCompleted(
  input: UcatLearningActivityCompletedInput,
): Promise<void> {
  const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
  if (!token) return;

  const client = new PostHog(token, {
    host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
    flushAt: 1,
    flushInterval: 0,
    // Completion analytics is best-effort and runs after the durable write.
    // Keep a telemetry outage from consuming the full function lifetime.
    requestTimeout: 2_000,
    fetchRetryCount: 0,
  });

  try {
    client.capture(buildUcatLearningActivityCompletedEvent(input));
    await client.flush();
  } catch (error) {
    console.error(
      "[posthog] Failed to capture UCAT retention event",
      error instanceof Error ? error.message : "Unknown error",
    );
  }
}

/**
 * Keeps analytics reliable on Vercel without making the student wait for it.
 * The underlying capture is fail-open and has a short network timeout.
 */
export function captureUcatLearningActivityCompletedInBackground(
  input: UcatLearningActivityCompletedInput,
): void {
  waitUntil(captureUcatLearningActivityCompleted(input));
}

export type { UcatLearningActivityCompletedInput } from "./ucat-retention-event";
