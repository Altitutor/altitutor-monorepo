import {
  getSubscriptionEndDateIso,
  isSubscriptionCancelScheduled,
  subscriptionCancelFields,
} from "@/lib/ucat/stripe-subscription-fields";

describe("subscriptionCancelFields", () => {
  it("treats future cancel_at as scheduled cancellation when cancel_at_period_end is false", () => {
    const future = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7;
    const result = subscriptionCancelFields({
      status: "active",
      cancel_at_period_end: false,
      cancel_at: future,
    });

    expect(result.cancel_at_period_end).toBe(true);
    expect(result.cancel_at).not.toBeNull();
  });
});

describe("isSubscriptionCancelScheduled", () => {
  it("returns true when cancel_at is in the future even if cancel_at_period_end is false", () => {
    const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    expect(
      isSubscriptionCancelScheduled({
        status: "active",
        cancel_at_period_end: false,
        cancel_at: future,
      }),
    ).toBe(true);
  });

  it("returns end date from cancel_at", () => {
    expect(
      getSubscriptionEndDateIso({
        status: "active",
        cancel_at_period_end: false,
        cancel_at: "2026-06-12T22:15:40.000Z",
        current_period_end: null,
      }),
    ).toBe("2026-06-12");
  });
});
