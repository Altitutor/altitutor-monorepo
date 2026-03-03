'use client'

import { UcatExamActionButton, UcatExamDialog } from '@altitutor/ui'

export function ReviewInstructionsDialog({ onClose }: { onClose: () => void }) {
  return (
    <UcatExamDialog
      title="Review Instructions"
      message={
        <div className="space-y-3 text-left">
          <p>Below is a summary of your answers. You can review your questions in three (3) different ways.</p>
          <p>The buttons in the lower right-hand corner correspond to these choices:</p>
          <ol className="list-decimal list-inside space-y-1">
            <li>Review all of your questions and answers.</li>
            <li>Review questions that are incomplete.</li>
            <li>Review questions that are flagged for review. (Click the &apos;flag&apos; icon to change the flag for review status.)</li>
          </ol>
          <p>You may also click on a question number to link directly to its location in the exam.</p>
        </div>
      }
      actions={
        <UcatExamActionButton borders="all" onClick={onClose}>
          <span><span className="underline">C</span>lose</span>
        </UcatExamActionButton>
      }
      className="max-w-2xl"
    />
  )
}
