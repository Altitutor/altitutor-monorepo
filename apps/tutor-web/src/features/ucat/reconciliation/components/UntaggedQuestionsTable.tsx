'use client'

import React, { useMemo, useCallback } from 'react'
import { TableRow, TableCell, Button, DataTableToolbar, SearchableSelect, useToast } from '@altitutor/ui'
import { ReconciliationTable } from './ReconciliationTable'
import { proseMirrorToPlainText } from '@/features/ucat/shared/lib/rich-text'
import type { UntaggedQuestion } from '../api/reconciliation'
import { useReconciliationData, useAddQuestionTag } from '../hooks/useReconciliation'
import { useUcatSections, useUcatTags } from '@/features/ucat/questions/hooks/useUcatQuestions'
import { mapTagsToOptions, taxonomyDisplayLabel } from '@/features/ucat/shared/lib/taxonomy-paths'
import { useUcatTableState, applyCoreStringFilter, applySingleSelectFilter, applySort } from '@/features/ucat/shared/hooks/useUcatTableState'
import type { DataTableColumnDefinition, DataTableFilterDefinition, DataTableSortOption } from '@altitutor/shared'
import { tutorTableBodyRow } from '@/shared/lib/tutor-visual'

const TRUNCATE_LEN = 80

function truncate(text: string, max: number): string {
  if (text.length <= max) return text
  return text.slice(0, max).trim() + '…'
}

export function UntaggedQuestionsTable({
  onOpenStemDialog,
}: {
  onOpenStemDialog?: (stemId: string) => void
}) {
  const { toast } = useToast()
  const { data, isLoading } = useReconciliationData()
  const sectionsQuery = useUcatSections()
  const tagsQuery = useUcatTags()
  const addTagMutation = useAddQuestionTag()

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
      section_id: (q: UntaggedQuestion) => q.sectionName ?? '',
      stem_text: (q: UntaggedQuestion) =>
        proseMirrorToPlainText(q.stemText as import('@altitutor/shared').Json) ?? '',
      question_text: (q: UntaggedQuestion) =>
        proseMirrorToPlainText(q.questionText as import('@altitutor/shared').Json) ?? '',
    }),
    []
  )

  const filteredQuestions = useMemo(() => {
    const questions = data?.untaggedQuestions ?? []
    let result = questions
    const { search } = tableState.state
    if (search.trim()) {
      result = result.filter(
        (q) =>
          applyCoreStringFilter(questionAccessors.stem_text(q), search) ||
          applyCoreStringFilter(questionAccessors.question_text(q), search) ||
          applyCoreStringFilter(q.sectionName, search)
      )
    }
    result = result.filter((q) => applySingleSelectFilter(tableState.state, 'section_id', q.sectionId))
    result = applySort(result, tableState.state.sortBy, tableState.state.sortDirection, questionAccessors)
    return result
  }, [data?.untaggedQuestions, tableState.state, questionAccessors])

  const handleAddTag = useCallback(
    async (item: UntaggedQuestion, tagId: string) => {
      try {
        await addTagMutation.mutateAsync({ stemId: item.stemId, questionId: item.questionId, tagId })
        toast({
          title: 'Tag added',
          description: (
            <>
              The question has been tagged.{' '}
              <button
                type="button"
                onClick={() => onOpenStemDialog?.(item.stemId)}
                className="text-primary underline font-medium hover:underline"
              >
                View question stem
              </button>
            </>
          ),
        })
      } catch {
        toast({
          title: 'Failed to add tag',
          description: 'Please try again.',
          variant: 'destructive',
        })
      }
    },
    [addTagMutation, toast, onOpenStemDialog]
  )

  const tags = useMemo(() => mapTagsToOptions(tagsQuery.data ?? []), [tagsQuery.data])

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
    <ReconciliationTable<UntaggedQuestion>
      title="Untagged questions"
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
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onOpenStemDialog?.(item.stemId)}
                >
                  View stem
                </Button>
                <SearchableSelect<{ id: string; name: string; label?: string | null }>
                  items={tags}
                  value={null}
                  onValueChange={async (tag) => {
                    if (tag) await handleAddTag(item, tag.id)
                  }}
                  getItemLabel={(t) => taxonomyDisplayLabel(t)}
                  getItemId={(t) => t.id}
                  placeholder="Add tag"
                  disabled={addTagMutation.isPending}
                  trigger={
                    <Button variant="default" size="sm" disabled={addTagMutation.isPending}>
                      Add tag
                    </Button>
                  }
                />
              </div>
            </TableCell>
          </TableRow>
        )
      }}
    />
  )
}
