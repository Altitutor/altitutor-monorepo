import { defaultPublicSubscriptionConfig } from "@/features/subscription/types/public-subscription-config";
import {
  computeMonthlyProMarketingPricing,
  computeWeeklyProMarketingPricing,
} from "@/features/subscription/lib/marketing-plan-pricing";

describe("marketing-plan-pricing", () => {
  it("computes weekly ideal and penalty from practice-day discounts", () => {
    const pricing = computeWeeklyProMarketingPricing(defaultPublicSubscriptionConfig);
    // 7500 - (7 * 1000) = 500
    expect(pricing.penaltyPeriodCents).toBe(7500);
    expect(pricing.idealPeriodCents).toBe(500);
    expect(pricing.idealWeeklyCents).toBe(500);
  });

  it("expresses monthly plans as weekly with billed monthly totals", () => {
    const pricing = computeMonthlyProMarketingPricing({
      ...defaultPublicSubscriptionConfig,
      monthlyBasePriceCents: 22500,
    });
    // 22500 - (30 * 1000) = -7500 -> 0
    expect(pricing.penaltyPeriodCents).toBe(22500);
    expect(pricing.idealPeriodCents).toBe(0);
    expect(pricing.idealWeeklyCents).toBe(0);
    expect(pricing.penaltyWeeklyCents).toBe(5625);
  });
});
