"use client";

import { UcatExamActionButton } from "@altitutor/ui";
import { QuestionEngineDialog } from "@/features/question-engine/components/question-engine-dialog";

export function TimeExpiredDialog({
  onOk,
  isSetMode,
  isPracticeMode,
}: {
  onOk: () => void;
  isSetMode?: boolean;
  /** When true: "Your time has run out. Click OK to view the answer." */
  isPracticeMode?: boolean;
}) {
  const message = isPracticeMode
    ? "Your time has run out. Click OK to view the answer."
    : isSetMode
      ? "Your time on this section has expired. Click OK to end the set."
      : "Your time on this section has expired. Timing has begun on the next section. Click OK to continue.";

  return (
    <QuestionEngineDialog
      title="Time Expired"
      message={<p>{message}</p>}
      actions={
        <UcatExamActionButton borders="all" onClick={onOk}>
          <span>
            <span className="underline">O</span>K
          </span>
        </UcatExamActionButton>
      }
      className="max-w-2xl"
    />
  );
}
