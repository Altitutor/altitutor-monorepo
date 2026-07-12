import { pickCurrentSubscription } from "@/lib/ucat/subscription/fetch-subscription-billing";
import type { UcatSubscriptionRow } from "@/lib/ucat/ucat-subscription";

function subscription(
  id: string,
  status: string,
  updatedAt: string,
): UcatSubscriptionRow {
  return {
    id,
    status,
    current_period_start: null,
    current_period_end: null,
    cancel_at_period_end: false,
    cancel_at: null,
    stripe_subscription_id: `sub_${id}`,
    stripe_price_id: null,
    plan_tier: "unlimited",
    billing_interval: "month",
    billing_recovery_invoice_id: null,
    billing_recovery_started_at: null,
    billing_recovery_next_attempt_at: null,
    billing_recovery_requires_action: false,
    created_at: updatedAt,
    updated_at: updatedAt,
  };
}

describe("pickCurrentSubscription", () => {
  it("keeps a past-due subscription current during Stripe recovery", () => {
    expect(
      pickCurrentSubscription([
        subscription("past", "past_due", "2026-07-12T10:00:00Z"),
      ]),
    ).toMatchObject({ id: "past", status: "past_due" });
  });

  it("does not let a newer canceled row hide a recoverable subscription", () => {
    expect(
      pickCurrentSubscription([
        subscription("canceled", "canceled", "2026-07-12T11:00:00Z"),
        subscription("past", "past_due", "2026-07-12T10:00:00Z"),
      ]),
    ).toMatchObject({ id: "past", status: "past_due" });
  });

  it("keeps unpaid visible for payment management without granting access", () => {
    expect(
      pickCurrentSubscription([
        subscription("unpaid", "unpaid", "2026-07-12T10:00:00Z"),
      ]),
    ).toMatchObject({ id: "unpaid", status: "unpaid" });
  });

  it("returns null when only terminal history exists", () => {
    expect(
      pickCurrentSubscription([
        subscription("canceled", "canceled", "2026-07-12T10:00:00Z"),
      ]),
    ).toBeNull();
  });
});
