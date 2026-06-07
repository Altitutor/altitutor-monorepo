"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Badge } from "@altitutor/ui";
import { useQuotaUsage } from "@/features/ucat-access/hooks/use-quota-usage";
import { formatQuotaUsageLabel } from "@/features/ucat-access/lib/format-quota-period";
import { UCAT_QUOTA_AREA_LABELS } from "@/features/ucat-access/types/quota";
import { ucatDashboardNavTileClassName } from "@/lib/ucat-surface-motion";
import { cn } from "@/lib/utils";

export function DashboardFreeQuotaCard() {
  const { data, isLoading } = useQuotaUsage();

  if (isLoading || !data || data.isQuotaExempt || data.onlineTier !== "free") {
    return null;
  }

  const surfaceClass = ucatDashboardNavTileClassName();

  return (
    <Link href="/settings/plan" className={surfaceClass}>
      <div className="flex w-full items-start justify-between">
        <Badge variant="secondary" className="shrink-0 text-[10px]">
          UCAT Free
        </Badge>
        <ChevronRight
          className="h-5 w-5 shrink-0 text-muted-foreground opacity-60"
          aria-hidden
        />
      </div>
      <h3 className="mt-4 font-semibold">Your daily limits</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        See quotas and upgrade to UCAT Unlimited or Pro for unlimited access.
      </p>
      <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
        {data.areas.map((entry) => (
          <li key={entry.area} className="flex items-center justify-between gap-2">
            <span>{UCAT_QUOTA_AREA_LABELS[entry.area]}</span>
            <span
              className={cn(
                "tabular-nums",
                entry.atLimit ? "font-medium text-destructive" : "",
              )}
            >
              {formatQuotaUsageLabel(entry.used, entry.limit, entry.period)}
            </span>
          </li>
        ))}
      </ul>
    </Link>
  );
}
