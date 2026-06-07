import type { UcatFreeQuotaConfig } from "@/lib/ucat/quota/config";
import { DEFAULT_FREE_QUOTA_CONFIG } from "@/lib/ucat/quota/config";

export type PublicUcatSubscriptionConfig = {
  trialDays: number;
  minQuestionsPerDay: number;
  discountPerDayCents: number;
  basePriceCents: number;
  monthlyBasePriceCents: number;
  monthlyPlanAvailable: boolean;
  weeklyPlanAvailable: boolean;
  currency: string;
  billingInterval: "week" | "fortnight" | "month";
  freeQuotas: UcatFreeQuotaConfig;
};

/** Fallback when the public API is unavailable */
export const defaultPublicSubscriptionConfig: PublicUcatSubscriptionConfig = {
  trialDays: 7,
  minQuestionsPerDay: 20,
  discountPerDayCents: 1000,
  basePriceCents: 7500,
  monthlyBasePriceCents: 22500,
  monthlyPlanAvailable: false,
  weeklyPlanAvailable: false,
  currency: "aud",
  billingInterval: "week",
  freeQuotas: DEFAULT_FREE_QUOTA_CONFIG,
};
