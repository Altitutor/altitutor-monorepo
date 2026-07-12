import {
  periodCentsToPerWeekCents,
  type UcatBillingInterval,
} from "@altitutor/shared";

export type MarketingPlanPricing = {
  /** Standard price for the billing period with no practice-day discounts. */
  standardPeriodCents: number;
  /** Lowest price for the period if every day qualifies for a practice discount. */
  idealPeriodCents: number;
  /** Standard rate shown as a weekly amount. */
  standardWeeklyCents: number;
  /** Ideal rate shown as a weekly amount. */
  idealWeeklyCents: number;
};

export function computeMarketingPlanPricing(
  standardPeriodCents: number,
  interval: UcatBillingInterval,
  discountPerDayCents: number,
  maxDiscountsPerPeriod: number,
): MarketingPlanPricing {
  const maxDiscountCents = discountPerDayCents * maxDiscountsPerPeriod;
  const idealPeriodCents = Math.max(0, standardPeriodCents - maxDiscountCents);

  return {
    standardPeriodCents,
    idealPeriodCents,
    standardWeeklyCents: periodCentsToPerWeekCents(
      standardPeriodCents,
      interval,
    ),
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
