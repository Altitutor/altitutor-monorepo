"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { PlanPicker } from "@/features/subscription/components/plan-picker/plan-picker";
import { PlanPickerDialogShell } from "@/features/subscription/components/plan-picker/plan-picker-dialog-shell";
import { trackSubscriptionJourneyEvent } from "@/features/subscription/api/track-subscription-journey";
import type { PlanPickerTier } from "@/features/subscription/lib/plan-tier-rank";
import { formatQuotaPeriodLabel } from "@/features/ucat-access/lib/format-quota-period";
import { UCAT_QUOTA_AREA_LABELS } from "@/features/ucat-access/types/quota";
import { useUpsellDialog } from "@/features/ucat-access/context/upsell-dialog-context";

const QUOTA_UPSELL_TIERS: PlanPickerTier[] = ["unlimited"];

export function PlanPickerDialog() {
  const router = useRouter();
  const trackedQuotaOpenRef = useRef(false);
  const {
    planPickerOpen,
    planPickerContext,
    closePlanPicker,
    closeQuotaLimit,
  } = useUpsellDialog();

  const quotaContext =
    planPickerContext?.kind === "quota_limit" ? planPickerContext : null;
  const browseContext =
    planPickerContext?.kind === "browse" ? planPickerContext : null;

  useEffect(() => {
    if (!planPickerOpen || !quotaContext || trackedQuotaOpenRef.current) return;
    trackedQuotaOpenRef.current = true;
    trackSubscriptionJourneyEvent({
      eventType: "quota_upsell_shown",
      journeyContext: "quota_paywall",
      metadata: {
        area: quotaContext.payload.area,
        limit: quotaContext.payload.limit,
        used: quotaContext.payload.used,
      },
    });
  }, [planPickerOpen, quotaContext]);

  useEffect(() => {
    if (!planPickerOpen) trackedQuotaOpenRef.current = false;
  }, [planPickerOpen]);

  const quotaPayload = quotaContext?.payload;
  const areaLabel = quotaPayload
    ? UCAT_QUOTA_AREA_LABELS[quotaPayload.area]
    : null;
  const isDisabled = quotaPayload?.limit === 0;
  const title = quotaPayload
    ? isDisabled
      ? `${areaLabel} not included on UCAT Free`
      : `${areaLabel} limit reached`
    : (browseContext?.title ?? "Choose your plan");
  const description = quotaPayload
    ? isDisabled
      ? `${areaLabel} is not available on UCAT Free. Choose UCAT Unlimited for unlimited access across Learn, Practice, Sets, Mocks, and Skill trainer.`
      : `You've used ${quotaPayload.used} of ${quotaPayload.limit} ${areaLabel?.toLowerCase()} ${formatQuotaPeriodLabel(quotaPayload.period)} on UCAT Free. Upgrade for unlimited access.`
    : browseContext?.description;

  const handleQuotaDismiss = () => {
    const dismissAction = quotaContext?.dismissAction;
    closeQuotaLimit();
    if (dismissAction?.onDismiss) {
      dismissAction.onDismiss();
    } else if (dismissAction?.href) {
      router.replace(dismissAction.href);
    } else if (dismissAction?.variant === "dashboard") {
      router.replace("/dashboard");
    }
  };

  const dismissDestination = quotaContext?.dismissAction?.label
    ?.replace(/^Back to /i, "")
    .replace(/^Dismiss$/i, "");
  const quotaDismissLabel = `No thanks, take me back${dismissDestination ? ` to ${dismissDestination}` : ""}`;

  return (
    <PlanPickerDialogShell
      open={planPickerOpen}
      onOpenChange={(open) => {
        if (!open) closePlanPicker();
      }}
      title={title}
      description={description}
      fullScreen
      dismissible={!quotaContext}
      hideBackButton={Boolean(quotaContext)}
      footer={
        quotaContext ? (
          <div className="flex justify-center">
            <Button type="button" variant="ghost" onClick={handleQuotaDismiss}>
              {quotaDismissLabel}
            </Button>
          </div>
        ) : undefined
      }
    >
      <PlanPicker
        variant="dialog"
        surfaceTheme="app"
        visibleTiers={quotaContext ? QUOTA_UPSELL_TIERS : undefined}
        onContinueFree={quotaContext ? undefined : closePlanPicker}
        onCheckoutStart={() => {
          if (quotaPayload) {
            trackSubscriptionJourneyEvent({
              eventType: "quota_upsell_converted",
              journeyContext: "quota_paywall",
              metadata: { area: quotaPayload.area },
            });
            closeQuotaLimit();
          }
          // Browse mode keeps #pricing in history so Back from checkout restores it.
        }}
        onDowngradeNavigate={quotaContext ? closeQuotaLimit : closePlanPicker}
      />
    </PlanPickerDialogShell>
  );
}
