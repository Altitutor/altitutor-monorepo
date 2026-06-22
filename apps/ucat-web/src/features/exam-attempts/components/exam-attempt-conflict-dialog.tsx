"use client";

import { UcatExamActionButton } from "@altitutor/ui";
import { QuestionEngineDialog } from "@/features/question-engine/components/question-engine-dialog";
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
  if (!open || !active) return null;

  return (
    <QuestionEngineDialog
      title="Exam already in progress"
      message={
        <p>
          You have an unfinished attempt: <strong>{active.label}</strong>.
          Resume it, or submit your current answers and start{" "}
          <strong>{pendingLabel}</strong>.
        </p>
      }
      actions={
        <>
          <UcatExamActionButton borders="all" onClick={onCancel}>
            Cancel
          </UcatExamActionButton>
          <UcatExamActionButton
            borders="all"
            onClick={() => {
              window.location.assign(active.resumeHref);
            }}
          >
            Resume current attempt
          </UcatExamActionButton>
          <UcatExamActionButton
            borders="all"
            onClick={onFinalizeAndContinue}
            disabled={isFinalizing}
          >
            {isFinalizing ? "Submitting…" : "Submit current & start new"}
          </UcatExamActionButton>
        </>
      }
      className="max-w-2xl"
    />
  );
}
