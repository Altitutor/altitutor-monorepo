"use client";

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@altitutor/ui";
import { useQuotaLimitModal } from "@/features/ucat-access/context/quota-limit-context";
import { useUpsellDialog } from "@/features/ucat-access/context/upsell-dialog-context";
import { useQuotaUsage } from "@/features/ucat-access/hooks/use-quota-usage";
import { formatQuotaUsageLabel } from "@/features/ucat-access/lib/format-quota-period";
import type { UcatQuotaArea } from "@/features/ucat-access/types/quota";
import { UCAT_QUOTA_AREA_LABELS } from "@/features/ucat-access/types/quota";
import { cn } from "@/lib/utils";

type QuotaUsageCardProps = {
  /** When set, renders a compact single-area variant */
  area?: UcatQuotaArea;
  className?: string;
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

export function QuotaUsageCard({ area, className }: QuotaUsageCardProps) {
  const { data, isLoading } = useQuotaUsage();
  const { openQuotaLimit } = useQuotaLimitModal();
  const { openPlanPicker } = useUpsellDialog();

  if (isLoading || !data || data.isQuotaExempt || data.onlineTier !== "free") {
    return null;
  }

  const areas = area
    ? data.areas.filter((entry) => entry.area === area)
    : data.areas;

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
      <Card className={cn("border-border/80", className)}>
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-medium">{entry.label}</p>
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
            variant={entry.atLimit ? "default" : "outline"}
            size="sm"
            className="shrink-0"
            onClick={handleUpsell}
          >
            {entry.atLimit ? "Upgrade to Unlimited" : "View plans"}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("border-border/80", className)}>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">UCAT Free usage</CardTitle>
            <CardDescription>
              Your free quotas reset per area on a daily, weekly, or monthly
              basis.
            </CardDescription>
          </div>
          <Badge variant="secondary">Free plan</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="space-y-3">
          {areas.map((entry) => {
            if (entry.disabled) return null;
            return (
              <li key={entry.area} className="space-y-1.5">
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="font-medium">{entry.label}</span>
                  <span className="text-muted-foreground">
                    {formatQuotaUsageLabel(entry.used, entry.limit, entry.period)}
                  </span>
                </div>
                <QuotaProgressBar
                  used={entry.used}
                  limit={entry.limit}
                  atLimit={entry.atLimit}
                />
              </li>
            );
          })}
        </ul>
        <div className="flex flex-wrap gap-2 pt-1">
          <Button type="button" size="sm" onClick={handleUpsell}>
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
