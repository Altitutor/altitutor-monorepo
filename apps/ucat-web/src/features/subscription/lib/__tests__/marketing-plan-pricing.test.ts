import { computeMarketingPlanPricing } from "@/features/subscription/lib/marketing-plan-pricing";

describe("marketing-plan-pricing", () => {
  it("computes weekly ideal and standard pricing from practice-day discounts and cap", () => {
    const pricing = computeMarketingPlanPricing(1500, "week", 100, 5);
    expect(pricing.standardPeriodCents).toBe(1500);
    expect(pricing.idealPeriodCents).toBe(1000);
    expect(pricing.idealWeeklyCents).toBe(1000);
    expect(pricing.standardWeeklyCents).toBe(1500);
  });

  it("uses explicit cap rather than full period days for monthly", () => {
    const pricing = computeMarketingPlanPricing(4000, "month", 100, 22);
    expect(pricing.standardPeriodCents).toBe(4000);
    expect(pricing.idealPeriodCents).toBe(1800);
    expect(pricing.standardWeeklyCents).toBe(933);
    expect(pricing.idealWeeklyCents).toBe(420);
  });

  it("converts yearly period prices to per-week using 7/365", () => {
    const pricing = computeMarketingPlanPricing(36500, "year", 0, 365);
    expect(pricing.standardWeeklyCents).toBe(700);
    expect(pricing.idealWeeklyCents).toBe(700);
  });
});
