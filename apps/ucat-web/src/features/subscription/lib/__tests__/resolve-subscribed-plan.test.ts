import {
  resolveCurrentPlanDisplayKey,
  subscribedPlanTierRank,
} from "@/features/subscription/lib/resolve-subscribed-plan";

describe("resolveCurrentPlanDisplayKey", () => {
  it("prefers access unlimited even when subscription is missing", () => {
    expect(resolveCurrentPlanDisplayKey("unlimited", null)).toBe("unlimited");
  });

  it("uses active unlimited subscription when access tier is unknown", () => {
    expect(
      resolveCurrentPlanDisplayKey(null, {
        status: "active",
        plan_tier: "unlimited",
      }),
    ).toBe("unlimited");
  });

  it("uses past_due subscription as unlimited when access is unknown", () => {
    expect(
      resolveCurrentPlanDisplayKey(null, {
        status: "past_due",
        plan_tier: "unlimited",
      }),
    ).toBe("unlimited");
  });

  it("keeps Free when access is free and there is no paid subscription", () => {
    expect(resolveCurrentPlanDisplayKey("free", null)).toBe("free");
  });

  it("surfaces paid subscription over a stale free access tier", () => {
    expect(
      resolveCurrentPlanDisplayKey("free", {
        status: "active",
        plan_tier: "unlimited",
      }),
    ).toBe("unlimited");
  });

  it("labels pro trial from access + subscription status", () => {
    expect(
      resolveCurrentPlanDisplayKey("pro", {
        status: "trialing",
        plan_tier: "pro",
      }),
    ).toBe("pro_trial");
  });
});

describe("subscribedPlanTierRank", () => {
  it("ranks past_due unlimited as paid", () => {
    expect(
      subscribedPlanTierRank({
        status: "past_due",
        plan_tier: "unlimited",
      }),
    ).toBe(1);
  });
});
