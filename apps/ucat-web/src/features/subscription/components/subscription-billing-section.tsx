"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@altitutor/ui";
import { ExternalLink, Loader2 } from "lucide-react";
import { createBillingPortalSession } from "@/features/subscription/api/create-billing-portal-session";
import { fetchPublicSubscriptionConfig } from "@/features/subscription/api/fetch-public-subscription-config";
import { useUcatSubscriptionBilling } from "@/features/subscription/hooks/use-ucat-subscription-billing";
import { SubscriptionInvoicesTable } from "@/features/subscription/components/subscription-invoices-table";
import {
  formatInvoiceDate,
  formatSubscriptionStatus,
} from "@/features/subscription/lib/invoice-display";
import { formatMoneyFromMinorUnits } from "@/features/subscription/lib/format-subscription-copy";
import { fetchPracticeDiscountProgress } from "@/features/subscription/api/fetch-practice-discount-progress";
import { computePracticeDiscountPricing } from "@/features/subscription/lib/pricing";
import {
  getSubscriptionEndDateIso,
  isSubscriptionCancelScheduled,
} from "@/lib/ucat/stripe-subscription-fields";
import { defaultPublicSubscriptionConfig } from "@/features/subscription/types/public-subscription-config";
import { useUpsellDialog } from "@/features/ucat-access/context/upsell-dialog-context";
import {
  UCAT_PRIMARY_ACTION_BUTTON,
  UCAT_SURFACE_CARD,
  UCAT_SURFACE_MOTION,
} from "@/lib/ucat-surface-motion";
import { cn } from "@/lib/utils";

const ACTIVE_SUBSCRIPTION_STATUSES = new Set([
  "active",
  "trialing",
  "past_due",
  "unpaid",
]);

export function SubscriptionBillingSection() {
  const { data, isLoading, error } = useUcatSubscriptionBilling();
  const { openPlanPicker } = useUpsellDialog();
  const [portalLoading, setPortalLoading] = useState(false);
  const [portalError, setPortalError] = useState<string | null>(null);
  const [pricingConfig, setPricingConfig] = useState(
    defaultPublicSubscriptionConfig,
  );
  const [discountProgress, setDiscountProgress] = useState<{
    earned: number;
    cap: number;
  } | null>(null);

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
        } else {
          setDiscountProgress(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const subscription = data?.subscription ?? null;
  const invoices = data?.invoices ?? [];
  const isActive =
    subscription != null &&
    ACTIVE_SUBSCRIPTION_STATUSES.has(subscription.status);

  const cancelEndDate = subscription
    ? getSubscriptionEndDateIso(subscription)
    : null;
  const isCancelScheduled = subscription
    ? isSubscriptionCancelScheduled(subscription)
    : false;

  const pricing = useMemo(() => {
    if (!subscription) return null;
    return computePracticeDiscountPricing(pricingConfig, subscription);
  }, [pricingConfig, subscription]);

  const handleManageOnStripe = async () => {
    setPortalLoading(true);
    setPortalError(null);
    try {
      const { url } = await createBillingPortalSession();
      window.open(url, "_blank", "noopener,noreferrer");
      setPortalLoading(false);
    } catch (e) {
      setPortalError(
        e instanceof Error ? e.message : "Failed to open billing portal",
      );
      setPortalLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-ucatShell border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        Failed to load subscription details.
      </div>
    );
  }

  if (!subscription) {
    return (
      <div
        className={cn(
          "rounded-ucatShell p-6",
          UCAT_SURFACE_CARD,
          UCAT_SURFACE_MOTION,
        )}
      >
        <p className="text-muted-foreground">
          You do not have an active UCAT online subscription yet.
        </p>
        <Button
          type="button"
          className={cn("mt-4", UCAT_PRIMARY_ACTION_BUTTON)}
          onClick={() => openPlanPicker({ title: "Choose your plan" })}
        >
          View plans
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {isCancelScheduled && cancelEndDate ? (
        <div className="rounded-ucatShell border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-950 dark:text-amber-100">
          Your subscription is scheduled to cancel on{" "}
          <span className="font-semibold">
            {formatInvoiceDate(cancelEndDate)}
          </span>
          . You&apos;ll keep access until then. You can undo this in Stripe via
          Manage.
        </div>
      ) : null}

      <div
        className={cn(
          "rounded-ucatShell p-6",
          UCAT_SURFACE_CARD,
          UCAT_SURFACE_MOTION,
        )}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-semibold tracking-tight">
                My subscription
              </h2>
              <Badge variant={isActive ? "default" : "secondary"}>
                {isCancelScheduled
                  ? "Canceling"
                  : formatSubscriptionStatus(subscription.status)}
              </Badge>
            </div>

            {pricing ? (
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>
                  <span className="font-medium text-foreground">
                    Standard price:{" "}
                  </span>
                  {formatMoneyFromMinorUnits(
                    pricing.standardPriceCents,
                    pricingConfig.currency,
                  )}{" "}
                  / {pricing.billingIntervalNoun}
                </p>
                <p>
                  <span className="font-medium text-foreground">
                    Practice discount:{" "}
                  </span>
                  {formatMoneyFromMinorUnits(
                    pricing.discountPerDayCents,
                    pricingConfig.currency,
                  )}{" "}
                  off per day you complete {pricing.minQuestionsPerDay}+
                  questions
                </p>
                <p>
                  <span className="font-medium text-foreground">
                    Best case this period:{" "}
                  </span>
                  {formatMoneyFromMinorUnits(
                    pricing.minimumPriceCents,
                    pricingConfig.currency,
                  )}{" "}
                  / {pricing.billingIntervalNoun} if you earn the maximum{" "}
                  {pricing.maxDiscountsPerPeriod} practice discounts (
                  {pricing.maxDiscountsPerPeriod} ×{" "}
                  {formatMoneyFromMinorUnits(
                    pricing.discountPerDayCents,
                    pricingConfig.currency,
                  )}
                  )
                </p>
                {discountProgress ? (
                  <p>
                    <span className="font-medium text-foreground">
                      This billing period:{" "}
                    </span>
                    {discountProgress.earned} / {discountProgress.cap}{" "}
                    practice discounts earned
                  </p>
                ) : null}
              </div>
            ) : null}

            {isActive &&
            subscription.current_period_end &&
            !isCancelScheduled ? (
              <p className="text-sm text-muted-foreground">
                Next billing date:{" "}
                {formatInvoiceDate(
                  subscription.current_period_end.slice(0, 10),
                )}
              </p>
            ) : null}
          </div>

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
            Manage
          </Button>
        </div>

        {portalError ? (
          <p className="mt-4 text-sm text-destructive">{portalError}</p>
        ) : null}
      </div>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Invoices</h2>
        <SubscriptionInvoicesTable invoices={invoices} />
      </section>
    </div>
  );
}
