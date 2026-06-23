"use client";

import { UcatExamActionButton } from "@altitutor/ui";
import { QuestionEngineDialog } from "@/features/question-engine/components/question-engine-dialog";

export function ExitResultsDialog({
  onConfirm,
  onCancel,
}: {
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <QuestionEngineDialog
      title="Exit Results"
      message={
        <p>
          Are you sure you want to exit? You will not be able to return to these
          results.
        </p>
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
