"use client";

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
} from "@altitutor/ui";
import type { ActiveExamAttempt } from "@/lib/ucat/exam-attempt/types";

export function ExamAttemptConflictDialog({
  open,
  active,
  pendingLabel,
  isFinalizing,
  onFinalizeAndContinue,
  onCancel,
}: {
  open: boolean;
  active: ActiveExamAttempt | null;
  pendingLabel: string;
  isFinalizing: boolean;
  onFinalizeAndContinue: () => void;
  onCancel: () => void;
}) {
  if (!active) return null;

  return (
    <AlertDialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onCancel();
      }}
    >
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle>Exam already in progress</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <p>
              You have an unfinished attempt: <strong>{active.label}</strong>.
              Resume it, or submit your current answers and start{" "}
              <strong>{pendingLabel}</strong>.
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              window.location.assign(active.resumeHref);
            }}
          >
            Resume current attempt
          </Button>
          <Button
            type="button"
            onClick={onFinalizeAndContinue}
            disabled={isFinalizing}
          >
            {isFinalizing ? "Submitting…" : "Submit current & start new"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
