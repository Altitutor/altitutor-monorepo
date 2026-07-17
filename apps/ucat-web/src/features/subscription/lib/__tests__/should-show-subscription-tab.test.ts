import { shouldShowSubscriptionTab } from "@/features/subscription/lib/should-show-subscription-tab";

describe("shouldShowSubscriptionTab", () => {
  it("hides for free users with no subscriptions or invoices", () => {
    expect(
      shouldShowSubscriptionTab({
        accessLoading: false,
        billingLoading: false,
        onlineTier: "free",
        subscriptionCount: 0,
        invoiceCount: 0,
      }),
    ).toBe(false);
  });

  it("shows for free users with a past subscription", () => {
    expect(
      shouldShowSubscriptionTab({
        accessLoading: false,
        billingLoading: false,
        onlineTier: "free",
        subscriptionCount: 1,
        invoiceCount: 0,
      }),
    ).toBe(true);
  });

  it("shows for free users with an invoice", () => {
    expect(
      shouldShowSubscriptionTab({
        accessLoading: false,
        billingLoading: false,
        onlineTier: "free",
        subscriptionCount: 0,
        invoiceCount: 1,
      }),
    ).toBe(true);
  });

  it("shows for paid tiers", () => {
    expect(
      shouldShowSubscriptionTab({
        accessLoading: false,
        billingLoading: false,
        onlineTier: "unlimited",
        subscriptionCount: 0,
        invoiceCount: 0,
      }),
    ).toBe(true);
  });

  it("shows while loading to avoid flicker", () => {
    expect(
      shouldShowSubscriptionTab({
        accessLoading: true,
        billingLoading: false,
        onlineTier: "free",
        subscriptionCount: 0,
        invoiceCount: 0,
      }),
    ).toBe(true);
    expect(
      shouldShowSubscriptionTab({
        accessLoading: false,
        billingLoading: true,
        onlineTier: "free",
        subscriptionCount: 0,
        invoiceCount: 0,
      }),
    ).toBe(true);
  });
});
