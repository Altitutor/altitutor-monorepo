"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@altitutor/ui";
import { ExternalLink, Loader2 } from "lucide-react";
import { UcatPageHeader } from "@/features/layout";
import { createBillingPortalSession } from "@/features/subscription/api/create-billing-portal-session";
import { fetchPublicSubscriptionConfig } from "@/features/subscription/api/fetch-public-subscription-config";
import { useUcatSubscriptionBilling } from "@/features/subscription/hooks/use-ucat-subscription-billing";
import { SubscriptionInvoicesTable } from "@/features/subscription/components/subscription-invoices-table";
import {
  formatInvoiceDate,
  formatSubscriptionStatus,
} from "@/features/subscription/lib/invoice-display";
import {
  formatMoneyFromMinorUnits,
} from "@/features/subscription/lib/format-subscription-copy";
import { computePracticeDiscountPricing } from "@/features/subscription/lib/pricing";
import {
  getSubscriptionEndDateIso,
  isSubscriptionCancelScheduled,
} from "@/lib/ucat/stripe-subscription-fields";
import { defaultPublicSubscriptionConfig } from "@/features/subscription/types/public-subscription-config";
import {
  UCAT_HEADER_BTN_OUTLINE,
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

export function SubscriptionManagementPage() {
  const { data, isLoading, error } = useUcatSubscriptionBilling();
  const [portalLoading, setPortalLoading] = useState(false);
  const [portalError, setPortalError] = useState<string | null>(null);
  const [pricingConfig, setPricingConfig] = useState(
    defaultPublicSubscriptionConfig,
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const cfg = await fetchPublicSubscriptionConfig();
      if (!cancelled) setPricingConfig(cfg);
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

  return (
    <div className="space-y-6">
      <UcatPageHeader
        title="Subscription"
        description="View your UCAT online subscription and billing history."
      />

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="rounded-ucatShell border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          Failed to load subscription details.
        </div>
      ) : !subscription ? (
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
          <Button asChild className="mt-4">
            <Link href="/subscribe">View plans</Link>
          </Button>
        </div>
      ) : (
        <>
          {isCancelScheduled && cancelEndDate ? (
            <div className="rounded-ucatShell border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-950 dark:text-amber-100">
              Your subscription is scheduled to cancel on{" "}
              <span className="font-semibold">
                {formatInvoiceDate(cancelEndDate)}
              </span>
              . You&apos;ll keep access until then. You can undo this in Stripe
              via Manage on Stripe.
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
                    UCAT Online Platform
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
                      / {pricing.billingIntervalNoun} if you hit your target
                      every day ({pricing.billingPeriodDays} days ×{" "}
                      {formatMoneyFromMinorUnits(
                        pricing.discountPerDayCents,
                        pricingConfig.currency,
                      )}
                      )
                    </p>
                  </div>
                ) : null}

                {isActive && subscription.current_period_end && !isCancelScheduled ? (
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
                variant="outline"
                className={UCAT_HEADER_BTN_OUTLINE}
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
            </div>

            {portalError ? (
              <p className="mt-4 text-sm text-destructive">{portalError}</p>
            ) : null}
          </div>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold tracking-tight">Invoices</h2>
            <SubscriptionInvoicesTable invoices={invoices} />
          </section>
        </>
      )}
    </div>
  );
}
