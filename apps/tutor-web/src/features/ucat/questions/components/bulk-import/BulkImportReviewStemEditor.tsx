'use client'

import { useEffect, useRef } from 'react'
import type { Editor } from '@tiptap/react'
import type { UseFormReturn } from 'react-hook-form'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import type { UcatQuestionStemFormValues } from '@/features/ucat/questions/types/schema'
import { ucatQuestionStemSchema } from '@/features/ucat/questions/types/schema'
import { UcatStemEditorShell } from '@/features/ucat/questions/components/stem-editor/UcatStemEditorShell'
import type { Json } from '@altitutor/shared'
import type {
  CategoryOption,
  TagOption,
  UcatSectionOption,
} from '@/features/ucat/questions/components/UcatQuestionStemDialog'
import type { UcatQuestionSourceChannel } from '@/features/ucat/questions/api/questions'

type BulkImportReviewStemEditorProps = {
  stemId: string
  values: UcatQuestionStemFormValues
  initialQuestionIndex: number
  sections: UcatSectionOption[]
  categories: CategoryOption[]
  tags: TagOption[]
  onUpdateStem: (stemId: string, values: UcatQuestionStemFormValues) => void
  onNewImageFileIds?: (fileIds: string[]) => void
  onActiveTextEditorChange?: (editor: Editor | null) => void
  sourceChannel?: UcatQuestionSourceChannel | null
  aiGenerationMetadata?: Json | null
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
  onActiveTextEditorChange,
  sourceChannel,
  aiGenerationMetadata,
}: BulkImportReviewStemEditorProps) {
  const createForm = useForm as unknown as (props: {
    resolver: unknown
    defaultValues: UcatQuestionStemFormValues
  }) => UseFormReturn<UcatQuestionStemFormValues>

  const form = createForm({
    resolver: zodResolver(ucatQuestionStemSchema),
    defaultValues: values,
  })
  const lastLocalValuesRef = useRef<UcatQuestionStemFormValues | null>(values)

  useEffect(() => {
    if (values === lastLocalValuesRef.current) return
    form.reset(values)
    lastLocalValuesRef.current = values
  }, [form, values])

  useEffect(() => {
    const watchAll = form.watch as (
      callback: (values: UcatQuestionStemFormValues) => void
    ) => { unsubscribe: () => void }

    const subscription = watchAll((nextValues) => {
      lastLocalValuesRef.current = nextValues
      onUpdateStem(stemId, nextValues)
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
      stemId={stemId}
      enableImages
      sectionTitleOverride={sectionMeta?.name ?? undefined}
      displayColumnsFallback={sectionMeta?.display_columns ?? undefined}
      initialQuestionIndex={initialQuestionIndex}
      showQuestionNavigator={questionCount > 1}
      onNewImageFileIds={onNewImageFileIds}
      onActiveTextEditorChange={onActiveTextEditorChange}
      sourceChannel={sourceChannel ?? null}
      aiGenerationMetadata={aiGenerationMetadata ?? null}
      aiReviewAvailable={false}
      className="flex h-full min-h-0 overflow-hidden"
    />
  )
}
