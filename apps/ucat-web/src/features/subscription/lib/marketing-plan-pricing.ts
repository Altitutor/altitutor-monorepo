import {
  periodCentsToPerWeekCents,
  ucatBillingPeriodDays,
  type UcatBillingInterval,
} from "@altitutor/shared";

export type MarketingPlanPricing = {
  /** Standard price for the billing period with no practice-day discounts. */
  penaltyPeriodCents: number;
  /** Lowest price for the period if every day qualifies for a practice discount. */
  idealPeriodCents: number;
  /** Penalty rate shown as a weekly amount. */
  penaltyWeeklyCents: number;
  /** Ideal rate shown as a weekly amount. */
  idealWeeklyCents: number;
};

export function computeMarketingPlanPricing(
  penaltyPeriodCents: number,
  interval: UcatBillingInterval,
  discountPerDayCents: number,
): MarketingPlanPricing {
  const billingPeriodDays = ucatBillingPeriodDays(interval);
  const maxDiscountCents = billingPeriodDays * discountPerDayCents;
  const idealPeriodCents = Math.max(0, penaltyPeriodCents - maxDiscountCents);

  return {
    penaltyPeriodCents,
    idealPeriodCents,
    penaltyWeeklyCents: periodCentsToPerWeekCents(penaltyPeriodCents, interval),
    idealWeeklyCents: periodCentsToPerWeekCents(idealPeriodCents, interval),
  };
}

export function billingIntervalLabel(interval: UcatBillingInterval): string {
  switch (interval) {
    case "week":
      return "Weekly";
    case "month":
      return "Monthly";
    case "year":
      return "Yearly";
  }
}

export function billingIntervalShort(interval: UcatBillingInterval): string {
  switch (interval) {
    case "week":
      return "wk";
    case "month":
      return "mo";
    case "year":
      return "yr";
  }
}

export function billedAtLabel(
  periodCents: number,
  interval: UcatBillingInterval,
  formatMoney: (cents: number) => string,
): string {
  return `Billed at ${formatMoney(periodCents)}/${billingIntervalShort(interval)}`;
}
