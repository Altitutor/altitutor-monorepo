"use client";

import { PlanPicker } from "@/features/subscription/components/plan-picker/plan-picker";
import { PlanPickerDialogShell } from "@/features/subscription/components/plan-picker/plan-picker-dialog-shell";
import { useUpsellDialog } from "@/features/ucat-access/context/upsell-dialog-context";

export function PlanPickerDialog() {
  const {
    planPickerOpen,
    planPickerContext,
    closePlanPicker,
  } = useUpsellDialog();

  return (
    <PlanPickerDialogShell
      open={planPickerOpen}
      onOpenChange={(open) => {
        if (!open) closePlanPicker();
      }}
      title={planPickerContext?.title ?? "Choose your plan"}
      description={planPickerContext?.description}
    >
      <PlanPicker
        variant="dialog"
        surfaceTheme="app"
        onContinueFree={closePlanPicker}
        onCheckoutStart={closePlanPicker}
      />
    </PlanPickerDialogShell>
  );
}
