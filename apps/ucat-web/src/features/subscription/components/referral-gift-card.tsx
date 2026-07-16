"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNowStrict } from "date-fns";
import { Gift, ShieldCheck } from "lucide-react";
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
import { UCAT_DIALOG_PRIMARY_ACTION, UCAT_PRIMARY_ACTION_BUTTON } from "@/lib/ucat-surface-motion";

type ReferralGiftCardProps = {
  gift: PendingReferralGift;
  checkoutContext?: "signup_onboarding" | "referral_gift";
  onRejected?: () => void | Promise<void>;
};

export function ReferralGiftCard({
  gift,
  checkoutContext = "referral_gift",
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

  return (
    <>
      <section className="relative overflow-hidden rounded-3xl border border-primary/25 bg-gradient-to-br from-primary/[0.14] via-background to-background p-6 shadow-sm sm:p-8">
        <div className="absolute -right-16 -top-16 h-52 w-52 rounded-full bg-primary/15 blur-3xl" />
        <div className="relative">
          <div className="flex items-start gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
              <Gift className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                A gift from {gift.referrerName}
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
                {gift.referrerName} has gifted you one free {duration} of UCAT
                Unlimited
              </h2>
              <p className="mt-3 max-w-2xl leading-relaxed text-muted-foreground">
                Accept to start an Unlimited subscription with your first{" "}
                {duration} free. You’ll add a payment method securely in Stripe
                and can cancel before normal {duration}ly billing begins.
              </p>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-border/70 bg-background/70 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <ShieldCheck
                className="h-4 w-4 text-primary"
                aria-hidden="true"
              />
              <span>
                Offer expires{" "}
                {formatDistanceToNowStrict(new Date(gift.expiresAt), {
                  addSuffix: true,
                })}
              </span>
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
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
                Accept gift and continue
              </Button>
            </div>
          </div>
          {error ? (
            <p className="mt-3 text-sm text-destructive">{error}</p>
          ) : null}
        </div>
      </section>

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
