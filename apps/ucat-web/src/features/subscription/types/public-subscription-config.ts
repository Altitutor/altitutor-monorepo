import type {
  UcatBillingInterval,
  UcatPaidPlanTier,
} from "@altitutor/shared";
import type { UcatFreeQuotaConfig } from "@/lib/ucat/quota/config";
import { DEFAULT_FREE_QUOTA_CONFIG } from "@/lib/ucat/quota/config";

export type PublicUcatPlanPrice = {
  tier: UcatPaidPlanTier;
  interval: UcatBillingInterval;
  basePriceCents: number;
  available: boolean;
};

export type PublicUcatSubscriptionConfig = {
  trialDays: number;
  minQuestionsPerDay: number;
  discountPerDayCents: number;
  currency: string;
  freeQuotas: UcatFreeQuotaConfig;
  planPrices: PublicUcatPlanPrice[];
  unlimitedProductConfigured: boolean;
  proProductConfigured: boolean;
};

/** Fallback when the public API is unavailable */
export const defaultPublicSubscriptionConfig: PublicUcatSubscriptionConfig = {
  trialDays: 7,
  minQuestionsPerDay: 20,
  discountPerDayCents: 1000,
  currency: "aud",
  freeQuotas: DEFAULT_FREE_QUOTA_CONFIG,
  planPrices: [],
  unlimitedProductConfigured: false,
  proProductConfigured: false,
};

export function getPublicPlanPrice(
  config: PublicUcatSubscriptionConfig,
  tier: UcatPaidPlanTier,
  interval: UcatBillingInterval,
): PublicUcatPlanPrice | undefined {
  return config.planPrices.find((p) => p.tier === tier && p.interval === interval);
}

export function isPlanCheckoutAvailable(
  config: PublicUcatSubscriptionConfig,
  tier: UcatPaidPlanTier,
  interval: UcatBillingInterval,
): boolean {
  const row = getPublicPlanPrice(config, tier, interval);
  if (!row?.available) return false;
  if (tier === "unlimited") return config.unlimitedProductConfigured;
  return config.proProductConfigured;
}

export function isTierOffered(
  config: PublicUcatSubscriptionConfig,
  tier: UcatPaidPlanTier,
): boolean {
  if (tier === "unlimited") return config.unlimitedProductConfigured;
  return config.proProductConfigured;
}
