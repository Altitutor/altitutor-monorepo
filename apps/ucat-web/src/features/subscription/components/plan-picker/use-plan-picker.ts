"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import type { UcatBillingInterval, UcatPaidPlanTier } from "@altitutor/shared";
import { completeUcatOnboarding } from "@/features/ucat-access/api/complete-onboarding";
import { useUcatAccess } from "@/features/ucat-access/hooks/use-ucat-access";
import { useUcatProfile } from "@/features/layout/hooks/use-ucat-profile";
import { createUcatCheckoutSession } from "@/features/subscription/api/create-checkout";
import { fetchPublicSubscriptionConfig } from "@/features/subscription/api/fetch-public-subscription-config";
import {
  defaultPublicSubscriptionConfig,
  getPublicPlanPrice,
  getPublicPracticeDayDiscount,
  isPlanCheckoutAvailable,
  isTierOffered,
} from "@/features/subscription/types/public-subscription-config";
import {
  formatMoneyFromMinorUnits,
  isAustralianTimezone,
} from "@/features/subscription/lib/format-subscription-copy";
import {
  billedAtLabel,
  computeMarketingPlanPricing,
} from "@/features/subscription/lib/marketing-plan-pricing";
import type { UcatQuotaArea } from "@/features/ucat-access/types/quota";
import { UCAT_QUOTA_AREA_LABELS } from "@/features/ucat-access/types/quota";
import type { UcatCheckoutSelection } from "@/lib/ucat/subscription-plan";

const ONLINE_FEATURES = [
  "Full practice set library — all UCAT sections",
  "Full-length mock exams + percentile tracking",
  "Adaptive skill trainer with performance analytics",
  "Progress dashboard with session history",
  "Unlimited access across all areas",
] as const;

const PRO_FEATURES = [
  "1 online training workshop per month",
  "On-demand help from tutors",
  "1-1 performance review each month",
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

type LoadingKey = UcatPaidPlanTier | "free";

type UsePlanPickerOptions = {
  onContinueFree?: () => void;
  onCheckoutStart?: () => void;
  /** Marketing surfaces send users to signup instead of checkout */
  audience?: "app" | "marketing";
  checkoutReturnContext?: "signup_onboarding" | "subscribe";
};

export function usePlanPicker(options: UsePlanPickerOptions = {}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const access = useUcatAccess();
  const { data: profile } = useUcatProfile();
  const needsOnboarding = !access.isLoading && !access.onboardingCompleted;
  const [cfg, setCfg] = useState(defaultPublicSubscriptionConfig);
  const [billingInterval, setBillingInterval] =
    useState<UcatBillingInterval>("month");
  const [loadingPlan, setLoadingPlan] = useState<LoadingKey | null>(null);
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

  const omitAudPrefix = isAustralianTimezone(profile?.timezone);

  const formatMoney = (cents: number) =>
    formatMoneyFromMinorUnits(cents, cfg.currency, { omitAudPrefix });

  const unlimitedTrialEligible = access.unlimitedTrialEligible;
  const trialCta =
    options.checkoutReturnContext === "signup_onboarding"
      ? "Start free trial"
      : unlimitedTrialEligible
        ? "Free trial"
        : "Subscribe";
  const trialHint = unlimitedTrialEligible
    ? `${cfg.trialDays}-day trial — you won't be charged until day ${cfg.trialDays + 1}`
    : "Subscribe for unlimited access";

  const isOnFree = access.onlineTier === "free";
  const freeIsCurrentPlan = isOnFree && !needsOnboarding;
  const isOnPaid =
    access.onlineTier === "unlimited" ||
    access.onlineTier === "unlimited_trial" ||
    access.onlineTier === "pro";

  const practiceDiscount = useMemo(
    () => getPublicPracticeDayDiscount(cfg, billingInterval),
    [cfg, billingInterval],
  );

  const unlimitedPricing = useMemo(() => {
    const row = getPublicPlanPrice(cfg, "unlimited", billingInterval);
    if (!row || !practiceDiscount) return null;
    return computeMarketingPlanPricing(
      row.basePriceCents,
      billingInterval,
      practiceDiscount.discountPerDayCents,
      practiceDiscount.maxDiscountsPerPeriod,
    );
  }, [cfg, billingInterval, practiceDiscount]);

  const proPricing = useMemo(() => {
    const row = getPublicPlanPrice(cfg, "pro", billingInterval);
    if (!row || !practiceDiscount) return null;
    return computeMarketingPlanPricing(
      row.basePriceCents,
      billingInterval,
      practiceDiscount.discountPerDayCents,
      practiceDiscount.maxDiscountsPerPeriod,
    );
  }, [cfg, billingInterval, practiceDiscount]);

  const unlimitedAvailable = isPlanCheckoutAvailable(
    cfg,
    "unlimited",
    billingInterval,
  );
  const proAvailable = isPlanCheckoutAvailable(cfg, "pro", billingInterval);
  const unlimitedTierOffered = isTierOffered(cfg, "unlimited");
  const proTierOffered = isTierOffered(cfg, "pro");

  const handleOnlineSubscribe = async (tier: UcatPaidPlanTier) => {
    if (options.audience === "marketing") {
      router.push("/signup");
      return;
    }
    const selection: UcatCheckoutSelection = { tier, interval: billingInterval };
    setLoadingPlan(tier);
    setError(null);
    options.onCheckoutStart?.();
    try {
      const { url } = await createUcatCheckoutSession({
        ...selection,
        returnContext: options.checkoutReturnContext ?? "subscribe",
      });
      window.location.href = url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start checkout");
      setLoadingPlan(null);
    }
  };

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
    if (options.audience === "marketing") {
      router.push("/signup");
      return;
    }
    if (freeIsCurrentPlan) {
      return;
    }
    await handleContinueFree();
  };

  const billedAt = (periodCents: number) =>
    billedAtLabel(periodCents, billingInterval, formatMoney);

  return {
    cfg,
    error,
    loadingPlan,
    billingInterval,
    setBillingInterval,
    freeIsCurrentPlan,
    isOnPaid,
    isOnUnlimited:
      access.onlineTier === "unlimited" || access.onlineTier === "unlimited_trial",
    isOnPro: access.onlineTier === "pro",
    trialCta,
    trialHint,
    unlimitedPricing,
    proPricing,
    unlimitedAvailable,
    proAvailable,
    unlimitedTierOffered,
    proTierOffered,
    practiceDiscount,
    unlimitedTrialEligible,
    formatMoney,
    billedAt,
    onlineFeatures: ONLINE_FEATURES,
    proFeatures: PRO_FEATURES,
    freeQuotaAreas: FREE_QUOTA_AREAS,
    formatFreeQuotaLine,
    handleFreePlanAction,
    handleOnlineSubscribe,
  };
}
