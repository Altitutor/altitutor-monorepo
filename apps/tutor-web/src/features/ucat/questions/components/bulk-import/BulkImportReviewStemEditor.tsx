'use client'

import { useEffect, useState } from 'react'
import type { Editor } from '@tiptap/react'
import type { UseFormReturn } from 'react-hook-form'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import type { UcatQuestionStemFormValues } from '@/features/ucat/questions/types/schema'
import { ucatQuestionStemSchema } from '@/features/ucat/questions/types/schema'
import { UcatStemEditorShell } from '@/features/ucat/questions/components/stem-editor/UcatStemEditorShell'
import { UcatRichTextFloatingToolbar } from '@/features/ucat/shared/components/UcatRichTextFloatingToolbar'
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
  const createForm = useForm as unknown as (props: {
    resolver: unknown
    defaultValues: UcatQuestionStemFormValues
  }) => UseFormReturn<UcatQuestionStemFormValues>

  const form = createForm({
    resolver: zodResolver(ucatQuestionStemSchema),
    defaultValues: values,
  })

  useEffect(() => {
    const watchAll = form.watch as (
      callback: (values: UcatQuestionStemFormValues) => void
    ) => { unsubscribe: () => void }

    const subscription = watchAll((nextValues) => {
      onUpdateStem(stemId, nextValues)
    })
    return () => subscription.unsubscribe()
  }, [form, onUpdateStem, stemId])

  const sectionMeta = sections.find((section) => section.id === values.sectionId)
  const questionCount = values.questions?.length ?? 0
  const [activeTextEditor, setActiveTextEditor] = useState<Editor | null>(null)

  return (
    <div className="relative flex h-full min-h-0 overflow-hidden">
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
      onActiveTextEditorChange={setActiveTextEditor}
      className="flex h-full min-h-0 overflow-hidden"
    />
      <UcatRichTextFloatingToolbar editor={activeTextEditor} />
    </div>
  )
}
