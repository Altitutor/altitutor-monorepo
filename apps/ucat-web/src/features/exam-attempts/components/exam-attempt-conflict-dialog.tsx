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
import {
  buildQuestionEngineTutorialHref,
  useQuestionEngineTutorialGate,
} from "@/features/onboarding/hooks/use-question-engine-tutorial-gate";

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
  const { isBlocked: questionEngineTourBlocked } =
    useQuestionEngineTutorialGate();

  if (!active) return null;

  const resumeHref = questionEngineTourBlocked
    ? buildQuestionEngineTutorialHref(active.resumeHref)
    : active.resumeHref;

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
        <AlertDialogFooter className="flex-col gap-2 sm:flex-col sm:space-x-0">
          <Button type="button" variant="outline" className="w-full" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => {
              window.location.assign(resumeHref);
            }}
          >
            Resume current attempt
          </Button>
          <Button
            type="button"
            className="w-full"
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
