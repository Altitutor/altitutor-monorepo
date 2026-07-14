import type { UcatBillingInterval, UcatPaidPlanTier } from "@altitutor/shared";

export type SubscriptionJourneyContext =
  | "signup_onboarding"
  | "subscribe"
  | "practice_session"
  | "quota_paywall"
  | "subscription_settings";

export type SubscriptionJourneyEventType =
  | "plan_selection_viewed"
  | "plan_selected"
  | "payment_submitted"
  | "checkout_failed"
  | "change_plan_clicked"
  | "continued_free"
  | "free_plan_selected"
  | "cancellation_dialog_opened"
  | "cancellation_abandoned"
  | "cancellation_confirmed"
  | "cancellation_accelerated"
  | "cancellation_reversed"
  | "quota_upsell_shown"
  | "quota_upsell_converted";

export function trackSubscriptionJourneyEvent(input: {
  eventType: SubscriptionJourneyEventType;
  journeyContext: SubscriptionJourneyContext;
  planTier?: UcatPaidPlanTier;
  billingInterval?: UcatBillingInterval;
  checkoutSessionId?: string;
  metadata?: Record<string, string | number | boolean | null>;
}): void {
  void fetch("/api/ucat/subscription-journey", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    keepalive: true,
  }).catch(() => undefined);
}
