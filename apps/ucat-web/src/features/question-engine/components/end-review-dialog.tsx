"use client";

import { UcatExamActionButton } from "@altitutor/ui";
import { QuestionEngineDialog } from "@/features/question-engine/components/question-engine-dialog";

export function EndReviewDialog({
  incompleteCount,
  onConfirm,
  onCancel,
}: {
  incompleteCount: number;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <QuestionEngineDialog
      title="End Review"
      message={
        <div className="space-y-3">
          <p>You have chosen to end the current review, but have</p>
          <p>
            {incompleteCount} incomplete question
            {incompleteCount !== 1 ? "s" : ""}. If you click Yes, you will NOT
            be able to return to this review.
          </p>
          <p>Are you sure you want to end this review?</p>
        </div>
      }
      actions={
        <>
          <UcatExamActionButton borders="all" onClick={onConfirm}>
            <span>
              <span className="underline">Y</span>es
            </span>
          </UcatExamActionButton>
          <UcatExamActionButton borders="all" onClick={onCancel}>
            <span>
              <span className="underline">N</span>o
            </span>
          </UcatExamActionButton>
        </>
      }
      className="max-w-lg"
    />
  );
}
