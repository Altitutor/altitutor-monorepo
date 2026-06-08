import { computeMarketingPlanPricing } from "@/features/subscription/lib/marketing-plan-pricing";

describe("marketing-plan-pricing", () => {
  it("computes weekly ideal and penalty from practice-day discounts and cap", () => {
    const pricing = computeMarketingPlanPricing(7500, "week", 1000, 7);
    // 7500 - (7 * 1000) = 500
    expect(pricing.penaltyPeriodCents).toBe(7500);
    expect(pricing.idealPeriodCents).toBe(500);
    expect(pricing.idealWeeklyCents).toBe(500);
    expect(pricing.penaltyWeeklyCents).toBe(7500);
  });

  it("uses explicit cap rather than full period days for monthly", () => {
    const pricing = computeMarketingPlanPricing(30000, "month", 1000, 20);
    // 30000 - (20 * 1000) = 10000
    expect(pricing.penaltyPeriodCents).toBe(30000);
    expect(pricing.idealPeriodCents).toBe(10000);
    expect(pricing.penaltyWeeklyCents).toBe(7000);
    expect(pricing.idealWeeklyCents).toBe(2333);
  });

  it("converts yearly period prices to per-week using 7/365", () => {
    const pricing = computeMarketingPlanPricing(36500, "year", 0, 365);
    expect(pricing.penaltyWeeklyCents).toBe(700);
    expect(pricing.idealWeeklyCents).toBe(700);
  });
});
