import {
  defaultPublicSubscriptionConfig,
  type PublicUcatPlanPrice,
  type PublicUcatSubscriptionConfig,
} from "@/features/subscription/types/public-subscription-config";
import type { UcatFreeQuotaConfig } from "@/lib/ucat/quota/config";
import { DEFAULT_FREE_QUOTA_CONFIG } from "@/lib/ucat/quota/config";
import {
  isUcatBillingInterval,
  isUcatPaidPlanTier,
} from "@altitutor/shared";

function isFreeQuotas(value: unknown): value is UcatFreeQuotaConfig {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  const areas = ["practice", "sets", "mocks", "learn", "skill_trainer"] as const;
  return areas.every((area) => {
    const entry = v[area];
    if (!entry || typeof entry !== "object") return false;
    const row = entry as Record<string, unknown>;
    return (
      typeof row.limit === "number" &&
      (row.period === "day" || row.period === "week" || row.period === "month")
    );
  });
}

function parsePlanPrices(value: unknown): PublicUcatPlanPrice[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((row) => {
    if (!row || typeof row !== "object") return [];
    const r = row as Record<string, unknown>;
    if (
      !isUcatPaidPlanTier(r.tier) ||
      !isUcatBillingInterval(r.interval) ||
      typeof r.basePriceCents !== "number"
    ) {
      return [];
    }
    return [
      {
        tier: r.tier,
        interval: r.interval,
        basePriceCents: r.basePriceCents,
        available: r.available === true,
      },
    ];
  });
}

export async function fetchPublicSubscriptionConfig(): Promise<PublicUcatSubscriptionConfig> {
  try {
    const res = await fetch("/api/ucat/subscription-config", {
      method: "GET",
      credentials: "same-origin",
    });
    if (!res.ok) return defaultPublicSubscriptionConfig;
    const data = (await res.json()) as Partial<PublicUcatSubscriptionConfig>;
    if (
      typeof data.trialDays !== "number" ||
      typeof data.minQuestionsPerDay !== "number" ||
      typeof data.discountPerDayCents !== "number"
    ) {
      return defaultPublicSubscriptionConfig;
    }
    return {
      trialDays: data.trialDays,
      minQuestionsPerDay: data.minQuestionsPerDay,
      discountPerDayCents: data.discountPerDayCents,
      currency: (typeof data.currency === "string"
        ? data.currency
        : defaultPublicSubscriptionConfig.currency
      ).toLowerCase(),
      freeQuotas: isFreeQuotas(data.freeQuotas)
        ? data.freeQuotas
        : DEFAULT_FREE_QUOTA_CONFIG,
      planPrices: parsePlanPrices(data.planPrices),
      unlimitedProductConfigured: data.unlimitedProductConfigured === true,
      proProductConfigured: data.proProductConfigured === true,
    };
  } catch {
    return defaultPublicSubscriptionConfig;
  }
}
