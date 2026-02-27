import { Info } from 'lucide-react'
import { UcatExamActionButton, UcatExamDialog } from '@altitutor/ui'

export function EndExamDialog({
  onConfirm,
  onCancel,
}: {
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <UcatExamDialog
      title="End Exam"
      icon={<Info className="h-12 w-12" />}
      message={
        <div className="space-y-3">
          <p>You have chosen to end this exam.</p>
          <p>Are you sure you want to end this exam?</p>
        </div>
      }
      actions={
        <>
          <UcatExamActionButton borders="all" onClick={onConfirm}>
            <span><span className="underline">Y</span>es</span>
          </UcatExamActionButton>
          <UcatExamActionButton borders="all" onClick={onCancel}>
            <span><span className="underline">N</span>o</span>
          </UcatExamActionButton>
        </>
      }
      className="max-w-3xl"
    />
  )
}
