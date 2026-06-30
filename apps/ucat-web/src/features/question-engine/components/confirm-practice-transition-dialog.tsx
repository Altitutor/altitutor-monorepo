"use client";

import { UcatExamActionButton } from "@altitutor/ui";
import { QuestionEngineDialog } from "@/features/question-engine/components/question-engine-dialog";

export function ConfirmSubmitDialog({
  onConfirm,
  onCancel,
}: {
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <QuestionEngineDialog
      title="Submit"
      message={<p>Submit your answer and view the correct answer?</p>}
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

export function ConfirmNextStemDialog({
  onConfirm,
  onCancel,
}: {
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <QuestionEngineDialog
      title="Next question"
      message={<p>Go to the next question?</p>}
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

export function ConfirmFinishPracticeDialog({
  onConfirm,
  onCancel,
  submitsCurrentStem = false,
}: {
  onConfirm: () => void;
  onCancel: () => void;
  submitsCurrentStem?: boolean;
}) {
  return (
    <QuestionEngineDialog
      title="Finish practice"
      message={
        <p>
          {submitsCurrentStem
            ? "Finishing now will submit the current stem. Blank questions will count as attempted."
            : "Are you sure you want to finish this practice session?"}
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
