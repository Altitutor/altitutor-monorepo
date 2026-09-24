"use client";

import { Dialog, DialogContent, DialogTitle } from "@altitutor/ui";
import { ReferralSection } from "@/features/subscription/components/referral-section";

type ReferralDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function ReferralDialog({ open, onOpenChange }: ReferralDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        mobilePresentation="bottom-sheet"
        className="min-w-0 max-w-[100vw] overflow-x-hidden overflow-y-auto pt-12 sm:pt-6 md:!max-w-4xl"
      >
        <DialogTitle className="sr-only">Refer a friend</DialogTitle>
        <ReferralSection />
      </DialogContent>
    </Dialog>
  );
}
