import type { UcatBillingInterval } from "@altitutor/shared";
import {
  getPublicPlanPrice,
  type PublicUcatSubscriptionConfig,
} from "@/features/subscription/types/public-subscription-config";
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

function parseBillingInterval(
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

function getBillingPeriodDayCount(
  periodStart: string | null,
  periodEnd: string | null,
  interval: UcatBillingInterval,
): number {
  if (periodStart && periodEnd) {
    const start = new Date(periodStart).getTime();
    const end = new Date(periodEnd).getTime();
    if (Number.isFinite(start) && Number.isFinite(end) && end > start) {
      return Math.max(1, Math.round((end - start) / (1000 * 60 * 60 * 24)));
    }
  }

  switch (interval) {
    case "year":
      return 365;
    case "month":
      return 30;
    case "week":
    default:
      return 7;
  }
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
    current_period_start: string | null;
    current_period_end: string | null;
    plan_tier?: string | null;
    billing_interval?: string | null;
  },
): PracticeDiscountPricing {
  const billingFrequencyLabel = inferBillingFrequency(subscription);
  const interval =
    parseBillingInterval(subscription.billing_interval) ??
    intervalFromFrequencyLabel(billingFrequencyLabel);
  const billingPeriodDays = getBillingPeriodDayCount(
    subscription.current_period_start,
    subscription.current_period_end,
    interval,
  );
  const standardPriceCents = getStandardPriceCents(
    config,
    subscription,
    billingFrequencyLabel,
  );
  const maxDiscountCents = billingPeriodDays * config.discountPerDayCents;
  const minimumPriceCents = Math.max(0, standardPriceCents - maxDiscountCents);

  return {
    standardPriceCents,
    discountPerDayCents: config.discountPerDayCents,
    minQuestionsPerDay: config.minQuestionsPerDay,
    billingPeriodDays,
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
