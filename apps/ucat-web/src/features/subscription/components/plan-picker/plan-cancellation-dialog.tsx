"use client";

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
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  CANCELLATION_REASON_OPTIONS,
  type CancellationReasonSelection,
} from "@/features/subscription/lib/subscription-cancellation";
import { formatInvoiceDate } from "@/features/subscription/lib/invoice-display";

type PlanCancellationDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentPlanName: string;
  paidAccessEndsAt: string | null;
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
  currentPlanName,
  paidAccessEndsAt,
  reason,
  onReasonChange,
  comment,
  onCommentChange,
  confirming,
  error,
  onConfirm,
}: PlanCancellationDialogProps) {
  const endDate = paidAccessEndsAt
    ? formatInvoiceDate(paidAccessEndsAt.slice(0, 10))
    : null;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <AlertDialogHeader>
          <AlertDialogTitle>Switch to UCAT Free?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 text-left">
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
              <p>
                After that, Free plan limits will apply across practice, sets,
                mocks, learn and skill trainer.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-5 py-2">
          <div className="space-y-3">
            <Label>What is the main reason you&apos;re switching?</Label>
            <RadioGroup
              aria-label="Main reason for switching to UCAT Free"
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

          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={confirming}>
            Keep my current plan
          </AlertDialogCancel>
          <Button
            type="button"
            variant="destructive"
            disabled={confirming || reason === null}
            onClick={onConfirm}
          >
            {confirming ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            {endDate ? `Switch to Free on ${endDate}` : "Switch to Free"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
