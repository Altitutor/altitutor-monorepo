"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@altitutor/ui";
import { PlanPicker } from "@/features/subscription/components/plan-picker/plan-picker";
import { useUpsellDialog } from "@/features/ucat-access/context/upsell-dialog-context";

export function PlanPickerDialog() {
  const {
    planPickerOpen,
    planPickerContext,
    closePlanPicker,
  } = useUpsellDialog();

  return (
    <Dialog
      open={planPickerOpen}
      onOpenChange={(open) => {
        if (!open) closePlanPicker();
      }}
    >
      <DialogContent className="max-h-[90dvh] max-w-6xl overflow-y-auto border-0 bg-marketing-cream p-4 sm:p-6">
        <DialogHeader className="text-left">
          <DialogTitle className="text-marketing-charcoal">
            {planPickerContext?.title ?? "Choose your plan"}
          </DialogTitle>
          {planPickerContext?.description ? (
            <DialogDescription className="text-marketing-charcoal/70">
              {planPickerContext.description}
            </DialogDescription>
          ) : null}
        </DialogHeader>
        <PlanPicker
          variant="dialog"
          onContinueFree={closePlanPicker}
          onCheckoutStart={closePlanPicker}
        />
      </DialogContent>
    </Dialog>
  );
}
