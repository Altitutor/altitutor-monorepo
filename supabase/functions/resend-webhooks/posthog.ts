import { posthogEventName, type TrackedResendEvent } from "./logic.ts";

type PosthogEmailEventInput = {
  event: TrackedResendEvent;
  providerEventId: string;
  authUserId: string | null;
  campaignKey: string | null;
};

function posthogCaptureUrl(rawHost: string): string | null {
  try {
    const host = new URL(rawHost);
    if (host.protocol !== "https:") return null;
    host.pathname = "/i/v0/e/";
    host.search = "";
    host.hash = "";
    return host.toString();
  } catch {
    return null;
  }
}

/**
 * Best-effort analytics after the durable database write. A PostHog outage
 * must never make Resend retry an already-recorded webhook.
 */
export async function capturePosthogEmailEvent(
  input: PosthogEmailEventInput,
): Promise<void> {
  const eventName = posthogEventName(input.event.type);
  const token = Deno.env.get("POSTHOG_PROJECT_TOKEN")?.trim();
  if (!eventName || !token || !input.authUserId) return;

  const url = posthogCaptureUrl(
    Deno.env.get("POSTHOG_HOST")?.trim() ?? "https://us.i.posthog.com",
  );
  if (!url) {
    console.error("[resend-webhooks] Ignoring invalid POSTHOG_HOST");
    return;
  }

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(2_000),
      body: JSON.stringify({
        api_key: token,
        event: eventName,
        distinct_id: input.authUserId,
        timestamp: input.event.occurredAt,
        properties: {
          $insert_id: input.providerEventId,
          $process_person_profile: false,
          app: "ucat-web",
          product: "ucat",
          provider: "resend",
          provider_message_id: input.event.providerMessageId,
          campaign_key: input.campaignKey,
          ...input.event.metadata,
        },
      }),
    });
    if (!response.ok) {
      console.error(
        `[resend-webhooks] PostHog capture failed with ${response.status}`,
      );
    }
  } catch (error) {
    console.error(
      "[resend-webhooks] PostHog capture failed",
      error instanceof Error ? error.message : "Unknown error",
    );
  }
}
