import {
  defaultPublicSubscriptionConfig,
  type PublicUcatSubscriptionConfig,
} from "@/features/subscription/types/public-subscription-config";
import type { UcatFreeQuotaConfig } from "@/lib/ucat/quota/config";
import { DEFAULT_FREE_QUOTA_CONFIG } from "@/lib/ucat/quota/config";

const BILLING: PublicUcatSubscriptionConfig["billingInterval"][] = [
  "week",
  "fortnight",
  "month",
];

function isBillingInterval(
  v: unknown,
): v is PublicUcatSubscriptionConfig["billingInterval"] {
  return typeof v === "string" && (BILLING as readonly string[]).includes(v);
}

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
    const basePriceCents =
      typeof data.basePriceCents === "number"
        ? data.basePriceCents
        : defaultPublicSubscriptionConfig.basePriceCents;
    const billingInterval = isBillingInterval(data.billingInterval)
      ? data.billingInterval
      : defaultPublicSubscriptionConfig.billingInterval;
    return {
      trialDays: data.trialDays,
      minQuestionsPerDay: data.minQuestionsPerDay,
      discountPerDayCents: data.discountPerDayCents,
      basePriceCents,
      currency: (typeof data.currency === "string"
        ? data.currency
        : defaultPublicSubscriptionConfig.currency
      ).toLowerCase(),
      billingInterval,
      freeQuotas: isFreeQuotas(data.freeQuotas)
        ? data.freeQuotas
        : DEFAULT_FREE_QUOTA_CONFIG,
    };
  } catch {
    return defaultPublicSubscriptionConfig;
  }
}
