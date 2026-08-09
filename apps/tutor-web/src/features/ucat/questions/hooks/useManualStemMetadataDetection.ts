'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { UseFormReturn } from 'react-hook-form'
import {
  inferManualStemMetadataRecommendation,
  type ManualStemMetadataRecommendation,
  type ManualStemMetadataSectionRow,
  type BulkImportCategoryRow,
  type BulkImportTagRow,
} from '@/features/ucat/questions/components/bulk-import/bulkImportMetadataInference'
import type { UcatQuestionStemFormValues } from '@/features/ucat/questions/types/schema'
import type { ResponseContractInference } from '@/features/ucat/questions/lib/parsers/responseClassification'
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

export type PendingStemMetadataDiff = {
  sectionId: string | null
  categoryId: string | null
  responseContractsByQuestionIndex: Record<number, ResponseContractInference>
  tagIdsByQuestionIndex: Record<number, string[]>
}

/**
 * Diffs a parser recommendation against current form values.
 * Only fields that would change are included (null / empty when unchanged).
 */
export function getPendingStemMetadataDiff(
  recommendation: ManualStemMetadataRecommendation | null,
  values: UcatQuestionStemFormValues,
): PendingStemMetadataDiff | null {
  if (!recommendation) return null

  const sectionId =
    recommendation.sectionId && recommendation.sectionId !== values.sectionId
      ? recommendation.sectionId
      : null
  const categoryId =
    recommendation.categoryId && recommendation.categoryId !== (values.categoryId ?? null)
      ? recommendation.categoryId
      : null

  const responseContractsByQuestionIndex: Record<number, ResponseContractInference> = {}
  Object.entries(recommendation.responseContractsByQuestionIndex).forEach(
    ([indexText, inference]) => {
      const index = Number(indexText)
      const question = values.questions?.[index]
      if (!question) return
      if (
        (inference.responseType.value && inference.responseType.value !== question.responseType) ||
        (inference.answerScheme.value && inference.answerScheme.value !== question.answerScheme) ||
        inference.reviewState !== 'prefilled'
      ) {
        responseContractsByQuestionIndex[index] = inference
      }
    }
  )

  const tagIdsByQuestionIndex: Record<number, string[]> = {}
  Object.entries(recommendation.tagIdsByQuestionIndex).forEach(([indexText, tagIds]) => {
    const index = Number(indexText)
    const current = values.questions?.[index]?.tagIds ?? []
    if (tagIds.length > 0 && !sameIds(current, tagIds)) {
      tagIdsByQuestionIndex[index] = tagIds
    }
  })

  if (
    !sectionId &&
    !categoryId &&
    Object.keys(responseContractsByQuestionIndex).length === 0 &&
    Object.keys(tagIdsByQuestionIndex).length === 0
  ) {
    return null
  }

  return { sectionId, categoryId, responseContractsByQuestionIndex, tagIdsByQuestionIndex }
}

export function applyStemMetadataRecommendation(
  form: UseFormReturn<UcatQuestionStemFormValues>,
  recommendation: ManualStemMetadataRecommendation,
): void {
  if (recommendation.sectionId) {
    form.setValue('sectionId', recommendation.sectionId, { shouldDirty: true })
  }
  if (recommendation.categoryId) {
    form.setValue('categoryId', recommendation.categoryId, { shouldDirty: true })
  }
  Object.entries(recommendation.responseContractsByQuestionIndex).forEach(
    ([indexText, inference]) => {
      if (inference.reviewState === 'blocked') return
      const index = Number(indexText)
      const responseType = inference.responseType.value
      const answerScheme = inference.answerScheme.value
      if (responseType) {
        form.setValue(`questions.${index}.responseType`, responseType, { shouldDirty: true })
        form.setValue(
          `questions.${index}.questionType`,
          responseType === 'drag_and_drop' ? 'syllogism' : 'multiple_choice',
          { shouldDirty: true },
        )
      }
      if (answerScheme) {
        form.setValue(`questions.${index}.answerScheme`, answerScheme, { shouldDirty: true })
      }
    }
  )
  Object.entries(recommendation.tagIdsByQuestionIndex).forEach(([indexText, tagIds]) => {
    const index = Number(indexText)
    form.setValue(`questions.${index}.tagIds`, tagIds, { shouldDirty: true })
  })
}

/**
 * Runs content parsers over stem form values and surfaces pending metadata
 * suggestions. Does not auto-apply — callers accept or dismiss explicitly.
 */
export function useManualStemMetadataDetection({
  enabled,
  resetKey,
  form,
  values,
  sections,
  categories,
  tags,
}: {
  enabled: boolean
  /** Change when switching stems so dismiss state resets per entry. */
  resetKey?: string | null
  form: UseFormReturn<UcatQuestionStemFormValues>
  values: UcatQuestionStemFormValues
  sections: ManualStemMetadataSectionRow[]
  categories: BulkImportCategoryRow[]
  tags: BulkImportTagRow[]
}): {
  recommendation: ManualStemMetadataRecommendation | null
  pendingDiff: PendingStemMetadataDiff | null
  accept: () => void
  dismiss: () => void
} {
  const [recommendation, setRecommendation] = useState<ManualStemMetadataRecommendation | null>(null)
  const [dismissedSignature, setDismissedSignature] = useState<string | null>(null)
  const lastRecommendationSnapshotRef = useRef<string | null>(null)
  const contentSignature = useMemo(() => buildMetadataDetectionSignature(values), [values])

  useEffect(() => {
    setDismissedSignature(null)
    lastRecommendationSnapshotRef.current = null
    setRecommendation(null)
  }, [resetKey])

  useEffect(() => {
    if (!enabled) {
      setRecommendation(null)
      return
    }

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
  }, [enabled, values, sections, categories, tags])

  const isDismissed = dismissedSignature === contentSignature
  const pendingDiff = useMemo(() => {
    if (!enabled || isDismissed) return null
    return getPendingStemMetadataDiff(recommendation, values)
  }, [enabled, isDismissed, recommendation, values])

  const accept = useCallback(() => {
    if (!recommendation) return
    applyStemMetadataRecommendation(form, recommendation)
    setDismissedSignature(contentSignature)
  }, [recommendation, form, contentSignature])

  const dismiss = useCallback(() => {
    setDismissedSignature(contentSignature)
  }, [contentSignature])

  return {
    recommendation,
    pendingDiff,
    accept,
    dismiss,
  }
}
