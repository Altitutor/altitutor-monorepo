import {
  hasPaidUcatSubscriptionAccess,
  isManageableUcatSubscriptionStatus,
  isUcatBillingRecoveryStatus,
  isUcatBillingTerminalStatus,
} from "@/lib/ucat/subscription-status";

describe("UCAT subscription status policy", () => {
  it.each(["trialing", "active", "past_due"])(
    "keeps paid access for %s",
    (status) => {
      expect(hasPaidUcatSubscriptionAccess(status)).toBe(true);
    },
  );

  it.each(["unpaid", "canceled", "incomplete", "incomplete_expired"])(
    "does not grant paid access for %s",
    (status) => {
      expect(hasPaidUcatSubscriptionAccess(status)).toBe(false);
    },
  );

  it("keeps unpaid subscriptions manageable without granting access", () => {
    expect(isManageableUcatSubscriptionStatus("unpaid")).toBe(true);
    expect(hasPaidUcatSubscriptionAccess("unpaid")).toBe(false);
  });

  it("distinguishes recovery from terminal states", () => {
    expect(isUcatBillingRecoveryStatus("past_due")).toBe(true);
    expect(isUcatBillingTerminalStatus("unpaid")).toBe(true);
    expect(isUcatBillingTerminalStatus("canceled")).toBe(true);
  });
});
