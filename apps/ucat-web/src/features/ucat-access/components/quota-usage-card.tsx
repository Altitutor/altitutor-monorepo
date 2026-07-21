"use client";

import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Skeleton,
} from "@altitutor/ui";
import { Button } from "@/components/ui/button";
import { useQuotaLimitDialog } from "@/features/ucat-access/context/upsell-dialog-context";
import { useUpsellDialog } from "@/features/ucat-access/context/upsell-dialog-context";
import { QuotaAreaInfoButton } from "@/features/ucat-access/components/quota-area-info-button";
import { QuotaResetEntitlementPanel } from "@/features/ucat-access/components/quota-reset-entitlement-panel";
import { useQuotaUsage } from "@/features/ucat-access/hooks/use-quota-usage";
import { formatQuotaUsageLabel } from "@/features/ucat-access/lib/format-quota-period";
import type { UcatQuotaArea } from "@/features/ucat-access/types/quota";
import { UCAT_QUOTA_AREA_LABELS } from "@/features/ucat-access/types/quota";
import {
  UCAT_ONLINE_TIER_LABELS,
  UCAT_PLAN_TIER_BADGE_CLASS,
} from "@/features/subscription/lib/plan-tier-display";
import {
  UCAT_CARD_CHROME,
  UCAT_PRIMARY_ACTION_BUTTON_SM,
} from "@/lib/ucat-surface-motion";
import { cn } from "@/lib/utils";

type QuotaUsageCardProps = {
  /** When set, renders a compact single-area variant */
  area?: UcatQuotaArea;
  className?: string;
  /** Show a skeleton while usage loads (for free-only parent mounts). */
  showLoadingSkeleton?: boolean;
};

export function QuotaProgressBar({
  used,
  limit,
  atLimit,
}: {
  used: number;
  limit: number;
  atLimit: boolean;
}) {
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;

  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <div
        className={cn(
          "h-full rounded-full transition-all",
          atLimit ? "bg-destructive" : "bg-primary",
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function QuotaUsageCard({
  area,
  className,
  showLoadingSkeleton = false,
}: QuotaUsageCardProps) {
  const { data, isLoading, isError } = useQuotaUsage();
  const { openQuotaLimit } = useQuotaLimitDialog();
  const { openPlanPicker } = useUpsellDialog();

  if (isLoading) {
    if (!showLoadingSkeleton) return null;
    return (
      <Skeleton
        className={cn("h-[220px] w-full rounded-ucatShell", className)}
        aria-label="Loading free quotas"
      />
    );
  }

  if (isError || !data || data.isQuotaExempt || data.onlineTier !== "free") {
    return null;
  }

  const areas = area
    ? data.areas.filter((entry) => entry.area === area)
    : data.areas.filter((entry) => !entry.disabled);

  if (areas.length === 0) return null;

  const anyAtLimit = areas.some((entry) => entry.atLimit);

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

  if (area && areas.length === 1) {
    const entry = areas[0];
    if (entry.disabled) return null;

    return (
      <Card className={cn(UCAT_CARD_CHROME, className)}>
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-medium">{entry.label}</p>
              <QuotaAreaInfoButton area={entry.area} label={entry.label} />
              {entry.atLimit ? (
                <Badge variant="destructive" className="text-[10px]">
                  Limit reached
                </Badge>
              ) : null}
            </div>
            <p className="text-xs text-muted-foreground">
              {formatQuotaUsageLabel(entry.used, entry.limit, entry.period)}
            </p>
            <QuotaProgressBar
              used={entry.used}
              limit={entry.limit}
              atLimit={entry.atLimit}
            />
          </div>
          <Button
            type="button"
            size="sm"
            className={cn(UCAT_PRIMARY_ACTION_BUTTON_SM, "shrink-0")}
            onClick={handleUpsell}
          >
            {entry.atLimit ? "Upgrade to Unlimited" : "View plans"}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn(UCAT_CARD_CHROME, className)}>
      <CardHeader className="space-y-1 pb-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
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
        <QuotaResetEntitlementPanel
          availableCount={data.quotaResetEntitlement.availableCount}
          nextExpiresAt={data.quotaResetEntitlement.nextExpiresAt}
        />
        <div className="flex flex-wrap gap-2 pt-1">
          <Button
            type="button"
            size="sm"
            className={UCAT_PRIMARY_ACTION_BUTTON_SM}
            onClick={handleUpsell}
          >
            {anyAtLimit ? "Upgrade to Unlimited" : "View plans"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() =>
              openPlanPicker({
                title: "Compare plans",
                description:
                  "UCAT Free includes limited access. Unlimited unlocks all online areas.",
              })
            }
          >
            Compare plans
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function getQuotaAreaLabel(area: UcatQuotaArea): string {
  return UCAT_QUOTA_AREA_LABELS[area];
}
