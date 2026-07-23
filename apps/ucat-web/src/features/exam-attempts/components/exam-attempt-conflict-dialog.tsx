"use client";

import React from "react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@altitutor/ui";
import { Button } from "@/components/ui/button";
import type { ActiveExamAttempt } from "@/lib/ucat/exam-attempt/types";
import {
  buildQuestionEngineTutorialHref,
  useQuestionEngineTutorialGate,
} from "@/features/onboarding/hooks/use-question-engine-tutorial-gate";

export function ExamAttemptConflictDialog({
  open,
  active,
  pendingLabel,
  isDiscarding,
  onDiscardAndContinue,
  onCancel,
}: {
  open: boolean;
  active: ActiveExamAttempt | null;
  pendingLabel: string;
  isDiscarding: boolean;
  onDiscardAndContinue: () => void;
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
      <AlertDialogContent className="z-[70] max-w-lg bg-card text-card-foreground">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-foreground">
            Exam already in progress
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <p className="text-muted-foreground">
              You have an unfinished attempt:{" "}
              <strong className="font-semibold text-foreground">
                {active.label}
              </strong>
              . Resume it, or discard it and start{" "}
              <strong className="font-semibold text-foreground">
                {pendingLabel}
              </strong>
              . Discarding keeps its saved answers for audit, but it will not be
              scored or appear in your attempt history.
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2 sm:space-x-0">
          <Button
            type="button"
            variant="outline"
            className="w-full border-border text-foreground hover:bg-muted hover:text-foreground sm:w-auto"
            onClick={onCancel}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="outline"
            className="w-full border-border text-foreground hover:bg-muted hover:text-foreground sm:w-auto"
            onClick={onDiscardAndContinue}
            disabled={isDiscarding}
          >
            {isDiscarding ? "Discarding…" : "Discard & start new"}
          </Button>
          <Button
            type="button"
            className="w-full sm:w-auto"
            onClick={() => {
              window.location.assign(resumeHref);
            }}
          >
            Resume current
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
