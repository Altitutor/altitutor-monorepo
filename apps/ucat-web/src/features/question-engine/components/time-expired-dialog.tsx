'use client'

import { UcatExamActionButton, UcatExamDialog } from '@altitutor/ui'

export function TimeExpiredDialog({
  onOk,
  isSetMode,
}: {
  onOk: () => void
  isSetMode?: boolean
}) {
  return (
    <UcatExamDialog
      title="Time Expired"
      message={
        <p>
          {isSetMode
            ? 'Your time on this section has expired. Click OK to end the set.'
            : 'Your time on this section has expired. Timing has begun on the next section. Click OK to continue.'}
        </p>
      }
      actions={
        <UcatExamActionButton borders="all" onClick={onOk}>
          <span>
            <span className="underline">O</span>K
          </span>
        </UcatExamActionButton>
      }
      className="max-w-2xl"
    />
  )
}
