"use client";

import React from "react";
import { UcatExamActionButton } from "@altitutor/ui";
import { QuestionEngineDialog } from "@/features/question-engine/components/question-engine-dialog";

export function TimeExpiredDialog({
  onOk,
  isSetMode,
  isPracticeMode,
  practiceReviewAtEnd = false,
}: {
  onOk: () => void;
  isSetMode?: boolean;
  /** When true: "Your time has run out. Click OK to view the answer." */
  isPracticeMode?: boolean;
  /** Session-timed practice completes and opens review instead of revealing one stem. */
  practiceReviewAtEnd?: boolean;
}) {
  const message = practiceReviewAtEnd
    ? "Your practice time has run out. Review your answers when you're ready."
    : isPracticeMode
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
          {practiceReviewAtEnd ? (
            "Review answers"
          ) : (
            <span>
              <span className="underline">O</span>K
            </span>
          )}
        </UcatExamActionButton>
      }
      className="max-w-2xl"
    />
  );
}
