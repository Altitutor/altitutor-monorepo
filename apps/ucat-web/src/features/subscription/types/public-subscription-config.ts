import type {
  UcatBillingInterval,
  UcatPaidPlanTier,
  UcatPracticeDayDiscountRule,
} from "@altitutor/shared";
import type { UcatFreeQuotaConfig } from "@/lib/ucat/quota/config";
import { DEFAULT_FREE_QUOTA_CONFIG } from "@/lib/ucat/quota/config";

export type PublicUcatPlanPrice = {
  tier: UcatPaidPlanTier;
  interval: UcatBillingInterval;
  basePriceCents: number;
  checkoutEnabled: boolean;
  configured: boolean;
};

export type PublicUcatPracticeDayDiscount = UcatPracticeDayDiscountRule;

export type PublicUcatSubscriptionConfig = {
  trialDays: number;
  minQuestionsPerDay: number;
  currency: string;
  freeQuotas: UcatFreeQuotaConfig;
  planPrices: PublicUcatPlanPrice[];
  practiceDayDiscounts: PublicUcatPracticeDayDiscount[];
  unlimitedProductConfigured: boolean;
};

/** Fallback when the public API is unavailable */
export const defaultPublicSubscriptionConfig: PublicUcatSubscriptionConfig = {
  trialDays: 5,
  minQuestionsPerDay: 10,
  currency: "aud",
  freeQuotas: DEFAULT_FREE_QUOTA_CONFIG,
  planPrices: [],
  practiceDayDiscounts: [
    { interval: "week", discountPerDayCents: 100, maxDiscountsPerPeriod: 5 },
    { interval: "month", discountPerDayCents: 100, maxDiscountsPerPeriod: 22 },
    { interval: "year", discountPerDayCents: 0, maxDiscountsPerPeriod: 1 },
  ],
  unlimitedProductConfigured: false,
};

export function getPublicPracticeDayDiscount(
  config: PublicUcatSubscriptionConfig,
  interval: UcatBillingInterval,
): PublicUcatPracticeDayDiscount | undefined {
  return config.practiceDayDiscounts.find((row) => row.interval === interval);
}

export function getPublicPlanPrice(
  config: PublicUcatSubscriptionConfig,
  tier: UcatPaidPlanTier,
  interval: UcatBillingInterval,
): PublicUcatPlanPrice | undefined {
  return config.planPrices.find(
    (p) => p.tier === tier && p.interval === interval,
  );
}

export function isPlanCheckoutAvailable(
  config: PublicUcatSubscriptionConfig,
  tier: UcatPaidPlanTier,
  interval: UcatBillingInterval,
): boolean {
  const row = getPublicPlanPrice(config, tier, interval);
  if (!row?.checkoutEnabled || !row.configured) return false;
  return config.unlimitedProductConfigured;
}

export function isTierOffered(
  config: PublicUcatSubscriptionConfig,
  _tier: UcatPaidPlanTier,
): boolean {
  return config.unlimitedProductConfigured;
}

export function getAvailableBillingIntervals(
  config: PublicUcatSubscriptionConfig,
): UcatBillingInterval[] {
  const intervals: UcatBillingInterval[] = ["week", "month", "year"];
  return intervals.filter((interval) =>
    isPlanCheckoutAvailable(config, "unlimited", interval),
  );
}
