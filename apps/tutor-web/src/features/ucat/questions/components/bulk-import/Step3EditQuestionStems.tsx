'use client'

import { useEffect } from 'react'
import type { UseFormReturn } from 'react-hook-form'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { BulkImportQuestionNavigator } from '@/features/ucat/questions/components/bulk-import/BulkImportQuestionNavigator'
import type { BulkImportStemDraft } from '@/features/ucat/questions/hooks/useBulkImportWizard'
import { ucatQuestionStemSchema, type UcatQuestionStemFormValues } from '@/features/ucat/questions/types/schema'
import type { UcatSection } from '@/features/ucat/shared/types'
import {
  UcatQuestionStemFormContent,
  type CategoryOption,
  type TagOption,
} from '@/features/ucat/questions/components/UcatQuestionStemDialog'

type Step3EditQuestionStemsProps = {
  stems: BulkImportStemDraft[]
  activeIndex: number
  sections: UcatSection[]
  categories: CategoryOption[]
  tags: TagOption[]
  selectStem: (index: number) => void
  goToNextStem: () => void
  goToPreviousStem: () => void
  updateStemForm: (stemId: string, values: BulkImportStemDraft['values']) => void
}

export function Step3EditQuestionStems({
  stems,
  activeIndex,
  sections,
  categories,
  tags,
  selectStem,
  goToNextStem,
  goToPreviousStem,
  updateStemForm,
}: Step3EditQuestionStemsProps) {
  const count = stems.length
  const current = stems[activeIndex] ?? null

  if (!current || count === 0) {
    return (
      <div className="space-y-2">
        <h2 className="text-base font-semibold">Edit question stems</h2>
        <p className="text-sm text-muted-foreground">
          No parsed stems available yet. Go back to the previous step and parse your document first.
        </p>
      </div>
    )

    // tags are currently unused but kept for future extension
    void tags
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold">Edit question stems</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Tidy up the stem text, questions, and answer options for each parsed stem. You can still
          adjust categories and visibility here.
        </p>
      </div>

      <BulkImportQuestionNavigator
        count={count}
        activeIndex={activeIndex}
        onSelectIndex={selectStem}
        onPrevious={goToPreviousStem}
        onNext={goToNextStem}
      />

      <BulkImportStemEditor
        key={current.id}
        stem={current}
        sections={sections}
        categories={categories}
        tags={tags}
        updateStemForm={updateStemForm}
      />
    </div>
  )
}

type BulkImportStemEditorProps = {
  stem: BulkImportStemDraft
  sections: UcatSection[]
  categories: CategoryOption[]
  tags: TagOption[]
  updateStemForm: (stemId: string, values: UcatQuestionStemFormValues) => void
}

function BulkImportStemEditor({
  stem,
  sections,
  categories,
  tags,
  updateStemForm,
}: BulkImportStemEditorProps) {
  // Type instantiation for this large nested form can be deep; the schema
  // already validates the shape at runtime.
  const createForm = useForm as unknown as (props: {
    resolver: unknown
    defaultValues: UcatQuestionStemFormValues
  }) => UseFormReturn<UcatQuestionStemFormValues>

  const form = createForm({
    resolver: zodResolver(ucatQuestionStemSchema),
    defaultValues: stem.values,
  })

  useEffect(() => {
    const subscription = form.watch(() => {
      const next = form.getValues()
      updateStemForm(stem.id, next)
    })
    return () => subscription.unsubscribe()
  }, [form, stem.id, updateStemForm])

  return (
    <div className="border rounded-md">
      <UcatQuestionStemFormContent
        form={form}
        sections={sections.map((s) => ({ id: s.id, name: s.name }))}
        categories={categories}
        tags={tags}
        stemId={null}
        enableImages={false}
      />
    </div>
  )
}

