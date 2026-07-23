"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@altitutor/ui";
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
        className="min-w-0 max-w-[100vw] overflow-x-hidden overflow-y-auto pt-12 sm:max-w-4xl sm:pt-6"
      >
        <DialogHeader className="min-w-0 text-left">
          <DialogTitle>Refer a friend</DialogTitle>
          <DialogDescription>
            Copy your personal referral link or open your device’s share menu.
          </DialogDescription>
        </DialogHeader>
        <ReferralSection />
      </DialogContent>
    </Dialog>
  );
}
