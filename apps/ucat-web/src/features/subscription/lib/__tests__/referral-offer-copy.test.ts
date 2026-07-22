import { resolveReferralOfferCopy } from "@/features/subscription/lib/referral-offer-copy";

describe("resolveReferralOfferCopy", () => {
  it("uses free referrer copy when there is no paid subscription", () => {
    const copy = resolveReferralOfferCopy(null);
    expect(copy.isPaidReferrer).toBe(false);
    expect(copy.giftDuration).toBe("week");
    expect(copy.headline).toContain("free week");
    expect(copy.steps[2]?.description).toContain("you both get a free week");
    expect(copy.steps[2]?.description).toContain("Free quota reset");
  });

  it("treats trialing subscriptions as free referrers", () => {
    const copy = resolveReferralOfferCopy({
      status: "trialing",
      plan_tier: "unlimited",
      billing_interval: "month",
    });
    expect(copy.isPaidReferrer).toBe(false);
    expect(copy.giftDuration).toBe("week");
  });

  it("uses weekly paid copy for weekly Unlimited", () => {
    const copy = resolveReferralOfferCopy({
      status: "active",
      plan_tier: "unlimited",
      billing_interval: "week",
    });
    expect(copy.isPaidReferrer).toBe(true);
    expect(copy.giftDuration).toBe("week");
    expect(copy.planLabel).toBe("Unlimited");
    expect(copy.steps[2]?.description).toContain(
      "free week of your Unlimited plan",
    );
  });

  it("uses monthly paid copy for monthly Unlimited", () => {
    const copy = resolveReferralOfferCopy({
      status: "active",
      plan_tier: "unlimited",
      billing_interval: "month",
    });
    expect(copy.isPaidReferrer).toBe(true);
    expect(copy.giftDuration).toBe("month");
    expect(copy.planLabel).toBe("Unlimited");
    expect(copy.headline).toContain("free month");
    expect(copy.steps[2]?.description).toContain(
      "free month of your Unlimited plan",
    );
  });

  it("maps yearly billing to a month-long gift", () => {
    const copy = resolveReferralOfferCopy({
      status: "past_due",
      plan_tier: "unlimited",
      billing_interval: "year",
    });
    expect(copy.giftDuration).toBe("month");
  });
});
