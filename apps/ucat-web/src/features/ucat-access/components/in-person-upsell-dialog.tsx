"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@altitutor/ui";
import { InPersonUpsellContent } from "@/features/subscription/components/in-person-upsell/in-person-upsell-content";
import { useUpsellDialog } from "@/features/ucat-access/context/upsell-dialog-context";

export function InPersonUpsellDialog() {
  const { inPersonUpsellOpen, closeInPersonUpsell } = useUpsellDialog();

  return (
    <Dialog
      open={inPersonUpsellOpen}
      onOpenChange={(open) => {
        if (!open) closeInPersonUpsell();
      }}
    >
      <DialogContent className="max-w-lg border-0 bg-marketing-cream p-4 sm:p-6">
        <DialogHeader className="text-left">
          <DialogTitle className="text-marketing-charcoal">
            Join in-person UCAT classes
          </DialogTitle>
          <DialogDescription className="text-marketing-charcoal/70">
            Add weekly guided sessions with expert tutors. Online UCAT access is
            included at no extra cost.
          </DialogDescription>
        </DialogHeader>
        <InPersonUpsellContent />
      </DialogContent>
    </Dialog>
  );
}
