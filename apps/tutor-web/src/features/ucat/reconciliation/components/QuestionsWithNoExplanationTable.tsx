'use client'

import React, { useMemo } from 'react'
import { TableRow, TableCell, Button, DataTableToolbar } from '@altitutor/ui'
import { ReconciliationTable } from './ReconciliationTable'
import { proseMirrorToPlainText } from '@/features/ucat/shared/lib/rich-text'
import type { QuestionWithNoExplanation } from '../api/reconciliation'
import { useReconciliationData } from '../hooks/useReconciliation'
import { useUcatSections } from '@/features/ucat/questions/hooks/useUcatQuestions'
import { useUcatTableState, applyCoreStringFilter, applySingleSelectFilter, applySort } from '@/features/ucat/shared/hooks/useUcatTableState'
import type { DataTableColumnDefinition, DataTableFilterDefinition, DataTableSortOption } from '@altitutor/shared'
import { tutorTableBodyRow } from '@/shared/lib/tutor-visual'

const TRUNCATE_LEN = 80

function truncate(text: string, max: number): string {
  if (text.length <= max) return text
  return text.slice(0, max).trim() + '…'
}

export function QuestionsWithNoExplanationTable({
  onOpenStemDialog,
}: {
  onOpenStemDialog?: (stemId: string) => void
}) {
  const { data, isLoading } = useReconciliationData()
  const sectionsQuery = useUcatSections()

  const columnDefinitions: DataTableColumnDefinition[] = [
    { key: 'section_id', label: 'Section', visibleByDefault: true },
    { key: 'stem_text', label: 'Question stem', visibleByDefault: true },
    { key: 'question_text', label: 'Question', visibleByDefault: true },
  ]

  const sortOptions: DataTableSortOption[] = [
    { key: 'section_id', label: 'Section' },
    { key: 'stem_text', label: 'Question stem' },
    { key: 'question_text', label: 'Question' },
  ]

  const tableState = useUcatTableState(columnDefinitions.filter((c) => c.visibleByDefault !== false).map((c) => c.key))

  const sectionFilterDef: DataTableFilterDefinition = useMemo(
    () => ({
      key: 'section_id',
      label: 'Section',
      options: (sectionsQuery.data ?? []).map((s) => ({ label: s.name ?? 'Untitled', value: s.id ?? '' })),
    }),
    [sectionsQuery.data]
  )

  const questionAccessors = useMemo(
    () => ({
      section_id: (q: QuestionWithNoExplanation) => q.sectionName ?? '',
      stem_text: (q: QuestionWithNoExplanation) =>
        proseMirrorToPlainText(q.stemText as import('@altitutor/shared').Json) ?? '',
      question_text: (q: QuestionWithNoExplanation) =>
        proseMirrorToPlainText(q.questionText as import('@altitutor/shared').Json) ?? '',
    }),
    []
  )

  const filteredQuestions = useMemo(() => {
    const questions = data?.questionsWithNoExplanation ?? []
    let result = questions
    const { search } = tableState.state
    if (search.trim()) {
      result = result.filter((q) => {
        const stemText = questionAccessors.stem_text(q)
        const questionText = questionAccessors.question_text(q)
        return (
          applyCoreStringFilter(stemText, search) ||
          applyCoreStringFilter(questionText, search) ||
          applyCoreStringFilter(q.sectionName, search)
        )
      })
    }
    result = result.filter((q) => applySingleSelectFilter(tableState.state, 'section_id', q.sectionId))
    result = applySort(result, tableState.state.sortBy, tableState.state.sortDirection, questionAccessors)
    return result
  }, [data?.questionsWithNoExplanation, tableState.state, questionAccessors])

  const toolbar = (
    <DataTableToolbar
      state={tableState.state}
      onSearchChange={tableState.actions.onSearchChange}
      onFiltersChange={tableState.actions.onFiltersChange}
      onSortChange={tableState.actions.onSortChange}
      onGroupByChange={tableState.actions.onGroupByChange}
      onVisibleColumnsChange={tableState.actions.onVisibleColumnsChange}
      onQuickFilterApply={tableState.actions.onQuickFilterApply}
      onReset={tableState.actions.onReset}
      filterDefinitions={[sectionFilterDef]}
      columnDefinitions={columnDefinitions}
      sortOptions={sortOptions}
      searchPlaceholder="Search questions..."
    />
  )

  return (
    <ReconciliationTable<QuestionWithNoExplanation>
      title="Questions with no explanation"
      items={filteredQuestions}
      isLoading={isLoading}
      columnDefinitions={columnDefinitions}
      visibleColumnKeys={tableState.state.visibleColumns}
      toolbar={toolbar}
      renderRow={(item, _index, visibleColumnKeys) => {
        const stemText = proseMirrorToPlainText(item.stemText as import('@altitutor/shared').Json) ?? ''
        const questionText = proseMirrorToPlainText(item.questionText as import('@altitutor/shared').Json) ?? ''
        const cells: Record<string, React.ReactNode> = {
          section_id: <TableCell className="whitespace-nowrap">{item.sectionName || '—'}</TableCell>,
          stem_text: (
            <TableCell className="max-w-[300px]" title={stemText}>
              {truncate(stemText, TRUNCATE_LEN) || '—'}
            </TableCell>
          ),
          question_text: (
            <TableCell className="max-w-[400px] text-muted-foreground" title={questionText}>
              {truncate(questionText, TRUNCATE_LEN) || '—'}
            </TableCell>
          ),
        }
        return (
          <TableRow key={`${item.stemId}-${item.questionId}`} className={tutorTableBodyRow}>
            {visibleColumnKeys.map((key) => cells[key]).filter((c): c is React.ReactNode => c != null)}
            <TableCell>
              <Button
                variant="default"
                size="sm"
                onClick={() => onOpenStemDialog?.(item.stemId)}
              >
                Edit question
              </Button>
            </TableCell>
          </TableRow>
        )
      }}
    />
  )
}
