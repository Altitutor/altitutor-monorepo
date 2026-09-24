import "server-only";

import { waitUntil } from "@vercel/functions";
import { PostHog } from "posthog-node";
import {
  buildUcatLearningActivityCompletedEvent,
  type UcatLearningActivityCompletedInput,
} from "./ucat-retention-event";
import {
  buildUcatActivationCompletedEvent,
  type UcatActivationCompletedInput,
} from "./ucat-activation-event";
import {
  buildUcatSignupCompletedEvent,
  type UcatSignupCompletedInput,
} from "./ucat-signup-event";

function postHogClient(token: string) {
  return new PostHog(token, {
    host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
    flushAt: 1,
    flushInterval: 0,
    requestTimeout: 2_000,
    fetchRetryCount: 0,
  });
}

/**
 * Records a durable learning completion after the corresponding database write.
 * Analytics is fail-open so a telemetry outage can never block student progress.
 */
export async function captureUcatLearningActivityCompleted(
  input: UcatLearningActivityCompletedInput,
): Promise<void> {
  const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
  if (!token) return;

  const client = postHogClient(token);

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

/** Records the first durable value milestone: completed practice plus review. */
export async function captureUcatActivationCompleted(
  input: UcatActivationCompletedInput,
): Promise<void> {
  const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
  if (!token) return;

  const client = postHogClient(token);
  try {
    client.capture(buildUcatActivationCompletedEvent(input));
    await client.flush();
  } catch (error) {
    console.error(
      "[posthog] Failed to capture UCAT activation event",
      error instanceof Error ? error.message : "Unknown error",
    );
  }
}

export function captureUcatActivationCompletedInBackground(
  input: UcatActivationCompletedInput,
): void {
  waitUntil(captureUcatActivationCompleted(input));
}

/** Records the first server-confirmed completion of UCAT product signup. */
export async function captureUcatSignupCompleted(
  input: UcatSignupCompletedInput,
): Promise<void> {
  const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
  if (!token) return;

  const client = postHogClient(token);
  try {
    client.capture(buildUcatSignupCompletedEvent(input));
    await client.flush();
  } catch (error) {
    console.error(
      "[posthog] Failed to capture UCAT signup event",
      error instanceof Error ? error.message : "Unknown error",
    );
  }
}

export function captureUcatSignupCompletedInBackground(
  input: UcatSignupCompletedInput,
): void {
  waitUntil(captureUcatSignupCompleted(input));
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
export type { UcatActivationCompletedInput } from "./ucat-activation-event";
export type { UcatSignupCompletedInput } from "./ucat-signup-event";
