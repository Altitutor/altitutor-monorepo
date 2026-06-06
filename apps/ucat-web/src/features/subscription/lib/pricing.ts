import type { PublicUcatSubscriptionConfig } from "@/features/subscription/types/public-subscription-config";
import { billingIntervalNoun } from "@/features/subscription/lib/format-subscription-copy";
import { inferBillingFrequency } from "@/features/subscription/lib/invoice-display";

export type PracticeDiscountPricing = {
  standardPriceCents: number;
  discountPerDayCents: number;
  minQuestionsPerDay: number;
  billingPeriodDays: number;
  maxDiscountCents: number;
  minimumPriceCents: number;
  billingFrequencyLabel: string;
  billingIntervalNoun: string;
};

function getBillingPeriodDayCount(
  periodStart: string | null,
  periodEnd: string | null,
  configInterval: PublicUcatSubscriptionConfig["billingInterval"],
): number {
  if (periodStart && periodEnd) {
    const start = new Date(periodStart).getTime();
    const end = new Date(periodEnd).getTime();
    if (Number.isFinite(start) && Number.isFinite(end) && end > start) {
      return Math.max(1, Math.round((end - start) / (1000 * 60 * 60 * 24)));
    }
  }

  switch (configInterval) {
    case "fortnight":
      return 14;
    case "month":
      return 30;
    case "week":
    default:
      return 7;
  }
}

function getStandardPriceCents(
  config: PublicUcatSubscriptionConfig,
  billingFrequencyLabel: string,
): number {
  if (billingFrequencyLabel === "Monthly") {
    return Math.round(config.basePriceCents * 4 * 0.75);
  }
  if (billingFrequencyLabel === "Fortnightly") {
    return config.basePriceCents * 2;
  }
  return config.basePriceCents;
}

export function computePracticeDiscountPricing(
  config: PublicUcatSubscriptionConfig,
  subscription: {
    current_period_start: string | null;
    current_period_end: string | null;
  },
): PracticeDiscountPricing {
  const billingFrequencyLabel = inferBillingFrequency(subscription);
  const billingPeriodDays = getBillingPeriodDayCount(
    subscription.current_period_start,
    subscription.current_period_end,
    config.billingInterval,
  );
  const standardPriceCents = getStandardPriceCents(config, billingFrequencyLabel);
  const maxDiscountCents = billingPeriodDays * config.discountPerDayCents;
  const minimumPriceCents = Math.max(0, standardPriceCents - maxDiscountCents);

  const intervalNoun =
    billingFrequencyLabel === "Weekly"
      ? "week"
      : billingFrequencyLabel === "Monthly"
        ? "month"
        : billingFrequencyLabel === "Fortnightly"
          ? "fortnight"
          : billingIntervalNoun(config.billingInterval);

  return {
    standardPriceCents,
    discountPerDayCents: config.discountPerDayCents,
    minQuestionsPerDay: config.minQuestionsPerDay,
    billingPeriodDays,
    maxDiscountCents,
    minimumPriceCents,
    billingFrequencyLabel,
    billingIntervalNoun: intervalNoun,
  };
}

export function getSubscriptionEndDateIso(subscription: {
  cancel_at_period_end: boolean;
  cancel_at: string | null;
  current_period_end: string | null;
}): string | null {
  if (!subscription.cancel_at_period_end) return null;
  if (subscription.cancel_at) return subscription.cancel_at.slice(0, 10);
  if (subscription.current_period_end) {
    return subscription.current_period_end.slice(0, 10);
  }
  return null;
}
