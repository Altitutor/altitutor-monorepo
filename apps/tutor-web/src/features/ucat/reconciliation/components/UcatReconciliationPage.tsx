'use client'

import { useState, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  UcatPageHeader,
  UcatPageSkeleton,
  UcatAccessDenied,
} from '@/features/ucat/shared/components'
import { useUcatAccess } from '@/features/ucat/shared/hooks/useUcatAccess'
import { StemsWithNoCategoryTable } from './StemsWithNoCategoryTable'
import { QuestionsWithNoExplanationTable } from './QuestionsWithNoExplanationTable'
import { PrivateStemsNotInSetTable } from './PrivateStemsNotInSetTable'
import { SetsReconciliationTable } from './SetsReconciliationTable'
import { MocksWithIncorrectSetsTable } from './MocksWithIncorrectSetsTable'
import { UcatSetEditorDialog } from '@/features/ucat/sets/components/UcatSetEditorDialog'
import { UcatMockEditorDialog } from '@/features/ucat/mocks/components/UcatMockEditorDialog'
import { UcatQuestionStemDialog } from '@/features/ucat/questions/components/UcatQuestionStemDialog'
import type { CategoryOption, TagOption } from '@/features/ucat/questions/components/UcatQuestionStemDialog'
import type { UcatQuestionStemBundlePayload } from '@/features/ucat/shared/types'
import type { UcatQuestionStemFormValues } from '@/features/ucat/questions/types/schema'
import {
  useUcatCategories,
  useUcatQuestionDetail,
  useUcatSections,
  useUcatTags,
  useUpdateUcatQuestionStem,
} from '@/features/ucat/questions/hooks/useUcatQuestions'
import { filterOptionsWithContent } from '@/features/ucat/shared/lib/rich-text'
import { parseTimeToSeconds } from '@/features/ucat/shared/lib/time-utils'
import { ucatKeys } from '@/features/ucat/shared/lib/query-keys'

function toExplanationNull(value: unknown): import('@altitutor/shared').Json | null {
  if (value == null) return null
  if (typeof value === 'string' && value === 'null') return null
  return value as import('@altitutor/shared').Json
}

function mapFormValuesToBundlePayload(
  payload: UcatQuestionStemFormValues,
  stemId: string
): UcatQuestionStemBundlePayload {
  return {
    stemId,
    sectionId: payload.sectionId,
    categoryId: payload.categoryId || null,
    stemText: payload.stemText,
    isPrivate: payload.isPrivate,
    questions: payload.questions.map((question, index) => ({
      index: index + 1,
      questionText: question.questionText,
      questionType: question.questionType,
      answerExplanation: toExplanationNull(question.answerExplanation),
      difficulty: question.difficulty,
      timeBurdenSeconds: parseTimeToSeconds(question.timeBurdenSeconds ?? '') ?? null,
      tagIds: question.tagIds ?? [],
      options: filterOptionsWithContent(question.options).map((option, optionIndex) => ({
        index: optionIndex + 1,
        answerText: option.answerText,
        answerExplanation: toExplanationNull(option.answerExplanation),
        isAnswer: option.isAnswer,
      })),
    })),
  }
}

export function UcatReconciliationPage() {
  const access = useUcatAccess()
  const queryClient = useQueryClient()
  const [editingStemId, setEditingStemId] = useState<string | null>(null)
  const [editingSetId, setEditingSetId] = useState<string | null>(null)
  const [editingMockId, setEditingMockId] = useState<string | null>(null)

  const sectionsQuery = useUcatSections()
  const categoriesQuery = useUcatCategories()
  const tagsQuery = useUcatTags()
  const stemDetail = useUcatQuestionDetail(editingStemId)
  const updateStemMutation = useUpdateUcatQuestionStem()

  const handleOpenStemDialog = useCallback((stemId: string) => {
    setEditingStemId(stemId)
  }, [])

  const handleSetEditorClose = useCallback(() => {
    setEditingSetId(null)
    queryClient.invalidateQueries({ queryKey: ucatKeys.reconciliation() })
  }, [queryClient])

  const handleMockEditorClose = useCallback(() => {
    setEditingMockId(null)
    queryClient.invalidateQueries({ queryKey: ucatKeys.reconciliation() })
  }, [queryClient])

  const handleStemUpdate = useCallback(
    async (payload: UcatQuestionStemFormValues) => {
      if (!editingStemId) return
      const mapped = mapFormValuesToBundlePayload(payload, editingStemId)
      await updateStemMutation.mutateAsync({ stemId: editingStemId, payload: mapped })
      setEditingStemId(null)
      queryClient.invalidateQueries({ queryKey: ucatKeys.reconciliation() })
    },
    [editingStemId, updateStemMutation, queryClient]
  )

  if (access.isLoading || !access.data) {
    return <UcatPageSkeleton />
  }

  if (!access.data) {
    return <UcatAccessDenied />
  }

  return (
    <div className="p-6 space-y-8">
      <UcatPageHeader
        title="Reconciliation"
        description="Identify and resolve UCAT content gaps: uncategorized stems, missing explanations, private stems not in sets, sets with incorrect questions/timing/sections, and mocks with incorrect sets."
        breadcrumbs={[{ label: 'UCAT', href: '/ucat' }, { label: 'Reconciliation' }]}
      />

      <div className="space-y-8">
        <StemsWithNoCategoryTable onOpenStemDialog={handleOpenStemDialog} />
        <QuestionsWithNoExplanationTable onOpenStemDialog={handleOpenStemDialog} />
        <PrivateStemsNotInSetTable onOpenStemDialog={handleOpenStemDialog} />
        <SetsReconciliationTable
          title="Sets with incorrect number of questions"
          dataKey="setsWithIncorrectQuestionCount"
          onEditSet={setEditingSetId}
        />
        <SetsReconciliationTable
          title="Sets with incorrect timing"
          dataKey="setsWithIncorrectTiming"
          onEditSet={setEditingSetId}
          showTimeColumn
        />
        <SetsReconciliationTable
          title="Sets with more than 1 section"
          dataKey="setsWithMultipleSections"
          onEditSet={setEditingSetId}
        />
        <MocksWithIncorrectSetsTable onEditMock={setEditingMockId} />
      </div>

      <UcatQuestionStemDialog
        open={!!editingStemId}
        title="Edit Question Stem"
        submitLabel="Save"
        onClose={() => setEditingStemId(null)}
        onSubmit={handleStemUpdate}
        sections={(sectionsQuery.data ?? []).map((s) => ({ id: s.id, name: s.name }))}
        categories={
          (categoriesQuery.data ?? []).map((c) => ({
            id: c.id,
            name: c.name,
            ucat_section_id: c.ucat_section_id,
          })) as CategoryOption[]
        }
        tags={(tagsQuery.data ?? []).map((t) => ({ id: t.id ?? '', name: t.name ?? '' })) as TagOption[]}
        initial={stemDetail.data}
        loading={updateStemMutation.isPending || stemDetail.isLoading}
      />

      <UcatSetEditorDialog
        open={!!editingSetId}
        setId={editingSetId}
        onClose={handleSetEditorClose}
      />

      <UcatMockEditorDialog
        open={!!editingMockId}
        mockId={editingMockId}
        onClose={handleMockEditorClose}
      />
    </div>
  )
}
