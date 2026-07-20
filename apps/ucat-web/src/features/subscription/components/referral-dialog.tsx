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
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader className="text-left">
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
