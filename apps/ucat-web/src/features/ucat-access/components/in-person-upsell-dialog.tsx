"use client";

import { InPersonUpsellContent } from "@/features/subscription/components/in-person-upsell/in-person-upsell-content";
import { PlanPickerDialogShell } from "@/features/subscription/components/plan-picker/plan-picker-dialog-shell";
import { useUpsellDialog } from "@/features/ucat-access/context/upsell-dialog-context";

export function InPersonUpsellDialog() {
  const { inPersonUpsellOpen, closeInPersonUpsell } = useUpsellDialog();

  return (
    <PlanPickerDialogShell
      open={inPersonUpsellOpen}
      onOpenChange={(open) => {
        if (!open) closeInPersonUpsell();
      }}
      title="Join in-person UCAT classes"
      description="Add weekly guided sessions with expert tutors. Online UCAT access is included at no extra cost."
      fullScreen
    >
      <InPersonUpsellContent className="mx-auto mt-8 max-w-2xl" />
    </PlanPickerDialogShell>
  );
}
