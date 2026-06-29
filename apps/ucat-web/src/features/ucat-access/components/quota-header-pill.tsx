"use client";

import { Gauge } from "lucide-react";
import { usePathname } from "next/navigation";
import { useQuotaLimitModal } from "@/features/ucat-access/context/quota-limit-context";
import { useUpsellDialog } from "@/features/ucat-access/context/upsell-dialog-context";
import { useQuotaUsage } from "@/features/ucat-access/hooks/use-quota-usage";
import { getQuotaAreaForPathname } from "@/features/ucat-access/lib/quota-area-for-pathname";
import {
  formatQuotaUsageCompact,
} from "@/features/ucat-access/lib/format-quota-period";
import { HeaderStatusPill } from "@/shared/components/header-status-pill";

export function QuotaHeaderPill() {
  const pathname = usePathname();
  const area = getQuotaAreaForPathname(pathname);
  const { data, isLoading } = useQuotaUsage();
  const { openQuotaLimit } = useQuotaLimitModal();
  const { openPlanPicker } = useUpsellDialog();

  if (!area || isLoading || !data || data.isQuotaExempt || data.onlineTier !== "free") {
    return null;
  }

  const entry = data.areas.find((item) => item.area === area);
  if (!entry || entry.disabled) return null;

  const handleAction = () => {
    if (entry.atLimit) {
      openQuotaLimit({
        code: "QUOTA_EXCEEDED",
        area: entry.area,
        used: entry.used,
        limit: entry.limit,
        period: entry.period,
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
    <HeaderStatusPill
      variant={entry.atLimit ? "rose" : "sky"}
      icon={<Gauge className="h-3.5 w-3.5" />}
      action={{
        type: "button",
        label: entry.atLimit ? "Upgrade" : "View plans",
        onClick: handleAction,
      }}
    >
      <span className="font-medium">{entry.label}</span>
      <span className="tabular-nums">
        {" "}
        · {formatQuotaUsageCompact(entry.used, entry.limit, entry.period)}
      </span>
    </HeaderStatusPill>
  );
}
