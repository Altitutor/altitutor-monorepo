import type { UcatBillingInterval } from "@altitutor/shared";
import { maxPracticeDayDiscountCents } from "@altitutor/shared";
import {
  getPublicPlanPrice,
  getPublicPracticeDayDiscount,
  type PublicUcatSubscriptionConfig,
} from "@/features/subscription/types/public-subscription-config";
import { billingIntervalNoun } from "@/features/subscription/lib/format-subscription-copy";
import { inferBillingFrequency } from "@/features/subscription/lib/invoice-display";

export type PracticeDiscountPricing = {
  standardPriceCents: number;
  discountPerDayCents: number;
  minQuestionsPerDay: number;
  maxDiscountsPerPeriod: number;
  maxDiscountCents: number;
  minimumPriceCents: number;
  billingFrequencyLabel: string;
  billingIntervalNoun: string;
};

export function parseBillingInterval(
  value: string | null | undefined,
): UcatBillingInterval | null {
  if (value === "week" || value === "month" || value === "year") return value;
  return null;
}

function intervalFromFrequencyLabel(label: string): UcatBillingInterval {
  if (label === "Monthly") return "month";
  if (label === "Yearly") return "year";
  return "week";
}

function getStandardPriceCents(
  config: PublicUcatSubscriptionConfig,
  subscription: {
    plan_tier?: string | null;
    billing_interval?: string | null;
  },
  billingFrequencyLabel: string,
): number {
  const tier = subscription.plan_tier === "pro" ? "pro" : "unlimited";
  const interval =
    parseBillingInterval(subscription.billing_interval) ??
    intervalFromFrequencyLabel(billingFrequencyLabel);
  const row = getPublicPlanPrice(config, tier, interval);
  return row?.basePriceCents ?? 0;
}

export function computePracticeDiscountPricing(
  config: PublicUcatSubscriptionConfig,
  subscription: {
    current_period_start?: string | null;
    current_period_end?: string | null;
    plan_tier?: string | null;
    billing_interval?: string | null;
  },
): PracticeDiscountPricing {
  const billingFrequencyLabel = inferBillingFrequency({
    current_period_start: subscription.current_period_start ?? null,
    current_period_end: subscription.current_period_end ?? null,
  });
  const interval =
    parseBillingInterval(subscription.billing_interval) ??
    intervalFromFrequencyLabel(billingFrequencyLabel);
  const standardPriceCents = getStandardPriceCents(
    config,
    subscription,
    billingFrequencyLabel,
  );
  const discountRule =
    getPublicPracticeDayDiscount(config, interval) ??
    config.practiceDayDiscounts[0];
  const discountPerDayCents = discountRule?.discountPerDayCents ?? 0;
  const maxDiscountsPerPeriod = discountRule?.maxDiscountsPerPeriod ?? 0;
  const maxDiscountCents = maxPracticeDayDiscountCents(
    discountPerDayCents,
    maxDiscountsPerPeriod,
  );
  const minimumPriceCents = Math.max(0, standardPriceCents - maxDiscountCents);

  return {
    standardPriceCents,
    discountPerDayCents,
    minQuestionsPerDay: config.minQuestionsPerDay,
    maxDiscountsPerPeriod,
    maxDiscountCents,
    minimumPriceCents,
    billingFrequencyLabel,
    billingIntervalNoun: billingIntervalNoun(interval),
  };
}

export {
  getSubscriptionEndDateIso,
  isSubscriptionCancelScheduled,
} from "@/lib/ucat/stripe-subscription-fields";
