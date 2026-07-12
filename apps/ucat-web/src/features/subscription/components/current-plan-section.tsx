"use client";

import { Badge, Button, Skeleton } from "@altitutor/ui";
import { useUcatAccess } from "@/features/ucat-access/hooks/use-ucat-access";
import { useUcatSubscriptionBilling } from "@/features/subscription/hooks/use-ucat-subscription-billing";
import { formatSubscriptionStatus } from "@/features/subscription/lib/invoice-display";
import {
  UCAT_CURRENT_PLAN_BENEFITS,
  UCAT_ONLINE_TIER_LABELS,
} from "@/features/subscription/lib/plan-tier-display";
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
  const { data, isLoading } = useUcatSubscriptionBilling();
  const { openPlanPicker } = useUpsellDialog();

  const subscription = data?.subscription ?? null;
  const displayKey = resolveCurrentPlanDisplayKey(
    access.onlineTier,
    subscription,
  );

  const isCancelScheduled = subscription
    ? isSubscriptionCancelScheduled(subscription)
    : false;

  if (access.isLoading || isLoading) {
    return <CurrentPlanSectionSkeleton />;
  }

  const benefits =
    UCAT_CURRENT_PLAN_BENEFITS[displayKey] ?? UCAT_CURRENT_PLAN_BENEFITS.free;

  return (
    <div
      className={cn(
        "rounded-ucatShell space-y-4 p-6",
        UCAT_SURFACE_CARD,
        UCAT_SURFACE_MOTION,
      )}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-xl font-semibold tracking-tight">Current plan</h2>
          <Badge variant={displayKey === "free" ? "secondary" : "default"}>
            {UCAT_ONLINE_TIER_LABELS[displayKey] ?? displayKey}
          </Badge>
          {subscription ? (
            <Badge variant="outline">
              {isCancelScheduled
                ? "Canceling"
                : formatSubscriptionStatus(subscription.status)}
            </Badge>
          ) : null}
        </div>
        <Button
          type="button"
          className={cn("shrink-0", UCAT_PRIMARY_ACTION_BUTTON)}
          onClick={() => openPlanPicker({ title: "Choose your plan" })}
        >
          View plans
        </Button>
      </div>

      <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
        {benefits.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </div>
  );
}
