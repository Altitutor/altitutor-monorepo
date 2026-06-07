"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { completeUcatOnboarding } from "@/features/ucat-access/api/complete-onboarding";
import { useUcatAccess } from "@/features/ucat-access/hooks/use-ucat-access";
import { createUcatCheckoutSession } from "@/features/subscription/api/create-checkout";
import { fetchPublicSubscriptionConfig } from "@/features/subscription/api/fetch-public-subscription-config";
import { defaultPublicSubscriptionConfig } from "@/features/subscription/types/public-subscription-config";
import { formatMoneyFromMinorUnits } from "@/features/subscription/lib/format-subscription-copy";
import {
  computeMonthlyProMarketingPricing,
  computeWeeklyProMarketingPricing,
} from "@/features/subscription/lib/marketing-plan-pricing";
import type { UcatQuotaArea } from "@/features/ucat-access/types/quota";
import { UCAT_QUOTA_AREA_LABELS } from "@/features/ucat-access/types/quota";
import type { UcatCheckoutPlan } from "@/lib/ucat/subscription-plan";

const ONLINE_FEATURES = [
  "Full practice set library — all UCAT sections",
  "Full-length mock exams + percentile tracking",
  "Adaptive skill trainer with performance analytics",
  "Progress dashboard with session history",
  "Unlimited access across all areas",
] as const;

const FREE_QUOTA_AREAS: UcatQuotaArea[] = [
  "practice",
  "sets",
  "mocks",
  "learn",
  "skill_trainer",
];

function formatFreeQuotaLine(
  area: UcatQuotaArea,
  limit: number,
  period: "day" | "week" | "month",
): string {
  const label = UCAT_QUOTA_AREA_LABELS[area];
  if (limit <= 0) return `${label} — not included on Free`;
  return `${limit} ${label.toLowerCase()} per ${period}`;
}

type UsePlanPickerOptions = {
  onContinueFree?: () => void;
  onCheckoutStart?: () => void;
};

export function usePlanPicker(options: UsePlanPickerOptions = {}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const access = useUcatAccess();
  const needsOnboarding = !access.isLoading && !access.onboardingCompleted;
  const [cfg, setCfg] = useState(defaultPublicSubscriptionConfig);
  const [loadingPlan, setLoadingPlan] = useState<UcatCheckoutPlan | "free" | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const next = await fetchPublicSubscriptionConfig();
      if (!cancelled) setCfg(next);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleOnlineSubscribe = async (plan: UcatCheckoutPlan) => {
    setLoadingPlan(plan);
    setError(null);
    options.onCheckoutStart?.();
    try {
      const { url } = await createUcatCheckoutSession(plan);
      window.location.href = url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start checkout");
      setLoadingPlan(null);
    }
  };

  const proTrialEligible = access.proTrialEligible;
  const isOnFree = access.onlineTier === "free";
  const freeIsCurrentPlan = isOnFree && !needsOnboarding;
  const isOnPro =
    access.onlineTier === "pro" || access.onlineTier === "pro_trial";
  const proTrialCta = proTrialEligible ? "Free trial" : "Subscribe";
  const proTrialHint = proTrialEligible
    ? `${cfg.trialDays}-day trial — you won't be charged until day ${cfg.trialDays + 1}`
    : "Subscribe for unlimited access";

  const weeklyProPricing = computeWeeklyProMarketingPricing(cfg);
  const monthlyProPricing = computeMonthlyProMarketingPricing(cfg);

  const weeklyMonthlyEquivalent = cfg.basePriceCents * 4;
  const monthlySavingsPercent =
    weeklyMonthlyEquivalent > 0
      ? Math.max(
          0,
          Math.round(
            (1 - cfg.monthlyBasePriceCents / weeklyMonthlyEquivalent) * 100,
          ),
        )
      : 0;

  const handleContinueFree = async () => {
    setLoadingPlan("free");
    setError(null);
    try {
      await completeUcatOnboarding("free");
      await queryClient.invalidateQueries({ queryKey: ["ucat-access"] });
      options.onContinueFree?.();
      if (!options.onContinueFree) {
        router.push("/dashboard");
        router.refresh();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to continue with Free");
    } finally {
      setLoadingPlan(null);
    }
  };

  const handleFreePlanAction = async () => {
    if (freeIsCurrentPlan) {
      options.onContinueFree?.();
      if (!options.onContinueFree) {
        router.push("/dashboard");
      }
      return;
    }
    await handleContinueFree();
  };

  return {
    cfg,
    error,
    loadingPlan,
    freeIsCurrentPlan,
    isOnPro,
    proTrialCta,
    proTrialHint,
    weeklyProPricing,
    monthlyProPricing,
    monthlySavingsPercent,
    formatMoney: (cents: number) => formatMoneyFromMinorUnits(cents, cfg.currency),
    onlineFeatures: ONLINE_FEATURES,
    freeQuotaAreas: FREE_QUOTA_AREAS,
    formatFreeQuotaLine,
    handleFreePlanAction,
    handleOnlineSubscribe,
  };
}
