"use client";

import { UcatExamActionButton, UcatExamDialog } from "@altitutor/ui";

export function ConfirmSubmitDialog({
  onConfirm,
  onCancel,
}: {
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <UcatExamDialog
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
    <UcatExamDialog
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
}: {
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <UcatExamDialog
      title="Finish practice"
      message={<p>Are you sure you want to finish this practice session?</p>}
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
