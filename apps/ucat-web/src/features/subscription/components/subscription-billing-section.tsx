"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge, Skeleton } from "@altitutor/ui";
import {
  AlertTriangle,
  CreditCard,
  ExternalLink,
  Loader2,
  RefreshCw,
  XCircle,
} from "lucide-react";
import {
  createBillingPortalSession,
  type BillingPortalAction,
} from "@/features/subscription/api/create-billing-portal-session";
import { usePublicSubscriptionConfig } from "@/features/subscription/hooks/use-public-subscription-config";
import { useUcatSubscriptionBilling } from "@/features/subscription/hooks/use-ucat-subscription-billing";
import { SubscriptionInvoicesTable } from "@/features/subscription/components/subscription-invoices-table";
import {
  formatInvoiceDate,
  formatSubscriptionStatus,
} from "@/features/subscription/lib/invoice-display";
import { formatMoneyFromMinorUnits } from "@/features/subscription/lib/format-subscription-copy";
import { fetchPracticeDiscountProgress } from "@/features/subscription/api/fetch-practice-discount-progress";
import { computePracticeDiscountPricing } from "@/features/subscription/lib/pricing";
import { UCAT_ONLINE_TIER_LABELS } from "@/features/subscription/lib/plan-tier-display";
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
import type { UcatSubscriptionDetails } from "@/features/subscription/types/ucat-subscription-billing";
import {
  hasPaidUcatSubscriptionAccess,
  isUcatBillingRecoveryStatus,
  isUcatBillingTerminalStatus,
} from "@/lib/ucat/subscription-status";

