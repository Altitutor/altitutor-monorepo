import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

export type UcatSubscriptionAnalyticsEvent =
  | "subscription_started"
  | "subscription_payment_succeeded"
  | "subscription_renewed"
  | "subscription_cancellation_scheduled"
  | "subscription_cancelled"
  | "payment_failed";

export function isUcatPaidAcquisitionConversion(
  amountPaidCents: number,
  priorPositiveSubscriptionPayments: number,
): boolean {
  return amountPaidCents > 0 && priorPositiveSubscriptionPayments === 0;
}

export function isUcatSubscriptionRenewal(
  billingReason: string | null,
  amountPaidCents: number,
): boolean {
  return billingReason === "subscription_cycle" && amountPaidCents > 0;
}

type AnalyticsProperty = string | number | boolean | string[] | null;

async function deterministicEventUuid(key: string): Promise<string> {
  const bytes = new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(key)),
  );
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x0f) | 0x80;
  const hex = [...bytes.slice(0, 16)]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join("-");
}

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

export async function buildUcatSubscriptionPosthogBody(input: {
  token: string;
  eventName: UcatSubscriptionAnalyticsEvent;
  providerEventId: string;
  occurredAt: string;
  authUserId: string;
  studentId: string;
  accountClass: "external" | "internal_test";
  properties: Record<string, AnalyticsProperty>;
}) {
  const properties: Record<string, AnalyticsProperty> = {
    $process_person_profile: false,
    app: "ucat-web",
    product: "ucat",
    surface: "billing",
    provider: "stripe",
    environment: Deno.env.get("SENTRY_ENVIRONMENT")?.trim() ?? "production",
    student_id: input.studentId,
    account_class: input.accountClass,
    ...input.properties,
  };
  return {
    api_key: input.token,
    event: input.eventName,
    distinct_id: input.authUserId,
    timestamp: input.occurredAt,
    uuid: await deterministicEventUuid(
      `stripe:${input.providerEventId}:${input.eventName}`,
    ),
    properties,
  };
}

/**
 * Best-effort analytics after durable Stripe and database processing. PostHog
 * availability must never affect webhook acknowledgement or billing state.
 */
export async function captureUcatSubscriptionPosthogEvent(
  supabase: SupabaseClient,
  input: {
    eventName: UcatSubscriptionAnalyticsEvent;
    providerEventId: string;
    occurredAt: string;
    studentId: string;
    properties: Record<string, AnalyticsProperty>;
  },
): Promise<void> {
  const token = Deno.env.get("POSTHOG_PROJECT_TOKEN")?.trim();
  if (!token) return;

  const { data: student, error } = await supabase
    .from("students")
    .select("user_id, account_class")
    .eq("id", input.studentId)
    .maybeSingle();
  if (error || !student?.user_id) {
    if (error) {
      console.error(
        "[stripe-webhooks] Could not resolve PostHog student identity",
        error.message,
      );
    }
    return;
  }

  const { data: attribution, error: attributionError } = await supabase
    .from("student_product_acquisition_attributions")
    .select(
      "self_reported_sources, self_reported_other, first_utm_source, first_utm_medium, first_utm_campaign, first_utm_content, first_utm_term, first_referrer_domain, first_landing_path",
    )
    .eq("student_id", input.studentId)
    .eq("product", "UCAT_WEB")
    .maybeSingle();
  if (attributionError) {
    console.error(
      "[stripe-webhooks] Could not resolve PostHog acquisition attribution",
      attributionError.message,
    );
  }

  const url = posthogCaptureUrl(
    Deno.env.get("POSTHOG_HOST")?.trim() ?? "https://us.i.posthog.com",
  );
  if (!url) {
    console.error("[stripe-webhooks] Ignoring invalid POSTHOG_HOST");
    return;
  }

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(2_000),
      body: JSON.stringify(
        await buildUcatSubscriptionPosthogBody({
          token,
          eventName: input.eventName,
          providerEventId: input.providerEventId,
          occurredAt: input.occurredAt,
          authUserId: student.user_id,
          studentId: input.studentId,
          accountClass: student.account_class === "internal_test"
            ? "internal_test"
            : "external",
          properties: {
            self_reported_acquisition_sources:
              attribution?.self_reported_sources ?? [],
            self_reported_acquisition_other: attribution?.self_reported_other ??
              null,
            initial_utm_source: attribution?.first_utm_source ?? null,
            initial_utm_medium: attribution?.first_utm_medium ?? null,
            initial_utm_campaign: attribution?.first_utm_campaign ?? null,
            initial_utm_content: attribution?.first_utm_content ?? null,
            initial_utm_term: attribution?.first_utm_term ?? null,
            initial_referrer_domain: attribution?.first_referrer_domain ?? null,
            initial_landing_path: attribution?.first_landing_path ?? null,
            ...input.properties,
          },
        }),
      ),
    });
    if (!response.ok) {
      console.error(
        `[stripe-webhooks] PostHog capture failed with ${response.status}`,
      );
    }
  } catch (captureError) {
    console.error(
      "[stripe-webhooks] PostHog capture failed",
      captureError instanceof Error ? captureError.message : "Unknown error",
    );
  }
}
