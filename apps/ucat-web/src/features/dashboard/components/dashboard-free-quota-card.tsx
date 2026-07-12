"use client";

import Link from "next/link";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Skeleton,
  useToast,
} from "@altitutor/ui";
import { useQuotaLimitDialog } from "@/features/ucat-access/context/upsell-dialog-context";
import { useUpsellDialog } from "@/features/ucat-access/context/upsell-dialog-context";
import { QuotaAreaInfoButton } from "@/features/ucat-access/components/quota-area-info-button";
import { QuotaProgressBar } from "@/features/ucat-access/components/quota-usage-card";
import { useQuotaUsage } from "@/features/ucat-access/hooks/use-quota-usage";
import { useUcatAccess } from "@/features/ucat-access/hooks/use-ucat-access";
import { formatQuotaUsageLabel } from "@/features/ucat-access/lib/format-quota-period";
import { UcatHoverChevron } from "@/lib/ucat-hover-chevron";
import {
  UCAT_ONLINE_TIER_LABELS,
  UCAT_PLAN_TIER_BADGE_CLASS,
} from "@/features/subscription/lib/plan-tier-display";
import {
  UCAT_CARD_CHROME,
  UCAT_PRESSABLE_LIFT_HOVER,
  UCAT_PRIMARY_ACTION_BUTTON_SM,
  UCAT_SURFACE_MOTION,
} from "@/lib/ucat-surface-motion";
import { cn } from "@/lib/utils";

export function DashboardFreeQuotaCard() {
  const access = useUcatAccess();
  const { data, isLoading, isError } = useQuotaUsage();
  const { openQuotaLimit } = useQuotaLimitDialog();
  const { openPlanPicker } = useUpsellDialog();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const [usingReset, setUsingReset] = useState(false);

  const accessIndicatesFree =
    !access.isLoading && access.onlineTier === "free" && !access.isQuotaExempt;
  const quotaIndicatesFree =
    !isLoading &&
    !isError &&
    data?.onlineTier === "free" &&
    !data.isQuotaExempt;
  const isFreeTier = accessIndicatesFree || quotaIndicatesFree;

  const enabledAreas = data?.areas.filter((entry) => !entry.disabled) ?? [];

  if (!access.isLoading && !isLoading && !isFreeTier) {
    return null;
  }

  if (access.isLoading || isLoading) {
    return <Skeleton className="h-[220px] rounded-ucatShell" />;
  }

  if (isError || !data || data.isQuotaExempt || data.onlineTier !== "free") {
    return null;
  }

  const areas = enabledAreas;
  if (areas.length === 0) return null;

  const anyAtLimit = areas.some((entry) => entry.atLimit);
  const availableResetCount = data.quotaResetEntitlement.availableCount;
  const nextResetExpiry = data.quotaResetEntitlement.nextExpiresAt
    ? new Intl.DateTimeFormat("en-AU", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(data.quotaResetEntitlement.nextExpiresAt))
    : null;

  const handleUpsell = () => {
    const target = areas.find((entry) => entry.atLimit) ?? areas[0];
    if (target?.atLimit) {
      openQuotaLimit({
        code: "QUOTA_EXCEEDED",
        area: target.area,
        used: target.used,
        limit: target.limit,
        period: target.period,
      });
      return;
    }
    openPlanPicker({
      title: "Upgrade to UCAT Unlimited",
      description:
        "Compare Free, Unlimited, and Pro plans with accountability pricing.",
    });
  };

  const handleUseReset = async () => {
    setUsingReset(true);
    try {
      const response = await fetch("/api/ucat/quota-reset-entitlements/use", {
        method: "POST",
      });
      const body = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!response.ok) {
        throw new Error(body.error ?? "Failed to use quota reset");
      }
      await queryClient.invalidateQueries({ queryKey: ["ucat-quota-usage"] });
      toast({ title: "Quota reset applied" });
      setConfirmResetOpen(false);
    } catch (error) {
      toast({
        title: "Could not use quota reset",
        description:
          error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setUsingReset(false);
    }
  };

  return (
    <>
      <Card className={UCAT_CARD_CHROME}>
        <CardHeader className="space-y-1 pb-2">
          <div className="flex flex-row items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="text-base font-medium">
                  Your free quotas
                </CardTitle>
                <Badge className={UCAT_PLAN_TIER_BADGE_CLASS}>
                  {UCAT_ONLINE_TIER_LABELS.free}
                </Badge>
              </div>
              <p className="text-sm font-normal text-muted-foreground">
                Limits reset daily, weekly, or monthly per area.
              </p>
            </div>
            <Link
              href="/settings/plan"
              className={cn(
                "group -m-1 shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/25 focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:focus-visible:ring-white/35",
                UCAT_SURFACE_MOTION,
                UCAT_PRESSABLE_LIFT_HOVER,
              )}
              aria-label="Manage plan"
            >
              <UcatHoverChevron className="h-5 w-5" />
            </Link>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <ul className="space-y-3">
            {areas.map((entry) => (
              <li key={entry.area} className="space-y-1.5">
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="inline-flex min-w-0 items-center gap-1.5 font-medium">
                    <span className="truncate">{entry.label}</span>
                    <QuotaAreaInfoButton
                      area={entry.area}
                      label={entry.label}
                    />
                  </span>
                  <span
                    className={cn(
                      "tabular-nums text-muted-foreground",
                      entry.atLimit && "font-medium text-destructive",
                    )}
                  >
                    {formatQuotaUsageLabel(
                      entry.used,
                      entry.limit,
                      entry.period,
                    )}
                  </span>
                </div>
                <QuotaProgressBar
                  used={entry.used}
                  limit={entry.limit}
                  atLimit={entry.atLimit}
                />
              </li>
            ))}
          </ul>
          {availableResetCount > 0 ? (
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium">
                    {availableResetCount} quota reset
                    {availableResetCount === 1 ? "" : "s"} available
                  </p>
                  {nextResetExpiry ? (
                    <p className="text-xs text-muted-foreground">
                      Next expires {nextResetExpiry}
                    </p>
                  ) : null}
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setConfirmResetOpen(true)}
                >
                  Use reset
                </Button>
              </div>
            </div>
          ) : null}
          <div className="flex flex-wrap gap-2 pt-1">
            <Button
              type="button"
              size="sm"
              className={UCAT_PRIMARY_ACTION_BUTTON_SM}
              onClick={handleUpsell}
            >
              {anyAtLimit ? "Upgrade to Unlimited" : "View plans"}
            </Button>
            <Button type="button" size="sm" variant="outline" asChild>
              <Link href="/settings/plan">Manage plan</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
      <AlertDialog open={confirmResetOpen} onOpenChange={setConfirmResetOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Use quota reset?</AlertDialogTitle>
            <AlertDialogDescription>
              This will reset all of your UCAT Free quota usage to zero for the
              current period. Your attempt history will stay unchanged.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={usingReset}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleUseReset} disabled={usingReset}>
              {usingReset ? "Using reset..." : "Use reset"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
