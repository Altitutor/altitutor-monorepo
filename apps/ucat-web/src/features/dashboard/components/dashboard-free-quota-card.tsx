"use client";

import Link from "next/link";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Skeleton,
} from "@altitutor/ui";
import { useQuotaLimitModal } from "@/features/ucat-access/context/quota-limit-context";
import { useUpsellDialog } from "@/features/ucat-access/context/upsell-dialog-context";
import { QuotaProgressBar } from "@/features/ucat-access/components/quota-usage-card";
import { useQuotaUsage } from "@/features/ucat-access/hooks/use-quota-usage";
import { useUcatAccess } from "@/features/ucat-access/hooks/use-ucat-access";
import { formatQuotaUsageLabel } from "@/features/ucat-access/lib/format-quota-period";
import { UcatHoverChevron } from "@/lib/ucat-hover-chevron";
import {
  UCAT_CARD_CHROME,
  UCAT_PRESSABLE_LIFT_HOVER,
  UCAT_SURFACE_MOTION,
} from "@/lib/ucat-surface-motion";
import { cn } from "@/lib/utils";

export function DashboardFreeQuotaCard() {
  const access = useUcatAccess();
  const { data, isLoading, isError } = useQuotaUsage();
  const { openQuotaLimit } = useQuotaLimitModal();
  const { openPlanPicker } = useUpsellDialog();

  const isFreeTier =
    !access.isLoading &&
    access.onlineTier === "free" &&
    !access.isQuotaExempt;

  if (!access.isLoading && !isFreeTier) {
    return null;
  }

  if (access.isLoading || isLoading) {
    return <Skeleton className="h-[220px] rounded-ucatShell" />;
  }

  if (isError || !data || data.isQuotaExempt || data.onlineTier !== "free") {
    return null;
  }

  const areas = data.areas.filter((entry) => !entry.disabled);
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

  return (
    <Card className={UCAT_CARD_CHROME}>
      <CardHeader className="space-y-1 pb-2">
        <div className="flex flex-row items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-base font-medium">
                Your free quotas
              </CardTitle>
              <Badge variant="secondary" className="text-[10px]">
                UCAT Free
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
                <span className="font-medium">{entry.label}</span>
                <span
                  className={cn(
                    "tabular-nums text-muted-foreground",
                    entry.atLimit && "font-medium text-destructive",
                  )}
                >
                  {formatQuotaUsageLabel(entry.used, entry.limit, entry.period)}
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
        <div className="flex flex-wrap gap-2 pt-1">
          <Button type="button" size="sm" onClick={handleUpsell}>
            {anyAtLimit ? "Upgrade to Unlimited" : "View plans"}
          </Button>
          <Button type="button" size="sm" variant="outline" asChild>
            <Link href="/settings/plan">Manage plan</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
