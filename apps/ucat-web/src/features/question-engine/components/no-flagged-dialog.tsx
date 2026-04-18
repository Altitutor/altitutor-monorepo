"use client";

import { UcatExamActionButton, UcatExamDialog } from "@altitutor/ui";

export function NoFlaggedDialog({ onClose }: { onClose: () => void }) {
  return (
    <UcatExamDialog
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
