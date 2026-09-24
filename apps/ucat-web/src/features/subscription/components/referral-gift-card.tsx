"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNowStrict } from "date-fns";
import { GiftOfferCard } from "./gift-offer-card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@altitutor/ui";
import { Button } from "@/components/ui/button";
import type { PendingReferralGift } from "@/features/subscription/api/referral-gifts";
import { rejectReferralGift } from "@/features/subscription/api/referral-gifts";
import {
  UCAT_DIALOG_PRIMARY_ACTION,
  UCAT_PRIMARY_ACTION_BUTTON,
} from "@/lib/ucat-surface-motion";

type ReferralGiftCardProps = {
  gift: PendingReferralGift;
  checkoutContext?: "signup_onboarding" | "referral_gift";
  postCheckoutReturnTo?: string;
  onRejected?: () => void | Promise<void>;
};

export function ReferralGiftCard({
  gift,
  checkoutContext = "referral_gift",
  postCheckoutReturnTo,
  onRejected,
}: ReferralGiftCardProps) {
  const router = useRouter();
  const [confirmReject, setConfirmReject] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const duration = gift.duration === "month" ? "month" : "week";

  async function rejectGift() {
    setRejecting(true);
    setError(null);
    try {
      await rejectReferralGift(gift.id);
      setConfirmReject(false);
      await onRejected?.();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Please try again.");
    } finally {
      setRejecting(false);
    }
  }

  const checkoutParams = new URLSearchParams({
    tier: "unlimited",
    interval: duration,
    context: checkoutContext,
    gift: gift.id,
  });
  if (postCheckoutReturnTo) {
    checkoutParams.set("redirect", postCheckoutReturnTo);
  }

  return (
    <>
      <GiftOfferCard
        eyebrow={`A gift from ${gift.referrerName}`}
        title={`${gift.referrerName} has gifted you one free ${duration} of UCAT Unlimited`}
        description="Unlock unlimited practice across every UCAT section, full-length mock exams, percentile tracking, and adaptive skill training with progress analytics."
        note={
          <>
            Offer expires{" "}
            {formatDistanceToNowStrict(new Date(gift.expiresAt), {
              addSuffix: true,
            })}
          </>
        }
        error={error}
        actions={
          <>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setConfirmReject(true)}
            >
              Continue with UCAT Free
            </Button>
            <Button
              type="button"
              className={UCAT_PRIMARY_ACTION_BUTTON}
              onClick={() =>
                router.push(`/checkout?${checkoutParams.toString()}`)
              }
            >
              Accept gift
            </Button>
          </>
        }
      />

      <AlertDialog open={confirmReject} onOpenChange={setConfirmReject}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Continue without the gift?</AlertDialogTitle>
            <AlertDialogDescription>
              This is final. The free {duration} won’t be saved for later, and
              you’ll receive a UCAT Free quota reset instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={rejecting}>
              Keep gift
            </AlertDialogCancel>
            <AlertDialogAction
              className={UCAT_DIALOG_PRIMARY_ACTION}
              disabled={rejecting}
              onClick={(event) => {
                event.preventDefault();
                void rejectGift();
              }}
            >
              {rejecting ? "Continuing…" : "No thanks, continue Free"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
