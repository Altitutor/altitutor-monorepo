"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import type { UcatBillingInterval, UcatPaidPlanTier } from "@altitutor/shared";
import { useAuth } from "@/features/auth";
import { completeUcatOnboarding } from "@/features/ucat-access/api/complete-onboarding";
import { useUcatAccess } from "@/features/ucat-access/hooks/use-ucat-access";
import { useUcatProfile } from "@/features/layout/hooks/use-ucat-profile";
import { changeUcatSubscriptionTier } from "@/features/subscription/api/change-subscription-tier";
import { createUcatCheckoutSession } from "@/features/subscription/api/create-checkout";
import {
  fetchUcatUpgradePreview,
  type UcatUpgradePreview,
} from "@/features/subscription/api/fetch-upgrade-preview";
import { UCAT_SUBSCRIPTION_BILLING_QUERY_KEY } from "@/features/subscription/hooks/use-ucat-subscription-billing";
import { isSubscribedToPro } from "@/features/subscription/lib/resolve-subscribed-plan";
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
import { useToast } from "@altitutor/ui";
import { useUcatSubscriptionBilling } from "@/features/subscription/hooks/use-ucat-subscription-billing";
import { parseBillingInterval } from "@/features/subscription/lib/pricing";
import {
  canDowngradeToTier,
  type PlanPickerTier,
} from "@/features/subscription/lib/plan-tier-rank";

const SUBSCRIPTION_SETTINGS_PATH = "/settings/plan/subscription";

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
  onDowngradeNavigate?: () => void;
  /** Marketing surfaces send users to signup instead of checkout */
  audience?: "app" | "marketing";
  checkoutReturnContext?: "signup_onboarding" | "subscribe";
};

