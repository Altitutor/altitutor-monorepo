"use client";

import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Skeleton,
} from "@altitutor/ui";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { QuotaAreaInfoButton } from "@/features/ucat-access/components/quota-area-info-button";
import { QuotaResetEntitlementPanel } from "@/features/ucat-access/components/quota-reset-entitlement-panel";
import { QuotaProgressBar } from "@/features/ucat-access/components/quota-usage-card";
import {
  useQuotaLimitDialog,
  useUpsellDialog,
} from "@/features/ucat-access/context/upsell-dialog-context";
import { useQuotaUsage } from "@/features/ucat-access/hooks/use-quota-usage";
import { formatQuotaUsageLabel } from "@/features/ucat-access/lib/format-quota-period";
import {
  UCAT_QUOTA_AREA_LABELS,
  type UcatQuotaArea,
  type UcatQuotaAreaUsage,
} from "@/features/ucat-access/types/quota";
import { usePublicSubscriptionConfig } from "@/features/subscription/hooks/use-public-subscription-config";
import {
  UCAT_ONLINE_TIER_LABELS,
  UCAT_PLAN_TIER_BADGE_CLASS,
} from "@/features/subscription/lib/plan-tier-display";
import { defaultPublicSubscriptionConfig } from "@/features/subscription/types/public-subscription-config";
import {
  UCAT_CARD_CHROME,
  UCAT_PRIMARY_ACTION_BUTTON_SM,
} from "@/lib/ucat-surface-motion";
import { cn } from "@/lib/utils";

const FREE_QUOTA_AREAS: UcatQuotaArea[] = [
  "learn",
  "skill_trainer",
  "practice",
  "sets",
  "mocks",
];

function areasFromConfig(
  freeQuotas: typeof defaultPublicSubscriptionConfig.freeQuotas,
): UcatQuotaAreaUsage[] {
  return FREE_QUOTA_AREAS.map((area) => {
    const quota = freeQuotas[area];
    return {
      area,
      label: UCAT_QUOTA_AREA_LABELS[area],
      used: 0,
      limit: quota.limit,
      period: quota.period,
      disabled: quota.limit <= 0,
      atLimit: false,
    };
  });
}

function LockedQuotaBar({ onUpgrade }: { onUpgrade: () => void }) {
  return (
    <button
      type="button"
      onClick={onUpgrade}
      className="group relative block w-full overflow-hidden rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/25 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      aria-label="Available on Unlimited — upgrade"
    >
      <div className="h-1.5 w-full rounded-full bg-muted" aria-hidden="true">
        <div className="h-full w-[72%] rounded-full bg-primary/35 blur-[1.5px] transition-opacity group-hover:opacity-80" />
      </div>
    </button>
  );
}

/**
 * Free-plan quota limits for /settings/plan.
 * Always renders when mounted; uses live usage when available, else config limits.
 * Zero-limit areas stay visible as locked upsell rows.
 */
export function FreePlanQuotaLimitsCard({ className }: { className?: string }) {
  const quotaQuery = useQuotaUsage();
  const configQuery = usePublicSubscriptionConfig();
  const { openQuotaLimit } = useQuotaLimitDialog();
  const { openPlanPicker } = useUpsellDialog();

  const liveData =
    quotaQuery.data != null &&
    quotaQuery.data.onlineTier === "free" &&
    !quotaQuery.data.isQuotaExempt
      ? quotaQuery.data
      : null;

  const freeQuotas =
    configQuery.data?.freeQuotas ?? defaultPublicSubscriptionConfig.freeQuotas;

  if (quotaQuery.isLoading || quotaQuery.isPending) {
    return (
      <Skeleton
        className={cn("h-[220px] w-full rounded-ucatShell", className)}
        aria-label="Loading free quotas"
      />
    );
  }

  const areas: UcatQuotaAreaUsage[] = (
    liveData ? liveData.areas : areasFromConfig(freeQuotas)
  )
    .slice()
    .sort(
      (a, b) =>
        FREE_QUOTA_AREAS.indexOf(a.area) - FREE_QUOTA_AREAS.indexOf(b.area),
    );

  if (areas.length === 0) return null;

  const anyAtLimit = areas.some((entry) => entry.atLimit);
  const anyLocked = areas.some((entry) => entry.disabled || entry.limit <= 0);
  const resetEntitlement = liveData?.quotaResetEntitlement ?? null;

  const openUpgrade = () => {
    openPlanPicker({
      title: "Upgrade to UCAT Unlimited",
      description:
        "Unlock every area with unlimited access — including features not included on Free.",
    });
  };

  const handleUpsell = () => {
    const target = areas.find((entry) => entry.atLimit);
    if (liveData && target?.atLimit) {
      openQuotaLimit({
        code: "QUOTA_EXCEEDED",
        area: target.area,
        used: target.used,
        limit: target.limit,
        period: target.period,
      });
      return;
    }
    openUpgrade();
  };

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
              {liveData
                ? "Limits reset daily, weekly, or monthly per area."
                : "Free plan limits by area. Upgrade anytime for unlimited access."}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="space-y-3">
          {areas.map((entry) => {
            const isLocked = entry.disabled || entry.limit <= 0;

            if (isLocked) {
              return (
                <li key={entry.area} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="inline-flex min-w-0 items-center gap-1.5 font-medium text-muted-foreground">
                      <span className="truncate">{entry.label}</span>
                      <QuotaAreaInfoButton
                        area={entry.area}
                        label={entry.label}
                      />
                    </span>
                    <button
                      type="button"
                      onClick={openUpgrade}
                      className="inline-flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/25 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    >
                      <Lock className="h-3 w-3" aria-hidden="true" />
                      Only on Unlimited
                    </button>
                  </div>
                  <LockedQuotaBar onUpgrade={openUpgrade} />
                </li>
              );
            }

            return (
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
                    {liveData
                      ? formatQuotaUsageLabel(
                          entry.used,
                          entry.limit,
                          entry.period,
                        )
                      : `${entry.limit} / ${entry.period}`}
                  </span>
                </div>
                {liveData ? (
                  <QuotaProgressBar
                    used={entry.used}
                    limit={entry.limit}
                    atLimit={entry.atLimit}
                  />
                ) : (
                  <QuotaProgressBar
                    used={0}
                    limit={entry.limit}
                    atLimit={false}
                  />
                )}
              </li>
            );
          })}
        </ul>
        {resetEntitlement ? (
          <QuotaResetEntitlementPanel
            availableCount={resetEntitlement.availableCount}
            nextExpiresAt={resetEntitlement.nextExpiresAt}
          />
        ) : null}
        <div className="flex justify-end pt-1">
          <Button
            type="button"
            size="sm"
            className={UCAT_PRIMARY_ACTION_BUTTON_SM}
            onClick={handleUpsell}
          >
            {anyAtLimit || anyLocked ? "Upgrade to Unlimited" : "Upgrade"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
