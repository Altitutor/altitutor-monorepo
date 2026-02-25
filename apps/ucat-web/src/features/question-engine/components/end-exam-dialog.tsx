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
          <UcatExamActionButton onClick={onConfirm}>Yes</UcatExamActionButton>
          <UcatExamActionButton onClick={onCancel}>No</UcatExamActionButton>
        </>
      }
      className="max-w-3xl"
    />
  )
}
