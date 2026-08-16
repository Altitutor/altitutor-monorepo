"use client";

import React from "react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Label,
  RadioGroup,
  RadioGroupItem,
  Textarea,
} from "@altitutor/ui";
import { BadgeDollarSign, Loader2, MinusCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  CANCELLATION_REASON_OPTIONS,
  type CancellationReasonSelection,
} from "@/features/subscription/lib/subscription-cancellation";
import { formatInvoiceDate } from "@/features/subscription/lib/invoice-display";
import { formatMoneyFromMinorUnits } from "@/features/subscription/lib/format-subscription-copy";

type PlanCancellationDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetPlan: "free" | "unlimited";
  currentPlanName: string;
  paidAccessEndsAt: string | null;
  benefitsLost: readonly string[];
  earnedDiscountCents: number;
  earnedDiscountCurrency: string;
  omitAudPrefix?: boolean;
  reason: CancellationReasonSelection | null;
  onReasonChange: (reason: CancellationReasonSelection) => void;
  comment: string;
  onCommentChange: (comment: string) => void;
  confirming: boolean;
  error: string | null;
  onConfirm: () => void;
};

export function PlanCancellationDialog({
  open,
  onOpenChange,
  targetPlan,
  currentPlanName,
  paidAccessEndsAt,
  benefitsLost,
  earnedDiscountCents,
  earnedDiscountCurrency,
  omitAudPrefix,
  reason,
  onReasonChange,
  comment,
  onCommentChange,
  confirming,
  error,
  onConfirm,
}: PlanCancellationDialogProps) {
  const isSwitchingToFree = targetPlan === "free";
  const endDate = paidAccessEndsAt
    ? formatInvoiceDate(paidAccessEndsAt.slice(0, 10))
    : null;
  const earnedDiscount = formatMoneyFromMinorUnits(
    earnedDiscountCents,
    earnedDiscountCurrency,
    { omitAudPrefix },
  );

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-h-[90vh] max-w-lg overflow-y-auto md:max-w-4xl">
        <AlertDialogHeader>
          <AlertDialogTitle>
            {isSwitchingToFree
              ? "Are you sure you want to downgrade to UCAT Free?"
              : "Are you sure you want to downgrade to UCAT Unlimited?"}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 text-left">
              {isSwitchingToFree ? (
                <p>
                  Your {currentPlanName} plan will stop renewing
                  {endDate ? (
                    <>
                      , and you&apos;ll keep paid access until{" "}
                      <span className="font-medium text-foreground">
                        {endDate}
                      </span>
                    </>
                  ) : null}
                  . Your account, practice history and results will stay safe.
                </p>
              ) : (
                <p>
                  You&apos;ll continue to a secure billing page to review the
                  price and timing before changing your {currentPlanName} plan.
                </p>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div
          className={
            isSwitchingToFree
              ? "grid gap-5 py-2 md:grid-cols-2 md:items-start md:gap-6"
              : "space-y-5 py-2"
          }
        >
          {isSwitchingToFree ? (
            <div className="min-w-0 space-y-5">
              <div className="space-y-3">
                <Label>What is the main reason you&apos;re downgrading?</Label>
                <RadioGroup
                  aria-label="Main reason for downgrading to UCAT Free"
                  value={reason ?? ""}
                  onValueChange={(value) =>
                    onReasonChange(value as CancellationReasonSelection)
                  }
                  className="gap-2"
                >
                  {CANCELLATION_REASON_OPTIONS.map((option) => (
                    <Label
                      key={option.value}
                      htmlFor={`cancel-${option.value}`}
                      className="flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 font-normal transition-colors hover:bg-muted/50"
                    >
                      <RadioGroupItem
                        id={`cancel-${option.value}`}
                        value={option.value}
                      />
                      <span>{option.label}</span>
                    </Label>
                  ))}
                </RadioGroup>
              </div>

              <div className="space-y-2">
                <Label htmlFor="cancellation-comment">
                  Is there anything else you&apos;d like us to know? (optional)
                </Label>
                <Textarea
                  id="cancellation-comment"
                  value={comment}
                  maxLength={500}
                  rows={3}
                  placeholder="Your feedback helps us improve."
                  onChange={(event) => onCommentChange(event.target.value)}
                />
                <p className="text-right text-xs text-muted-foreground">
                  {comment.length}/500
                </p>
              </div>
            </div>
          ) : null}

          <div className="space-y-4 rounded-2xl border border-border bg-muted/20 p-4 md:p-5">
            <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4">
              <p className="text-sm font-semibold text-foreground">
                You&apos;ll lose these {currentPlanName} benefits
              </p>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                {benefitsLost.map((benefit) => (
                  <li key={benefit} className="flex items-start gap-2">
                    <MinusCircle
                      aria-hidden="true"
                      className="mt-0.5 h-4 w-4 shrink-0 text-destructive"
                    />
                    <span>{benefit}</span>
                  </li>
                ))}
              </ul>
            </div>

            {isSwitchingToFree && earnedDiscountCents > 0 ? (
              <div className="flex items-start gap-3 rounded-xl border border-primary/25 bg-primary/5 p-4">
                <BadgeDollarSign
                  aria-hidden="true"
                  className="mt-0.5 h-5 w-5 shrink-0 text-primary"
                />
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    You&apos;ve already earned {earnedDiscount} off your next
                    bill
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Downgrading will cause you to lose this discount.
                  </p>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={confirming}>
            Keep {currentPlanName}
          </AlertDialogCancel>
          <Button
            type="button"
            variant="destructive"
            disabled={confirming || (isSwitchingToFree && reason === null)}
            onClick={onConfirm}
          >
            {confirming ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            {isSwitchingToFree
              ? endDate
                ? `Downgrade to Free on ${endDate}`
                : "Downgrade to Free"
              : "Continue to billing"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
