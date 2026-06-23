"use client";

import { UcatExamActionButton } from "@altitutor/ui";
import { QuestionEngineDialog } from "@/features/question-engine/components/question-engine-dialog";

export function NoFlaggedDialog({ onClose }: { onClose: () => void }) {
  return (
    <QuestionEngineDialog
      title="No Flagged Questions"
      message="There are no flagged questions."
      actions={
        <UcatExamActionButton borders="all" onClick={onClose}>
          <span>
            <span className="underline">O</span>K
          </span>
        </UcatExamActionButton>
      }
    />
  );
}
