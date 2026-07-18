import "server-only";

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

export type { UcatLearningActivityCompletedInput } from "./ucat-retention-event";
