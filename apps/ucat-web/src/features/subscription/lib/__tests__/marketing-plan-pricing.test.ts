import { computeMarketingPlanPricing } from "@/features/subscription/lib/marketing-plan-pricing";

describe("marketing-plan-pricing", () => {
  it("computes weekly ideal and penalty from practice-day discounts", () => {
    const pricing = computeMarketingPlanPricing(7500, "week", 1000);
    // 7500 - (7 * 1000) = 500
    expect(pricing.penaltyPeriodCents).toBe(7500);
    expect(pricing.idealPeriodCents).toBe(500);
    expect(pricing.idealWeeklyCents).toBe(500);
    expect(pricing.penaltyWeeklyCents).toBe(7500);
  });

  it("converts monthly period prices to per-week using 7/30", () => {
    const pricing = computeMarketingPlanPricing(30000, "month", 1000);
    // 30000 - (30 * 1000) = 0
    expect(pricing.penaltyPeriodCents).toBe(30000);
    expect(pricing.idealPeriodCents).toBe(0);
    expect(pricing.penaltyWeeklyCents).toBe(7000);
    expect(pricing.idealWeeklyCents).toBe(0);
  });

  it("converts yearly period prices to per-week using 7/365", () => {
    const pricing = computeMarketingPlanPricing(36500, "year", 0);
    expect(pricing.penaltyWeeklyCents).toBe(700);
    expect(pricing.idealWeeklyCents).toBe(700);
  });
});
