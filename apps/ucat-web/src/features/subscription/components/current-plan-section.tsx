"use client";

import Link from "next/link";
import { Badge, Button } from "@altitutor/ui";
import { ExternalLink, Loader2 } from "lucide-react";
import { useUcatAccess } from "@/features/ucat-access/hooks/use-ucat-access";
import { useUcatSubscriptionBilling } from "@/features/subscription/hooks/use-ucat-subscription-billing";
import { createBillingPortalSession } from "@/features/subscription/api/create-billing-portal-session";
import { fetchPracticeDiscountProgress } from "@/features/subscription/api/fetch-practice-discount-progress";
import { fetchPublicSubscriptionConfig } from "@/features/subscription/api/fetch-public-subscription-config";
import { computePracticeDiscountPricing } from "@/features/subscription/lib/pricing";
import {
  formatInvoiceDate,
  formatSubscriptionStatus,
} from "@/features/subscription/lib/invoice-display";
import { formatMoneyFromMinorUnits } from "@/features/subscription/lib/format-subscription-copy";
import { defaultPublicSubscriptionConfig } from "@/features/subscription/types/public-subscription-config";
import {
  getSubscriptionEndDateIso,
  isSubscriptionCancelScheduled,
} from "@/lib/ucat/stripe-subscription-fields";
import {
  UCAT_PRIMARY_ACTION_BUTTON,
  UCAT_SURFACE_CARD,
  UCAT_SURFACE_MOTION,
} from "@/lib/ucat-surface-motion";
import { cn } from "@/lib/utils";
import { useEffect, useMemo, useState } from "react";

const TIER_LABELS: Record<string, string> = {
  free: "UCAT Free",
  unlimited_trial: "UCAT Unlimited (trial)",
  unlimited: "UCAT Unlimited",
  pro: "UCAT Pro",
};

const TIER_BENEFITS: Record<string, string[]> = {
  free: [
    "Limited daily access across practice, sets, mocks, learn, and skill trainer",
    "Upgrade anytime for unlimited access and practice-day discounts",
  ],
  unlimited_trial: [
    "Unlimited access to all online UCAT areas during your trial",
    "Earn practice-day billing discounts before your first charge",
    "Human-support entitlements begin when you convert to paid UCAT Pro",
  ],
  unlimited: [
    "Unlimited access to all online UCAT areas",
    "Practice-day discounts when you hit your daily question target",
    "Full practice library, mocks, skill trainer, and progress analytics",
  ],
  pro: [
    "Everything in UCAT Unlimited",
    "1 online training workshop per month",
    "On-demand help from tutors",
    "1-1 performance review each month",
  ],
};

export function CurrentPlanSection() {
  const access = useUcatAccess();
  const { data, isLoading } = useUcatSubscriptionBilling();
  const [pricingConfig, setPricingConfig] = useState(
    defaultPublicSubscriptionConfig,
  );
  const [discountProgress, setDiscountProgress] = useState<{
    earned: number;
    cap: number;
  } | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);

  const tier = access.onlineTier ?? "free";
  const subscription = data?.subscription ?? null;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [cfg, progress] = await Promise.all([
        fetchPublicSubscriptionConfig(),
        fetchPracticeDiscountProgress(),
      ]);
      if (!cancelled) {
        setPricingConfig(cfg);
        if (progress && progress.cap > 0) {
          setDiscountProgress({ earned: progress.earned, cap: progress.cap });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const pricing = useMemo(() => {
    if (!subscription) return null;
    return computePracticeDiscountPricing(pricingConfig, subscription);
  }, [pricingConfig, subscription]);

  const cancelEndDate = subscription ? getSubscriptionEndDateIso(subscription) : null;
  const isCancelScheduled = subscription
    ? isSubscriptionCancelScheduled(subscription)
    : false;

  const handleManageOnStripe = async () => {
    setPortalLoading(true);
    try {
      const { url } = await createBillingPortalSession();
      window.open(url, "_blank", "noopener,noreferrer");
    } finally {
      setPortalLoading(false);
    }
  };

  if (access.isLoading || isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const benefits = TIER_BENEFITS[tier] ?? TIER_BENEFITS.free;

  return (
    <div
      className={cn("rounded-ucatShell p-6 space-y-4", UCAT_SURFACE_CARD, UCAT_SURFACE_MOTION)}
    >
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-xl font-semibold tracking-tight">Current plan</h2>
        <Badge variant={tier === "free" ? "secondary" : "default"}>
          {TIER_LABELS[tier] ?? tier}
        </Badge>
        {subscription ? (
          <Badge variant="outline">
            {isCancelScheduled
              ? "Canceling"
              : formatSubscriptionStatus(subscription.status)}
          </Badge>
        ) : null}
      </div>

      <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
        {benefits.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>

      {subscription && pricing ? (
        <div className="space-y-2 border-t pt-4 text-sm text-muted-foreground">
          <p>
            <span className="font-medium text-foreground">Billing: </span>
            {formatMoneyFromMinorUnits(pricing.standardPriceCents, pricingConfig.currency)}{" "}
            / {pricing.billingIntervalNoun}
          </p>
          {discountProgress ? (
            <p>
              <span className="font-medium text-foreground">Practice discounts: </span>
              {discountProgress.earned} / {discountProgress.cap} earned this period
            </p>
          ) : null}
          {isCancelScheduled && cancelEndDate ? (
            <p className="text-amber-700 dark:text-amber-300">
              Scheduled to cancel on {formatInvoiceDate(cancelEndDate)}
            </p>
          ) : subscription.current_period_end ? (
            <p>
              Next billing:{" "}
              {formatInvoiceDate(subscription.current_period_end.slice(0, 10))}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-3 border-t pt-4">
        {subscription ? (
          <>
            <Button
              type="button"
              className={UCAT_PRIMARY_ACTION_BUTTON}
              disabled={portalLoading}
              onClick={() => void handleManageOnStripe()}
            >
              {portalLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <ExternalLink className="mr-2 h-4 w-4" />
              )}
              Manage on Stripe
            </Button>
            <Button type="button" variant="outline" asChild>
              <Link href="#invoices">View invoices</Link>
            </Button>
          </>
        ) : null}
      </div>
    </div>
  );
}
