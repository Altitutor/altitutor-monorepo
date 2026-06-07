import type { PublicUcatSubscriptionConfig } from "@/features/subscription/types/public-subscription-config";

/** Weeks used to express a monthly bill as an equivalent weekly rate on marketing surfaces. */
const WEEKS_PER_MONTH_DISPLAY = 4;

const WEEKLY_BILLING_DAYS = 7;
const MONTHLY_BILLING_DAYS = 30;

export type MarketingProPlanPricing = {
  /** Standard price for the billing period with no practice-day discounts. */
  penaltyPeriodCents: number;
  /** Lowest price for the period if every day qualifies for a practice discount. */
  idealPeriodCents: number;
  /** Penalty rate shown as a weekly amount (monthly plans divide by 4). */
  penaltyWeeklyCents: number;
  /** Ideal rate shown as a weekly amount (monthly plans divide by 4). */
  idealWeeklyCents: number;
};

function computePeriodPricing(
  penaltyPeriodCents: number,
  billingPeriodDays: number,
  discountPerDayCents: number,
  expressAsWeeklyShare: boolean,
): MarketingProPlanPricing {
  const maxDiscountCents = billingPeriodDays * discountPerDayCents;
  const idealPeriodCents = Math.max(0, penaltyPeriodCents - maxDiscountCents);

  if (!expressAsWeeklyShare) {
    return {
      penaltyPeriodCents,
      idealPeriodCents,
      penaltyWeeklyCents: penaltyPeriodCents,
      idealWeeklyCents: idealPeriodCents,
    };
  }

  return {
    penaltyPeriodCents,
    idealPeriodCents,
    penaltyWeeklyCents: Math.round(penaltyPeriodCents / WEEKS_PER_MONTH_DISPLAY),
    idealWeeklyCents: Math.round(idealPeriodCents / WEEKS_PER_MONTH_DISPLAY),
  };
}

export function computeWeeklyProMarketingPricing(
  config: PublicUcatSubscriptionConfig,
): MarketingProPlanPricing {
  return computePeriodPricing(
    config.basePriceCents,
    WEEKLY_BILLING_DAYS,
    config.discountPerDayCents,
    false,
  );
}

export function computeMonthlyProMarketingPricing(
  config: PublicUcatSubscriptionConfig,
): MarketingProPlanPricing {
  return computePeriodPricing(
    config.monthlyBasePriceCents,
    MONTHLY_BILLING_DAYS,
    config.discountPerDayCents,
    true,
  );
}
