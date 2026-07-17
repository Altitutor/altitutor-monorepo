'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { UseFormReturn } from 'react-hook-form'
import { useToast } from '@altitutor/ui'
import {
  inferManualStemMetadataRecommendation,
  type ManualStemMetadataRecommendation,
  type ManualStemMetadataSectionRow,
  type BulkImportCategoryRow,
  type BulkImportTagRow,
} from '@/features/ucat/questions/components/bulk-import/bulkImportMetadataInference'
import type { UcatQuestionStemFormValues } from '@/features/ucat/questions/types/schema'
import { proseMirrorToPlainText } from '@/features/ucat/shared/lib/rich-text'

function buildMetadataDetectionSignature(values: UcatQuestionStemFormValues): string {
  return JSON.stringify({
    stemText: proseMirrorToPlainText(values.stemText) ?? '',
    questions: (values.questions ?? []).map((question) => ({
      questionText: proseMirrorToPlainText(question.questionText) ?? '',
      options: (question.options ?? []).map((option) => proseMirrorToPlainText(option.answerText) ?? ''),
    })),
  })
}

function sameIds(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false
  const leftSorted = [...left].sort()
  const rightSorted = [...right].sort()
  return leftSorted.every((id, index) => id === rightSorted[index])
}

/**
 * Runs content parsers over stem form values and auto-applies section / category /
 * question type / tag recommendations (same behaviour as create-stem dialog).
 */
export function useManualStemMetadataAutoApply({
  enabled,
  resetKey,
  form,
  values,
  sections,
  categories,
  tags,
}: {
  enabled: boolean
  /** Change when switching stems so each entry can auto-apply once per content signature. */
  resetKey?: string | null
  form: UseFormReturn<UcatQuestionStemFormValues>
  values: UcatQuestionStemFormValues
  sections: ManualStemMetadataSectionRow[]
  categories: BulkImportCategoryRow[]
  tags: BulkImportTagRow[]
}): ManualStemMetadataRecommendation | null {
  const { toast } = useToast()
  const [recommendation, setRecommendation] = useState<ManualStemMetadataRecommendation | null>(null)
  const lastAutoAppliedSignatureRef = useRef<string | null>(null)
  const lastRecommendationSnapshotRef = useRef<string | null>(null)

  useEffect(() => {
    lastAutoAppliedSignatureRef.current = null
    lastRecommendationSnapshotRef.current = null
    setRecommendation(null)
  }, [resetKey])

  const applyRecommendation = useCallback(
    (
      next: ManualStemMetadataRecommendation,
      currentValues: UcatQuestionStemFormValues,
    ): boolean => {
      const previous = {
        sectionId: currentValues.sectionId,
        categoryId: currentValues.categoryId ?? null,
        questionTypes: (currentValues.questions ?? []).map((question) => question.questionType),
        tagIdsByQuestionIndex: Object.fromEntries(
          (currentValues.questions ?? []).map((question, index) => [index, [...(question.tagIds ?? [])]]),
        ) as Record<number, string[]>,
      }
      let changed = false

      if (next.sectionId && next.sectionId !== currentValues.sectionId) {
        form.setValue('sectionId', next.sectionId, { shouldDirty: true })
        changed = true
      }
      if (next.categoryId && next.categoryId !== (currentValues.categoryId ?? null)) {
        form.setValue('categoryId', next.categoryId, { shouldDirty: true })
        changed = true
      }
      if (next.questionType) {
        const questionType = next.questionType
        ;(currentValues.questions ?? []).forEach((question, index) => {
          if (question.questionType !== questionType) {
            form.setValue(`questions.${index}.questionType`, questionType, { shouldDirty: true })
            changed = true
          }
        })
      }
      Object.entries(next.tagIdsByQuestionIndex).forEach(([indexText, tagIds]) => {
        const index = Number(indexText)
        const current = currentValues.questions?.[index]?.tagIds ?? []
        if (!sameIds(current, tagIds)) {
          form.setValue(`questions.${index}.tagIds`, tagIds, { shouldDirty: true })
          changed = true
        }
      })

      if (!changed) return false

      toast({
        title: 'Detected UCAT metadata',
        description: 'Section, category, question type, or question tags were updated from the parser suggestion.',
        duration: 10_000,
        action: {
          label: 'Undo',
          onClick: () => {
            form.setValue('sectionId', previous.sectionId, { shouldDirty: true })
            form.setValue('categoryId', previous.categoryId, { shouldDirty: true })
            previous.questionTypes.forEach((questionType, index) => {
              form.setValue(`questions.${index}.questionType`, questionType, { shouldDirty: true })
            })
            Object.entries(previous.tagIdsByQuestionIndex).forEach(([indexText, tagIds]) => {
              const index = Number(indexText)
              form.setValue(`questions.${index}.tagIds`, tagIds, { shouldDirty: true })
            })
          },
        },
      })
      return true
    },
    [form, toast],
  )

  useEffect(() => {
    if (!enabled) {
      setRecommendation(null)
      return
    }

    const signature = buildMetadataDetectionSignature(values)
    const next = inferManualStemMetadataRecommendation({
      values,
      sections,
      categories,
      tags,
    })
    const recommendationSnapshot = JSON.stringify(next)
    if (lastRecommendationSnapshotRef.current !== recommendationSnapshot) {
      lastRecommendationSnapshotRef.current = recommendationSnapshot
      setRecommendation(next)
    }
    if (!next) return
    if (lastAutoAppliedSignatureRef.current === signature) return
    lastAutoAppliedSignatureRef.current = signature
    applyRecommendation(next, values)
  }, [enabled, values, sections, categories, tags, applyRecommendation])

  return recommendation
}
