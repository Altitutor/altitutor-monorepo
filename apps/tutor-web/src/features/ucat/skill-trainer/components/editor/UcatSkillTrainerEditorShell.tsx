'use client'

import { useState } from 'react'
import type { UseFormReturn } from 'react-hook-form'
import type { UcatSkillTrainerApprovalStatus } from '@altitutor/shared'
import { UcatSkillTrainerContentEditor } from '@/features/ucat/skill-trainer/components/editor/UcatSkillTrainerContentEditor'
import { UcatSkillTrainerContentPreview } from '@/features/ucat/skill-trainer/components/editor/UcatSkillTrainerContentPreview'
import {
  UcatSkillTrainerPropertiesPanel,
  type SkillTrainerEditorMode,
} from '@/features/ucat/skill-trainer/components/editor/UcatSkillTrainerPropertiesPanel'
import type { UcatSkillTrainerItemFormValues } from '@/features/ucat/skill-trainer/types/schema'

type TrainerOption = { id: string; key: string; name: string }

type Props = {
  form: UseFormReturn<UcatSkillTrainerItemFormValues>
  trainers: TrainerOption[]
  approvalStatus?: UcatSkillTrainerApprovalStatus
  onApprovalChange?: (status: UcatSkillTrainerApprovalStatus) => void
  isNew?: boolean
  className?: string
  previewContentKey?: string
}

export function UcatSkillTrainerEditorShell({
  form,
  trainers,
  approvalStatus,
  onApprovalChange,
  isNew,
  className,
  previewContentKey,
}: Props) {
  const [editorMode, setEditorMode] = useState<SkillTrainerEditorMode>('edit')
  const [showAnswer, setShowAnswer] = useState(false)

  return (
    <div className={className ?? 'flex min-h-0 flex-1 overflow-hidden'}>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-background">
          {editorMode === 'edit' ? (
            <div className="p-4">
              <UcatSkillTrainerContentEditor form={form} />
            </div>
          ) : (
            <UcatSkillTrainerContentPreview
              form={form}
              showAnswer={showAnswer}
              contentKey={previewContentKey}
            />
          )}
        </div>
      </div>
      <UcatSkillTrainerPropertiesPanel
        form={form}
        trainers={trainers}
        editorMode={editorMode}
        onEditorModeChange={setEditorMode}
        showAnswer={showAnswer}
        onShowAnswerChange={setShowAnswer}
        approvalStatus={approvalStatus}
        onApprovalChange={onApprovalChange}
        isNew={isNew}
      />
    </div>
  )
}
