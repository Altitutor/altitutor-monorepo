import { defaultPublicSubscriptionConfig } from "@/features/subscription/types/public-subscription-config";
import {
  computePracticeDiscountBillSnapshot,
  computePracticeDiscountPricing,
} from "@/features/subscription/lib/pricing";
import type { PracticeDiscountPricing } from "@/features/subscription/lib/pricing";

const monthlyPricing: PracticeDiscountPricing = {
  standardPriceCents: 4000,
  discountPerDayCents: 100,
  minQuestionsPerDay: 10,
  maxDiscountsPerPeriod: 22,
  maxDiscountCents: 2200,
  minimumPriceCents: 1800,
  billingFrequencyLabel: "Monthly",
  billingIntervalNoun: "month",
};

describe("computePracticeDiscountBillSnapshot", () => {
  it("shows the projected bill and discount still available", () => {
    expect(
      computePracticeDiscountBillSnapshot(monthlyPricing, {
        earned: 7,
        cap: 22,
      }),
    ).toEqual({
      earnedDays: 7,
      availableDays: 22,
      earnedDiscountCents: 700,
      remainingDiscountCents: 1500,
      projectedBillCents: 3300,
    });
  });

  it("clamps invalid or excessive progress to the configured cap", () => {
    expect(
      computePracticeDiscountBillSnapshot(monthlyPricing, {
        earned: 30,
        cap: 30,
      }),
    ).toMatchObject({
      earnedDays: 22,
      availableDays: 22,
      remainingDiscountCents: 0,
      projectedBillCents: 1800,
    });
  });
});

describe("founder subscription pricing", () => {
  it("applies the founder percentage before earned practice credits", () => {
    const pricing = computePracticeDiscountPricing(
      {
        ...defaultPublicSubscriptionConfig,
        planPrices: [
          {
            tier: "unlimited",
            interval: "month",
            basePriceCents: 4000,
            checkoutEnabled: true,
            configured: true,
          },
        ],
      },
      {
        billing_interval: "month",
        current_period_start: "2026-09-20",
        current_period_end: "2026-10-20",
      },
      20,
    );
    expect(pricing.standardPriceCents).toBe(3200);
    expect(
      computePracticeDiscountBillSnapshot(pricing, null).projectedBillCents,
    ).toBe(3200);
    expect(
      computePracticeDiscountBillSnapshot(pricing, { earned: 22, cap: 22 })
        .projectedBillCents,
    ).toBe(1000);
  });
});
