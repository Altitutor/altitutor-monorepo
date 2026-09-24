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
import { UntaggedQuestionsTable } from './UntaggedQuestionsTable'
import { PrivateStemsNotInSetTable } from './PrivateStemsNotInSetTable'
import { StemsInMultipleSetsTable } from './StemsInMultipleSetsTable'
import { SetsReconciliationTable } from './SetsReconciliationTable'
import { MocksWithIncorrectSetsTable } from './MocksWithIncorrectSetsTable'
import { SET_RECONCILIATION_ISSUES } from '@/features/ucat/reconciliation/lib/set-issue-definitions'
import { UcatSetEditorDialog } from '@/features/ucat/sets/components/UcatSetEditorDialog'
import { UcatMockEditorDialog } from '@/features/ucat/mocks/components/UcatMockEditorDialog'
import { UcatQuestionStemDialog } from '@/features/ucat/questions/components/UcatQuestionStemDialog'
import type { CategoryOption, TagOption } from '@/features/ucat/questions/components/UcatQuestionStemDialog'
import type { UcatQuestionStemFormValues } from '@/features/ucat/questions/types/schema'
import { formValuesToStemBundlePayload } from '@/features/ucat/questions/lib/stem-editor-form'
import {
  useUcatCategories,
  useUcatQuestionDetail,
  useUcatSections,
  useUcatTags,
  useUpdateUcatQuestionStem,
} from '@/features/ucat/questions/hooks/useUcatQuestions'
import { ucatKeys } from '@/features/ucat/shared/lib/query-keys'
import { useReconciliationData } from '@/features/ucat/reconciliation/hooks/useReconciliation'
import {
  getMockReconciliationWarnings,
  getSetReconciliationWarnings,
  getStemReconciliationWarnings,
} from '@/features/ucat/reconciliation/lib/reconciliation-warning-labels'

export function UcatReconciliationPage() {
  const access = useUcatAccess()
  const queryClient = useQueryClient()
  const reconciliationQuery = useReconciliationData()
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
      const mapped = formValuesToStemBundlePayload(payload, editingStemId)
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
    <div className="space-y-8 py-8 md:py-10">
      <UcatPageHeader
        title="Reconciliation"
        description="Identify and resolve UCAT content gaps: uncategorized stems, missing explanations, unused private stems, sets with incorrect questions/timing/sections, and mocks with incorrect sets."
        breadcrumbs={[{ label: 'UCAT', href: '/ucat' }, { label: 'Reconciliation' }]}
      />

      <div className="space-y-10">
        <section className="space-y-6">
          <h2 className="text-xl font-semibold tracking-tight">Questions</h2>
          <div className="space-y-8">
            <StemsWithNoCategoryTable onOpenStemDialog={handleOpenStemDialog} />
            <QuestionsWithNoExplanationTable onOpenStemDialog={handleOpenStemDialog} />
            <UntaggedQuestionsTable onOpenStemDialog={handleOpenStemDialog} />
            <PrivateStemsNotInSetTable onOpenStemDialog={handleOpenStemDialog} onEditSet={setEditingSetId} />
            <StemsInMultipleSetsTable onOpenStemDialog={handleOpenStemDialog} onEditSet={setEditingSetId} />
          </div>
        </section>

        <section className="space-y-6">
          <h2 className="text-xl font-semibold tracking-tight">Sets</h2>
          <div className="space-y-8">
            {SET_RECONCILIATION_ISSUES.map((definition) => (
              <SetsReconciliationTable
                key={definition.slug}
                title={definition.title}
                description={definition.description}
                dataKey={definition.dataKey}
                onEditSet={setEditingSetId}
                showTimeColumn={definition.showTimeColumn}
              />
            ))}
          </div>
        </section>

        <section className="space-y-6">
          <h2 className="text-xl font-semibold tracking-tight">Mocks</h2>
          <div className="space-y-8">
            <MocksWithIncorrectSetsTable onEditMock={setEditingMockId} />
          </div>
        </section>
      </div>

      <UcatQuestionStemDialog
        open={!!editingStemId}
        title="Edit Question Stem"
        submitLabel="Save"
        onClose={() => setEditingStemId(null)}
        onSubmit={handleStemUpdate}
        sections={(sectionsQuery.data ?? []).map((s) => ({
          id: s.id,
          name: s.name,
          display_columns: s.display_columns,
        }))}
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
        warningPills={getStemReconciliationWarnings(reconciliationQuery.data, editingStemId)}
      />

      <UcatSetEditorDialog
        open={!!editingSetId}
        setId={editingSetId}
        onClose={handleSetEditorClose}
        warningPills={getSetReconciliationWarnings(reconciliationQuery.data, editingSetId)}
      />

      <UcatMockEditorDialog
        open={!!editingMockId}
        mockId={editingMockId}
        onClose={handleMockEditorClose}
        warningPills={getMockReconciliationWarnings(reconciliationQuery.data, editingMockId)}
      />
    </div>
  )
}
