"use client";

import { useQuotaLimitModal } from "@/features/ucat-access/context/quota-limit-context";
import { formatQuotaPeriodLabel } from "@/features/ucat-access/lib/format-quota-period";
import { UCAT_QUOTA_AREA_LABELS } from "@/features/ucat-access/types/quota";
import { PlanPicker } from "@/features/subscription/components/plan-picker/plan-picker";
import { PlanPickerDialogShell } from "@/features/subscription/components/plan-picker/plan-picker-dialog-shell";

export function QuotaLimitModal() {
  const { open, payload, closeQuotaLimit } = useQuotaLimitModal();

  if (!payload) return null;

  const areaLabel = UCAT_QUOTA_AREA_LABELS[payload.area];
  const periodLabel = formatQuotaPeriodLabel(payload.period);
  const isDisabled = payload.limit === 0;

  const title = isDisabled
    ? `${areaLabel} not included on UCAT Free`
    : `${areaLabel} limit reached`;

  const description = isDisabled
    ? `${areaLabel} is not available on UCAT Free. Choose UCAT Unlimited for unlimited access across Learn, Practice, Sets, Mocks, and Skill trainer.`
    : `You've used ${payload.used} of ${payload.limit} ${areaLabel.toLowerCase()} ${periodLabel} on UCAT Free. Upgrade to UCAT Unlimited for unlimited access.`;

  return (
    <PlanPickerDialogShell
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) closeQuotaLimit();
      }}
      title={title}
      description={description}
    >
      <PlanPicker
        variant="dialog"
        surfaceTheme="app"
        onContinueFree={closeQuotaLimit}
        onCheckoutStart={closeQuotaLimit}
        onDowngradeNavigate={closeQuotaLimit}
      />
    </PlanPickerDialogShell>
  );
}
