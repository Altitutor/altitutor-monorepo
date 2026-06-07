'use client'

import { useEffect } from 'react'
import type { Resolver } from 'react-hook-form'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import type { UcatQuestionStemFormValues } from '@/features/ucat/questions/types/schema'
import { ucatQuestionStemSchema } from '@/features/ucat/questions/types/schema'
import { UcatStemEditorShell } from '@/features/ucat/questions/components/stem-editor/UcatStemEditorShell'
import type {
  CategoryOption,
  TagOption,
  UcatSectionOption,
} from '@/features/ucat/questions/components/UcatQuestionStemDialog'

type BulkImportReviewStemEditorProps = {
  stemId: string
  values: UcatQuestionStemFormValues
  initialQuestionIndex: number
  sections: UcatSectionOption[]
  categories: CategoryOption[]
  tags: TagOption[]
  onUpdateStem: (stemId: string, values: UcatQuestionStemFormValues) => void
  onNewImageFileIds?: (fileIds: string[]) => void
}

export function BulkImportReviewStemEditor({
  stemId,
  values,
  initialQuestionIndex,
  sections,
  categories,
  tags,
  onUpdateStem,
  onNewImageFileIds,
}: BulkImportReviewStemEditorProps) {
  // @ts-expect-error TS2589 - recursive Json in schema; runtime validated by Zod.
  const form = useForm<UcatQuestionStemFormValues>({
    resolver: zodResolver(ucatQuestionStemSchema) as Resolver<UcatQuestionStemFormValues>,
    defaultValues: values,
  })

  useEffect(() => {
    const subscription = form.watch((nextValues) => {
      onUpdateStem(stemId, nextValues as UcatQuestionStemFormValues)
    })
    return () => subscription.unsubscribe()
  }, [form, onUpdateStem, stemId])

  const sectionMeta = sections.find((section) => section.id === values.sectionId)
  const questionCount = values.questions?.length ?? 0

  return (
    <UcatStemEditorShell
      flush
      form={form}
      sections={sections}
      categories={categories}
      tags={tags}
      enableImages
      sectionTitleOverride={sectionMeta?.name ?? undefined}
      displayColumnsFallback={sectionMeta?.display_columns ?? undefined}
      initialQuestionIndex={initialQuestionIndex}
      showQuestionNavigator={questionCount > 1}
      onNewImageFileIds={onNewImageFileIds}
      className="flex h-full min-h-0 overflow-hidden"
    />
  )
}
