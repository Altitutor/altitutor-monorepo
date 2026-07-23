"use client";

import { Badge, Skeleton } from "@altitutor/ui";
import { Button } from "@/components/ui/button";
import { ArrowRight, Check, Sparkles } from "lucide-react";
import { useUcatAccess } from "@/features/ucat-access/hooks/use-ucat-access";
import { FreePlanQuotaLimitsCard } from "@/features/subscription/components/free-plan-quota-limits-card";
import { useUcatSubscriptionBilling } from "@/features/subscription/hooks/use-ucat-subscription-billing";
import { formatSubscriptionStatus } from "@/features/subscription/lib/invoice-display";
import { UCAT_ONLINE_TIER_LABELS } from "@/features/subscription/lib/plan-tier-display";
import { resolveCurrentPlanDisplayKey } from "@/features/subscription/lib/resolve-subscribed-plan";
import { isSubscriptionCancelScheduled } from "@/lib/ucat/stripe-subscription-fields";
import { useUpsellDialog } from "@/features/ucat-access/context/upsell-dialog-context";
import {
  UCAT_PRIMARY_ACTION_BUTTON,
  UCAT_SURFACE_CARD,
  UCAT_SURFACE_MOTION,
} from "@/lib/ucat-surface-motion";
import { cn } from "@/lib/utils";

function CurrentPlanSectionSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading current plan">
      <Skeleton className="h-40 w-full rounded-ucatShell" />
    </div>
  );
}

export function CurrentPlanSection() {
  const access = useUcatAccess();
  const { data, isLoading, isPending, isError } = useUcatSubscriptionBilling();
  const { openPlanPicker } = useUpsellDialog();

  const subscription =
    data?.subscription ??
    data?.subscriptions.find((row) =>
      ["trialing", "active", "past_due", "unpaid"].includes(row.status),
    ) ??
    null;
  const displayKey = resolveCurrentPlanDisplayKey(
    access.onlineTier,
    subscription,
  );

  const isCancelScheduled = subscription
    ? isSubscriptionCancelScheduled(subscription)
    : false;

  const billingAwaiting = isLoading || (isPending && !data && !isError);

  if (access.isLoading || billingAwaiting) {
    return <CurrentPlanSectionSkeleton />;
  }

  const planName = UCAT_ONLINE_TIER_LABELS[displayKey] ?? displayKey;
  const isFree = displayKey === "free";
  const planSummary = isFree
    ? "Build your UCAT routine with daily access across the platform."
    : "Unlimited access to the entire Altitutor UCAT platform.";
  const planHighlights = isFree
    ? ["Daily practice access", "Progress saved", "Upgrade anytime"]
    : [
        "Unlimited online access",
        "All mocks and analytics",
        "Practice discounts",
      ];

  return (
    <div className="space-y-4">
      <section
        className={cn(
          "rounded-ucatShell overflow-hidden",
          UCAT_SURFACE_CARD,
          UCAT_SURFACE_MOTION,
        )}
      >
        <div className="relative overflow-hidden border-b border-border/60 bg-gradient-to-br from-primary/[0.09] via-background to-accent/[0.08] p-6 sm:p-8">
          <div className="absolute -right-12 -top-16 h-44 w-44 rounded-full bg-primary/10 blur-3xl" />
          <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
                <Sparkles className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Current plan
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                    {planName}
                  </h2>
                  {isFree ? (
                    <Badge variant="secondary">Free</Badge>
                  ) : subscription ? (
                    <Badge variant={isCancelScheduled ? "outline" : "default"}>
                      {isCancelScheduled
                        ? "Switching to Free"
                        : formatSubscriptionStatus(subscription.status)}
                    </Badge>
                  ) : (
                    <Badge variant="secondary">Active</Badge>
                  )}
                </div>
                <p className="max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
                  {planSummary}
                </p>
              </div>
            </div>
            <Button
              type="button"
              className={cn("shrink-0", UCAT_PRIMARY_ACTION_BUTTON)}
              onClick={() => openPlanPicker({ title: "Choose your plan" })}
            >
              {isFree ? "Explore paid plans" : "Change plan"}
              <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </div>

        <ul className="grid gap-3 p-5 sm:grid-cols-3 sm:p-6">
          {planHighlights.map((highlight) => (
            <li
              key={highlight}
              className="flex items-center gap-2.5 rounded-xl bg-muted/40 px-3 py-2.5 text-sm font-medium"
            >
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Check className="h-3 w-3" aria-hidden="true" />
              </span>
              {highlight}
            </li>
          ))}
        </ul>
      </section>
      {isFree ? <FreePlanQuotaLimitsCard /> : null}
    </div>
  );
}
