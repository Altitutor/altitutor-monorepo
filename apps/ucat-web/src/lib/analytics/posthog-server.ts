import "server-only";
import { founderOfferProperties } from "./founder-offer-properties";

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
    const event = buildUcatLearningActivityCompletedEvent(input);
    client.capture({
      ...event,
      properties: {
        ...event.properties,
        ...(await founderOfferProperties(input.userId)),
      },
    });
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
    const event = buildUcatActivationCompletedEvent(input);
    client.capture({
      ...event,
      properties: {
        ...event.properties,
        ...(await founderOfferProperties(input.userId)),
      },
    });
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
    const event = buildUcatSignupCompletedEvent(input);
    client.capture({
      ...event,
      properties: {
        ...event.properties,
        ...(await founderOfferProperties(input.userId)),
      },
    });
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

/** Server-confirmed offer outcome; repeat delivery uses the same insert ID. */
export function captureUcatOfferEventInBackground(input: {
  authUserId: string;
  event: string;
  properties: Record<string, string | number | boolean | null>;
  dedupeKey: string;
}): void {
  const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
  if (!token) return;
  waitUntil(
    (async () => {
      const client = postHogClient(token);
      try {
        client.capture({
          distinctId: input.authUserId,
          event: input.event,
          properties: {
            app: "ucat-web",
            product: "ucat",
            ...input.properties,
            $insert_id: input.dedupeKey,
          },
        });
        client.identify({
          distinctId: input.authUserId,
          properties: {
            [`${input.properties.offer_kind === "access_pass" ? "founder_access" : "founder_discount"}_campaign`]:
              input.properties.offer_campaign,
            [`${input.properties.offer_kind === "access_pass" ? "founder_access" : "founder_discount"}_code`]:
              input.properties.offer_code,
          },
        });
        await client.flush();
      } catch (error) {
        console.error(
          "[posthog] Offer event failed",
          error instanceof Error ? error.message : "Unknown error",
        );
      }
    })(),
  );
}