function formatRetryDate(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return date.toLocaleString("en-AU", {
    timeZone: "Australia/Adelaide",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatSubscriptionPeriod(subscription: UcatSubscriptionDetails) {
  const start = subscription.current_period_start
    ? formatInvoiceDate(subscription.current_period_start.slice(0, 10))
    : "-";
  const end = subscription.current_period_end
    ? formatInvoiceDate(subscription.current_period_end.slice(0, 10))
    : "-";

  if (start === "-" && end === "-") return "-";
  return `${start} - ${end}`;
}

function formatSubscriptionPlan(subscription: UcatSubscriptionDetails) {
  if (!subscription.plan_tier) return "UCAT online";
  return (
    UCAT_ONLINE_TIER_LABELS[subscription.plan_tier] ??
    `UCAT ${subscription.plan_tier}`
  );
}

function PastSubscriptionsSection({
  subscriptions,
}: {
  subscriptions: UcatSubscriptionDetails[];
}) {
  if (subscriptions.length === 0) {
    return null;
  }

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-semibold tracking-tight">
        Past subscriptions
      </h2>
      <div className="space-y-3">
        {subscriptions.map((subscription) => (
          <div
            key={subscription.id}
            className={cn(
              "rounded-ucatShell flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between",
              UCAT_SURFACE_CARD,
            )}
          >
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium">
                  {formatSubscriptionPlan(subscription)}
                </p>
                <Badge variant="secondary">
                  {formatSubscriptionStatus(subscription.status)}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {formatSubscriptionPeriod(subscription)}
              </p>
            </div>
            {subscription.billing_interval ? (
              <p className="text-sm text-muted-foreground">
                {subscription.billing_interval}
              </p>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}

export function SubscriptionBillingSection() {
  const { data, isLoading, error } = useUcatSubscriptionBilling();
  const { openPlanPicker } = useUpsellDialog();
  const [portalAction, setPortalAction] =
    useState<BillingPortalAction | null>(null);
  const [portalError, setPortalError] = useState<string | null>(null);
  const { data: pricingConfig = defaultPublicSubscriptionConfig } =
    usePublicSubscriptionConfig();
  const [discountProgress, setDiscountProgress] = useState<{
    earned: number;
    cap: number;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const progress = await fetchPracticeDiscountProgress();
      if (!cancelled) {
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
  const subscriptions = data?.subscriptions ?? [];
  const invoices = data?.invoices ?? [];
  const hasPaidAccess =
    subscription != null && hasPaidUcatSubscriptionAccess(subscription.status);
  const pastSubscriptions = subscriptions.filter(
    (row) => row.id !== subscription?.id,
  );
  const isPaymentRecovery = subscription
    ? isUcatBillingRecoveryStatus(subscription.status)
    : false;
  const isTerminalBillingState = subscription
    ? isUcatBillingTerminalStatus(subscription.status)
    : false;
  const retryAt = formatRetryDate(
    subscription?.billing_recovery_next_attempt_at ?? null,
  );
  const recoveryInvoice = subscription?.billing_recovery_invoice_id
    ? (invoices.find(
        (invoice) =>
          invoice.stripe_invoice_id ===
          subscription.billing_recovery_invoice_id,
      ) ?? null)
    : null;

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

  const handlePortalAction = async (action: BillingPortalAction) => {
    setPortalAction(action);
    setPortalError(null);
    try {
      const { url } = await createBillingPortalSession(action);
      window.location.assign(url);
    } catch (e) {
      setPortalError(
        e instanceof Error ? e.message : "Failed to open billing portal",
      );
      setPortalAction(null);
    }
  };

  const handleFixPayment = async () => {
    if (recoveryInvoice?.hosted_invoice_url) {
      window.open(
        recoveryInvoice.hosted_invoice_url,
        "_blank",
        "noopener,noreferrer",
      );
      return;
    }
    await handlePortalAction("payment_method_update");
  };

  const handleChangePlan = async () => {
    if (subscription?.plan_tier === "pro") {
      await handlePortalAction("subscription_update");
      return;
    }

    openPlanPicker({
      title: "Change your plan",
      description: "Compare your current plan with UCAT Pro.",
    });
  };

  if (isLoading) {
    return (
      <div
        className="space-y-6"
        aria-busy="true"
        aria-label="Loading subscription"
      >
        <Skeleton className="h-48 w-full rounded-ucatShell" />
        <div className="space-y-4">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-24 w-full rounded-ucatShell" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-7 w-28" />
          <Skeleton className="h-56 w-full rounded-ucatShell" />
        </div>
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
      <div className="space-y-6">
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

        <PastSubscriptionsSection subscriptions={pastSubscriptions} />

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold tracking-tight">Invoices</h2>
          <SubscriptionInvoicesTable invoices={invoices} />
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {isPaymentRecovery ? (
        <div
          role="alert"
          className="rounded-ucatShell border border-amber-500/40 bg-amber-500/10 p-4 text-amber-950 dark:text-amber-100"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
              <div className="space-y-1">
                <p className="font-semibold">
                  {subscription.billing_recovery_requires_action
                    ? "Please confirm your payment"
                    : "Your payment didn’t go through"}
                </p>
                <p className="text-sm">
                  Your paid UCAT access continues temporarily while Stripe
                  retries. Fix the payment to avoid moving to Free.
                </p>
                {retryAt ? (
                  <p className="text-sm font-medium">
                    Next automatic attempt: {retryAt}
                  </p>
                ) : null}
              </div>
            </div>
            <Button
              type="button"
              className={cn("shrink-0", UCAT_PRIMARY_ACTION_BUTTON)}
              disabled={portalAction !== null}
              onClick={() => void handleFixPayment()}
            >
              {portalAction === "payment_method_update" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <ExternalLink className="mr-2 h-4 w-4" />
              )}
              {subscription.billing_recovery_requires_action
                ? "Confirm payment"
                : "Update payment method"}
            </Button>
          </div>
        </div>
      ) : null}

      {isTerminalBillingState ? (
        <div
          role="alert"
          className="rounded-ucatShell flex flex-col gap-4 border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <p className="font-semibold">Your paid UCAT access has ended</p>
            <p className="mt-1">
              We couldn’t recover the payment, so you’ve moved to Free. Your
              account, practice history and results are safe.
            </p>
          </div>
          <Button
            type="button"
            className={cn("shrink-0", UCAT_PRIMARY_ACTION_BUTTON)}
            disabled={portalAction !== null}
            onClick={() => void handlePortalAction("payment_method_update")}
          >
            {portalAction === "payment_method_update" ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <ExternalLink className="mr-2 h-4 w-4" />
            )}
            Review billing
          </Button>
        </div>
      ) : null}

      {isCancelScheduled && cancelEndDate ? (
        <div className="rounded-ucatShell border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-950 dark:text-amber-100">
          Your subscription is scheduled to cancel on{" "}
          <span className="font-semibold">
            {formatInvoiceDate(cancelEndDate)}
          </span>
          . You&apos;ll keep access until then.
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
              <Badge variant={hasPaidAccess ? "default" : "secondary"}>
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
                  off per day you answer {pricing.minQuestionsPerDay}+ questions
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
                    {discountProgress.earned} / {discountProgress.cap} practice
                    discounts earned
                  </p>
                ) : null}
              </div>
            ) : null}

            {hasPaidAccess &&
            subscription.current_period_end &&
            !isCancelScheduled &&
            !isPaymentRecovery ? (
              <p className="text-sm text-muted-foreground">
                Next billing date:{" "}
                {formatInvoiceDate(
                  subscription.current_period_end.slice(0, 10),
                )}
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2 sm:max-w-sm sm:justify-end">
            {!isPaymentRecovery && !isTerminalBillingState ? (
              <Button
                type="button"
                variant="outline"
                disabled={portalAction !== null || isCancelScheduled}
                onClick={() => void handleChangePlan()}
              >
                {portalAction === "subscription_update" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                Change plan
              </Button>
            ) : null}

            <Button
              type="button"
              className={UCAT_PRIMARY_ACTION_BUTTON}
              disabled={portalAction !== null}
              onClick={() =>
                void (isPaymentRecovery
                  ? handleFixPayment()
                  : handlePortalAction("payment_method_update"))
              }
            >
              {portalAction === "payment_method_update" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CreditCard className="mr-2 h-4 w-4" />
              )}
              {isPaymentRecovery
                ? subscription.billing_recovery_requires_action
                  ? "Confirm payment"
                  : "Update payment"
                : "Update payment method"}
            </Button>

            {!isPaymentRecovery && !isTerminalBillingState ? (
              <Button
                type="button"
                variant="ghost"
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                disabled={portalAction !== null}
                onClick={() =>
                  void handlePortalAction("subscription_cancel")
                }
              >
                {portalAction === "subscription_cancel" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <XCircle className="mr-2 h-4 w-4" />
                )}
                {isCancelScheduled ? "Review cancellation" : "Cancel plan"}
              </Button>
            ) : null}
          </div>
        </div>

        {portalError ? (
          <p className="mt-4 text-sm text-destructive">{portalError}</p>
        ) : null}
      </div>

      <PastSubscriptionsSection subscriptions={pastSubscriptions} />

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Invoices</h2>
        <SubscriptionInvoicesTable invoices={invoices} />
      </section>
    </div>
  );
}
