"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Badge,
  Skeleton,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@altitutor/ui";
import {
  AlertTriangle,
  CalendarDays,
  CircleDollarSign,
  CreditCard,
  ExternalLink,
  Info,
  Loader2,
  RefreshCw,
  Sparkles,
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
import {
  computePracticeDiscountBillSnapshot,
  computePracticeDiscountPricing,
} from "@/features/subscription/lib/pricing";
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
import {
  cancelUcatSubscriptionImmediately,
  resumeUcatSubscription,
} from "@/features/subscription/api/change-subscription-cancellation";
import { trackSubscriptionJourneyEvent } from "@/features/subscription/api/track-subscription-journey";
import { ImmediatePlanCancellationDialog } from "@/features/subscription/components/immediate-plan-cancellation-dialog";
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

function MetricInfoTooltip({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="inline-flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            aria-label={label}
          >
            <Info className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </TooltipTrigger>
        <TooltipContent
          side="top"
          className="max-w-[290px] text-sm leading-relaxed"
        >
          {children}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
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
  const queryClient = useQueryClient();
  const { data, isLoading, error, refetch } = useUcatSubscriptionBilling();
  const { openPlanPicker } = useUpsellDialog();
  const [portalAction, setPortalAction] = useState<BillingPortalAction | null>(
    null,
  );
  const [portalError, setPortalError] = useState<string | null>(null);
  const [resumeLoading, setResumeLoading] = useState(false);
  const [resumeError, setResumeError] = useState<string | null>(null);
  const [immediateCancelOpen, setImmediateCancelOpen] = useState(false);
  const [immediateCancelLoading, setImmediateCancelLoading] = useState(false);
  const [immediateCancelError, setImmediateCancelError] = useState<
    string | null
  >(null);
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
  const billSnapshot = useMemo(
    () =>
      pricing
        ? computePracticeDiscountBillSnapshot(pricing, discountProgress)
        : null,
    [discountProgress, pricing],
  );

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

  const handleChangePlan = () => {
    openPlanPicker({
      title: "Change your plan",
      description: "Compare UCAT Free, Unlimited and Pro.",
    });
  };

  const handleKeepPaidPlan = async () => {
    setResumeLoading(true);
    setResumeError(null);
    try {
      await resumeUcatSubscription();
      trackSubscriptionJourneyEvent({
        eventType: "cancellation_reversed",
        journeyContext: "subscription_settings",
        metadata: { current_plan: subscription?.plan_tier ?? null },
      });
      await refetch();
    } catch (e) {
      setResumeError(
        e instanceof Error ? e.message : "Failed to keep your paid plan",
      );
    } finally {
      setResumeLoading(false);
    }
  };

  const handleCancelImmediately = async () => {
    setImmediateCancelLoading(true);
    setImmediateCancelError(null);
    try {
      await cancelUcatSubscriptionImmediately();
      trackSubscriptionJourneyEvent({
        eventType: "cancellation_accelerated",
        journeyContext: "subscription_settings",
        metadata: { previous_plan: subscription?.plan_tier ?? null },
      });
      await Promise.all([
        refetch(),
        queryClient.invalidateQueries({ queryKey: ["ucat-access"] }),
      ]);
      setImmediateCancelOpen(false);
    } catch (e) {
      setImmediateCancelError(
        e instanceof Error ? e.message : "Failed to switch to UCAT Free now",
      );
    } finally {
      setImmediateCancelLoading(false);
    }
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
        <div
          role="alert"
          className="rounded-ucatShell flex flex-col gap-3 border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-950 sm:flex-row sm:items-center sm:justify-between dark:text-amber-100"
        >
          <div>
            <p>
              You&apos;re switching to UCAT Free on{" "}
              <span className="font-semibold">
                {formatInvoiceDate(cancelEndDate)}
              </span>
              . You&apos;ll keep paid access until then.
            </p>
            {resumeError ? (
              <p className="mt-1 text-destructive">{resumeError}</p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2 sm:justify-end">
            <Button
              type="button"
              variant="ghost"
              className="shrink-0 text-amber-950 hover:bg-amber-500/15 hover:text-amber-950 dark:text-amber-100 dark:hover:text-amber-100"
              disabled={resumeLoading}
              onClick={() => {
                setImmediateCancelError(null);
                setImmediateCancelOpen(true);
              }}
            >
              Switch now
            </Button>
            <Button
              type="button"
              variant="outline"
              className="shrink-0"
              disabled={resumeLoading}
              onClick={() => void handleKeepPaidPlan()}
            >
              {resumeLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Keep paid plan
            </Button>
          </div>
        </div>
      ) : null}

      <section
        className={cn(
          "rounded-ucatShell overflow-hidden",
          UCAT_SURFACE_CARD,
          UCAT_SURFACE_MOTION,
        )}
      >
        <div className="relative overflow-hidden border-b border-border/60 bg-gradient-to-br from-primary/[0.09] via-background to-accent/[0.08] p-6 sm:p-8">
          <div className="absolute -right-12 -top-16 h-44 w-44 rounded-full bg-primary/10 blur-3xl" />
          <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                My subscription
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                  {formatSubscriptionPlan(subscription)}
                </h2>
                <Badge variant={hasPaidAccess ? "default" : "secondary"}>
                  {isCancelScheduled
                    ? "Switching to Free"
                    : formatSubscriptionStatus(subscription.status)}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {isCancelScheduled
                  ? cancelEndDate
                    ? `Paid access until ${formatInvoiceDate(cancelEndDate)}`
                    : "Your subscription will switch to UCAT Free."
                  : "Your plan, renewal and practice rewards at a glance."}
              </p>
            </div>
            {pricing && billSnapshot ? (
              <div className="sm:text-right">
                {billSnapshot.earnedDiscountCents > 0 ? (
                  <p className="text-sm text-muted-foreground line-through decoration-muted-foreground/70">
                    {formatMoneyFromMinorUnits(
                      pricing.standardPriceCents,
                      pricingConfig.currency,
                    )}
                  </p>
                ) : null}
                <p className="text-3xl font-semibold tracking-tight tabular-nums">
                  {formatMoneyFromMinorUnits(
                    billSnapshot.projectedBillCents,
                    pricingConfig.currency,
                  )}
                </p>
                <p className="text-sm text-muted-foreground">
                  estimated next bill / {pricing.billingIntervalNoun}
                </p>
              </div>
            ) : null}
          </div>
        </div>

        {pricing && billSnapshot ? (
          <div className="grid gap-px border-b border-border/60 bg-border/60 sm:grid-cols-3">
            <div className="bg-background p-5">
              <div className="flex items-center gap-2 text-muted-foreground">
                <CalendarDays className="h-4 w-4" aria-hidden="true" />
                <p className="text-xs font-semibold uppercase tracking-wide">
                  {isCancelScheduled ? "Paid access until" : "Next renewal"}
                </p>
              </div>
              <p className="mt-2 font-semibold">
                {subscription.current_period_end
                  ? formatInvoiceDate(
                      subscription.current_period_end.slice(0, 10),
                    )
                  : "Not scheduled"}
              </p>
            </div>
            <div className="bg-background p-5">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Sparkles className="h-4 w-4" aria-hidden="true" />
                <p className="text-xs font-semibold uppercase tracking-wide">
                  Practice days
                </p>
                <MetricInfoTooltip label="How practice days reduce your bill">
                  Answer {pricing.minQuestionsPerDay}+ questions in a day to
                  earn{" "}
                  {formatMoneyFromMinorUnits(
                    pricing.discountPerDayCents,
                    pricingConfig.currency,
                  )}{" "}
                  off your next bill. You can earn this on up to{" "}
                  {billSnapshot.availableDays} days this billing cycle.
                </MetricInfoTooltip>
              </div>
              <p className="mt-2 font-semibold">
                {billSnapshot.earnedDays} of {billSnapshot.availableDays} earned
              </p>
            </div>
            <div className="bg-background p-5">
              <div className="flex items-center gap-2 text-muted-foreground">
                <CircleDollarSign className="h-4 w-4" aria-hidden="true" />
                <p className="text-xs font-semibold uppercase tracking-wide">
                  Discount still available
                </p>
                <MetricInfoTooltip label="How much more discount you can earn">
                  This is the additional amount you can still take off your next
                  bill before this billing cycle ends. Each qualifying practice
                  day reduces it by{" "}
                  {formatMoneyFromMinorUnits(
                    pricing.discountPerDayCents,
                    pricingConfig.currency,
                  )}
                  .
                </MetricInfoTooltip>
              </div>
              <p className="mt-2 font-semibold tabular-nums">
                {formatMoneyFromMinorUnits(
                  billSnapshot.remainingDiscountCents,
                  pricingConfig.currency,
                )}{" "}
                left to earn
              </p>
            </div>
          </div>
        ) : null}

        <div className="space-y-5 p-5 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Manage your plan here. Payment details open securely in Stripe.
            </p>
            <div className="flex flex-wrap gap-2 sm:justify-end">
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
            </div>
          </div>

          {portalError ? (
            <p className="text-sm text-destructive">{portalError}</p>
          ) : null}
        </div>
      </section>

      {cancelEndDate ? (
        <ImmediatePlanCancellationDialog
          open={immediateCancelOpen}
          onOpenChange={(open) => {
            if (!immediateCancelLoading) {
              setImmediateCancelOpen(open);
            }
          }}
          scheduledEndDate={formatInvoiceDate(cancelEndDate)}
          confirming={immediateCancelLoading}
          error={immediateCancelError}
          onConfirm={() => void handleCancelImmediately()}
        />
      ) : null}

      <PastSubscriptionsSection subscriptions={pastSubscriptions} />

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Invoices</h2>
        <SubscriptionInvoicesTable invoices={invoices} />
      </section>
    </div>
  );
}
