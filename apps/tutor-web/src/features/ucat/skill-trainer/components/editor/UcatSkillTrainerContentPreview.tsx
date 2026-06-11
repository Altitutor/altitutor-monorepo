'use client'

import type { UseFormReturn } from 'react-hook-form'
import { SkillTrainerItemPreview } from '@altitutor/ui'
import { UcatRichContentBlock } from '@/features/ucat/question-engine-preview/UcatRichContentBlock'
import { mapFormValuesToContent } from '@/features/ucat/skill-trainer/lib/form-mappers'
import type { UcatSkillTrainerItemFormValues } from '@/features/ucat/skill-trainer/types/schema'

type Props = {
  form: UseFormReturn<UcatSkillTrainerItemFormValues>
  showAnswer: boolean
  contentKey?: string
}

function TutorSkillTrainerRichContent({
  json,
  plainText,
  className,
}: {
  json?: Record<string, unknown> | null
  plainText: string
  className?: string
}) {
  return (
    <UcatRichContentBlock json={json} plainText={plainText} textTone="theme" className={className} />
  )
}

export function UcatSkillTrainerContentPreview({ form, showAnswer, contentKey }: Props) {
  const values = form.watch()
  const content = mapFormValuesToContent(values)

  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-background p-4">
      <SkillTrainerItemPreview
        trainerKey={values.trainerKey}
        content={content}
        contentKey={contentKey ?? values.trainerKey}
        showAnswer={showAnswer}
        RichContent={TutorSkillTrainerRichContent}
      />
    </div>
  )
}
