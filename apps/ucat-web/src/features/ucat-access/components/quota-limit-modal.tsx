"use client";

import { useRouter } from "next/navigation";
import { LayoutDashboard, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQuotaLimitModal } from "@/features/ucat-access/context/quota-limit-context";
import { formatQuotaPeriodLabel } from "@/features/ucat-access/lib/format-quota-period";
import { UCAT_QUOTA_AREA_LABELS } from "@/features/ucat-access/types/quota";
import { PlanPicker } from "@/features/subscription/components/plan-picker/plan-picker";
import { PlanPickerDialogShell } from "@/features/subscription/components/plan-picker/plan-picker-dialog-shell";

export function QuotaLimitModal() {
  const router = useRouter();
  const { open, payload, dismissAction, closeQuotaLimit } =
    useQuotaLimitModal();

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

  const dismissLabel =
    dismissAction?.label ??
    (dismissAction?.variant === "dashboard" ? "Go to dashboard" : "Dismiss");
  const dismissVariant = dismissAction?.variant ?? "dismiss";

  const handleDismiss = () => {
    closeQuotaLimit();
    if (dismissAction?.onDismiss) {
      dismissAction.onDismiss();
      return;
    }
    if (dismissVariant === "dashboard") {
      router.replace("/dashboard");
    }
  };

  return (
    <PlanPickerDialogShell
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) closeQuotaLimit();
      }}
      dismissible={false}
      hideCloseButton
      title={title}
      description={description}
      footer={
        <Button
          type="button"
          variant="outline"
          className="w-full sm:w-auto"
          onClick={handleDismiss}
        >
          {dismissVariant === "dismiss" ? (
            <X className="h-4 w-4" aria-hidden />
          ) : (
            <LayoutDashboard className="h-4 w-4" aria-hidden />
          )}
          {dismissLabel}
        </Button>
      }
    >
      <PlanPicker
        variant="dialog"
        surfaceTheme="app"
        onCheckoutStart={closeQuotaLimit}
      />
    </PlanPickerDialogShell>
  );
}
