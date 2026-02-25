import { HelpCircle } from 'lucide-react'
import { UcatExamActionButton, UcatExamDialog } from '@altitutor/ui'

export function EngineIntroDialog({
  title,
  description,
  onStart,
  onCancel,
}: {
  title: string
  description: string
  onStart: () => void
  onCancel: () => void
}) {
  return (
    <UcatExamDialog
      title={title}
      icon={<HelpCircle className="h-12 w-12" />}
      message={<p>{description}</p>}
      actions={
        <>
          <UcatExamActionButton onClick={onStart}>Yes</UcatExamActionButton>
          <UcatExamActionButton onClick={onCancel}>No</UcatExamActionButton>
        </>
      }
      className="max-w-6xl"
    />
  )
}
