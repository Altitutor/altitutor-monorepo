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

export type StemMetadataDetectionKey =
  | 'section'
  | 'category'
  | `response:${number}`
  | `tags:${number}`

export type StemMetadataDetectionControls = {
  pendingDiff: PendingStemMetadataDiff | null
  onAccept: (key: StemMetadataDetectionKey) => void
  onDismiss: (key: StemMetadataDetectionKey) => void
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
        inference.reviewState === 'blocked'
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
  acceptField: (key: StemMetadataDetectionKey) => void
  dismissField: (key: StemMetadataDetectionKey) => void
} {
  const [recommendation, setRecommendation] = useState<ManualStemMetadataRecommendation | null>(null)
  const [dismissed, setDismissed] = useState<{
    signature: string
    fields: StemMetadataDetectionKey[]
  } | null>(null)
  const lastRecommendationSnapshotRef = useRef<string | null>(null)
  const contentSignature = useMemo(() => buildMetadataDetectionSignature(values), [values])

  useEffect(() => {
    setDismissed(null)
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

  const dismissedFields = useMemo(
    () => dismissed?.signature === contentSignature ? dismissed.fields : [],
    [contentSignature, dismissed],
  )
  const pendingDiff = useMemo(() => {
    if (!enabled) return null
    const diff = getPendingStemMetadataDiff(recommendation, values)
    if (!diff) return null
    const filtered: PendingStemMetadataDiff = {
      sectionId: dismissedFields.includes('section') ? null : diff.sectionId,
      categoryId: dismissedFields.includes('category') ? null : diff.categoryId,
      responseContractsByQuestionIndex: Object.fromEntries(
        Object.entries(diff.responseContractsByQuestionIndex).filter(
          ([index]) => !dismissedFields.includes(`response:${Number(index)}`),
        ),
      ),
      tagIdsByQuestionIndex: Object.fromEntries(
        Object.entries(diff.tagIdsByQuestionIndex).filter(
          ([index]) => !dismissedFields.includes(`tags:${Number(index)}`),
        ),
      ),
    }
    return filtered.sectionId || filtered.categoryId
      || Object.keys(filtered.responseContractsByQuestionIndex).length > 0
      || Object.keys(filtered.tagIdsByQuestionIndex).length > 0
      ? filtered
      : null
  }, [dismissedFields, enabled, recommendation, values])

  const dismissField = useCallback((key: StemMetadataDetectionKey) => {
    setDismissed((current) => {
      const fields = current?.signature === contentSignature ? current.fields : []
      return {
        signature: contentSignature,
        fields: fields.includes(key) ? fields : [...fields, key],
      }
    })
  }, [contentSignature])

  const acceptField = useCallback((key: StemMetadataDetectionKey) => {
    if (!recommendation) return
    if (key === 'section' && recommendation.sectionId) {
      form.setValue('sectionId', recommendation.sectionId, { shouldDirty: true })
    } else if (key === 'category' && recommendation.categoryId) {
      form.setValue('categoryId', recommendation.categoryId, { shouldDirty: true })
    } else if (key.startsWith('response:')) {
      const index = Number(key.slice('response:'.length))
      const inference = recommendation.responseContractsByQuestionIndex[index]
      if (inference && inference.reviewState !== 'blocked') {
        if (inference.responseType.value) {
          form.setValue(`questions.${index}.responseType`, inference.responseType.value, { shouldDirty: true })
        }
        if (inference.answerScheme.value) {
          form.setValue(`questions.${index}.answerScheme`, inference.answerScheme.value, { shouldDirty: true })
        }
      }
    } else if (key.startsWith('tags:')) {
      const index = Number(key.slice('tags:'.length))
      const tagIds = recommendation.tagIdsByQuestionIndex[index]
      if (tagIds) {
        form.setValue(`questions.${index}.tagIds`, tagIds, { shouldDirty: true })
      }
    }
    dismissField(key)
  }, [dismissField, form, recommendation])

  return {
    recommendation,
    pendingDiff,
    acceptField,
    dismissField,
  }
}
