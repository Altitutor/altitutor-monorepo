import { computePracticeDiscountBillSnapshot } from "@/features/subscription/lib/pricing";
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