export function usePlanPicker(options: UsePlanPickerOptions = {}) {
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const access = useUcatAccess();
  const { data: profile } = useUcatProfile();
  const { data: billingData, isLoading: billingLoading } =
    useUcatSubscriptionBilling(options.audience === "app");
  const needsOnboarding = !access.isLoading && !access.onboardingCompleted;
  const [cfg, setCfg] = useState(defaultPublicSubscriptionConfig);
  const [configLoading, setConfigLoading] = useState(true);
  const [billingInterval, setBillingInterval] =
    useState<UcatBillingInterval>("month");
  const [loadingPlan, setLoadingPlan] = useState<LoadingKey | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [upgradeConfirmOpen, setUpgradeConfirmOpen] = useState(false);
  const [upgradePreview, setUpgradePreview] =
    useState<UcatUpgradePreview | null>(null);
  const [upgradePreviewLoading, setUpgradePreviewLoading] = useState(false);
  const [upgradePreviewError, setUpgradePreviewError] = useState<string | null>(
    null,
  );
  const [upgradeConfirming, setUpgradeConfirming] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const next = await fetchPublicSubscriptionConfig();
        if (!cancelled) setCfg(next);
      } finally {
        if (!cancelled) setConfigLoading(false);
      }
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

  const subscription = billingData?.subscription ?? null;
  const subscribedPlanTier = subscription?.plan_tier ?? null;

  const isOnPro =
    access.onlineTier === "pro" || isSubscribedToPro(subscription);
  const isOnUnlimitedTier =
    !isOnPro &&
    (access.onlineTier === "unlimited" ||
      access.onlineTier === "unlimited_trial" ||
      subscribedPlanTier === "unlimited");
  const isOnPaid = isOnPro || isOnUnlimitedTier;

  const isOnFree = !isOnPaid && access.onlineTier === "free";
  const freeIsCurrentPlan = isOnFree && !needsOnboarding;

  const subscriptionBillingInterval = parseBillingInterval(
    subscription?.billing_interval,
  );
  const lockBillingInterval = options.audience === "app" && isOnPaid;
  const showBillingIntervalSelector = !lockBillingInterval;

  useEffect(() => {
    if (lockBillingInterval && subscriptionBillingInterval) {
      setBillingInterval(subscriptionBillingInterval);
    }
  }, [lockBillingInterval, subscriptionBillingInterval]);

  const billingIntervalLoading =
    lockBillingInterval &&
    billingLoading &&
    subscriptionBillingInterval == null;
  const isPricingLoading = configLoading || billingIntervalLoading;

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

  const refetchSubscriptionState = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["ucat-access", user?.id] }),
      queryClient.invalidateQueries({
        queryKey: [...UCAT_SUBSCRIPTION_BILLING_QUERY_KEY],
      }),
      queryClient.refetchQueries({ queryKey: ["ucat-access", user?.id] }),
      queryClient.refetchQueries({
        queryKey: [...UCAT_SUBSCRIPTION_BILLING_QUERY_KEY],
      }),
    ]);
  }, [queryClient, user?.id]);

  const loadUpgradePreview = useCallback(async () => {
    setUpgradePreview(null);
    setUpgradePreviewError(null);
    setUpgradePreviewLoading(true);
    try {
      const preview = await fetchUcatUpgradePreview();
      setUpgradePreview(preview);
    } catch (e) {
      setUpgradePreviewError(
        e instanceof Error ? e.message : "Failed to load upgrade preview",
      );
    } finally {
      setUpgradePreviewLoading(false);
    }
  }, []);

  const openUpgradeConfirm = useCallback(async () => {
    setUpgradeConfirmOpen(true);
    await loadUpgradePreview();
  }, [loadUpgradePreview]);

  const confirmUpgradeToPro = useCallback(async () => {
    setUpgradeConfirming(true);
    setError(null);
    try {
      await changeUcatSubscriptionTier({ tier: "pro" });
      await refetchSubscriptionState();
      toast({
        title: "Upgraded to UCAT Pro",
        description:
          "Your Pro plan is updated. Any prorated charge will appear on your next invoice.",
      });
      setUpgradeConfirmOpen(false);
      options.onCheckoutStart?.();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to upgrade plan");
    } finally {
      setUpgradeConfirming(false);
      setLoadingPlan(null);
    }
  }, [options, refetchSubscriptionState, router, toast]);

  const handleOnlineSubscribe = async (tier: UcatPaidPlanTier) => {
    if (options.audience === "marketing") {
      router.push("/signup");
      return;
    }

    setLoadingPlan(tier);
    setError(null);

    if (isOnPaid) {
      if (tier === "pro" && isOnUnlimitedTier) {
        setLoadingPlan(null);
        await openUpgradeConfirm();
        return;
      }

      setError(
        tier === "unlimited"
          ? "To change to UCAT Unlimited, use the Subscription tab."
          : "You already have an active subscription.",
      );
      setLoadingPlan(null);
      return;
    }

    const selection: UcatCheckoutSelection = { tier, interval: billingInterval };
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

  const canDowngradeTo = (target: PlanPickerTier) =>
    canDowngradeToTier(access.onlineTier, target, subscribedPlanTier);

  const handleDowngrade = (_target: PlanPickerTier) => {
    toast({
      title: "Downgrade via Subscription settings",
      description:
        "To switch to a lower plan, manage your subscription on the Subscription tab.",
      action: {
        label: "Go to Subscription",
        onClick: () => {
          options.onDowngradeNavigate?.();
          router.push(SUBSCRIPTION_SETTINGS_PATH);
        },
      },
    });
  };

  return {
    cfg,
    error,
    loadingPlan,
    billingInterval,
    setBillingInterval,
    showBillingIntervalSelector,
    isPricingLoading,
    freeIsCurrentPlan,
    isOnPaid,
    isOnUnlimited: isOnUnlimitedTier,
    isOnPro,
    upgradeConfirmOpen,
    setUpgradeConfirmOpen,
    upgradePreview,
    upgradePreviewLoading,
    upgradePreviewError,
    upgradeConfirming,
    confirmUpgradeToPro,
    omitAudPrefix,
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
    canDowngradeTo,
    handleDowngrade,
  };
}
