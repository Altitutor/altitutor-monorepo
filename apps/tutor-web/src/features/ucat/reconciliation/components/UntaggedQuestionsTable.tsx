'use client'

import React, { useMemo, useCallback, useState } from 'react'
import { TableRow, TableCell, Button, DataTableToolbar, useToast } from '@altitutor/ui'
import { useQueryClient } from '@tanstack/react-query'
import { ReconciliationTable } from './ReconciliationTable'
import { proseMirrorToPlainText } from '@/features/ucat/shared/lib/rich-text'
import type { UntaggedQuestion } from '../api/reconciliation'
import { useReconciliationData, useAddQuestionTags } from '../hooks/useReconciliation'
import { useUcatSections, useUcatTags } from '@/features/ucat/questions/hooks/useUcatQuestions'
import { applyCoreStringFilter, applySingleSelectFilter, applySort } from '@/features/ucat/shared/hooks/useUcatTableState'
import { useUcatTableUrlState } from '@/features/ucat/shared/hooks/useUcatTableUrlState'
import type { DataTableColumnDefinition, DataTableFilterDefinition, DataTableSortOption, Json } from '@altitutor/shared'
import { tutorBtnOutline, tutorBtnPrimary, tutorTableBodyRow, tutorToolbarProps } from '@/shared/lib/tutor-visual'
import {
  UcatQuestionStemApprovalQueueDialog,
  type UcatApprovalQueueEntry,
} from '@/features/ucat/questions/components/approval-queue/UcatQuestionStemApprovalQueue'
import { bulkImportSectionFromUcatName } from '@/features/ucat/questions/components/bulk-import/bulkImportLogicalLines'
import { inferBulkImportTagIdsForParsedQuestion } from '@/features/ucat/questions/components/bulk-import/bulkImportMetadataInference'
import type { ParsedStem } from '@/features/ucat/questions/lib/parsers/core'
import { ucatQuestionsApi } from '@/features/ucat/questions/api/questions'
import { ucatKeys } from '@/features/ucat/shared/lib/query-keys'

const TRUNCATE_LEN = 80

function truncate(text: string, max: number): string {
  if (text.length <= max) return text
  return text.slice(0, max).trim() + '…'
}

function richTextishToPlainText(value: unknown): string {
  if (typeof value === 'string') return value
  return proseMirrorToPlainText(value as Json) ?? ''
}

function toParsedStem(item: UntaggedQuestion): ParsedStem {
  return {
    stemText: richTextishToPlainText(item.stemText),
    questions: [
      {
        number: item.questionIndex,
        text: richTextishToPlainText(item.questionText),
        options: (item.answerOptions ?? []).map((option, index) => ({
          label: String.fromCharCode(97 + index),
          text: richTextishToPlainText(option.answer_text),
        })),
      },
    ],
  }
}

export function UntaggedQuestionsTable({
  onOpenStemDialog,
}: {
  onOpenStemDialog?: (stemId: string) => void
}) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { data, isLoading } = useReconciliationData()
  const sectionsQuery = useUcatSections()
  const tagsQuery = useUcatTags()
  const addTagsMutation = useAddQuestionTags()
  const [searchScopes, setSearchScopes] = useState(['stem_text', 'question_text', 'section_id'])
  const [queueOpen, setQueueOpen] = useState(false)
  const [autoAllPending, setAutoAllPending] = useState(false)

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

  const tableState = useUcatTableUrlState(columnDefinitions.filter((c) => c.visibleByDefault !== false).map((c) => c.key), {
    paramPrefix: 'untagged',
    availableColumns: columnDefinitions.map((c) => c.key),
  })

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
        (q) => searchScopes.some((scope) =>
          applyCoreStringFilter(questionAccessors[scope as keyof typeof questionAccessors](q), search)
        )
      )
    }
    result = result.filter((q) => applySingleSelectFilter(tableState.state, 'section_id', q.sectionId))
    result = applySort(result, tableState.state.sortBy, tableState.state.sortDirection, questionAccessors)
    return result
  }, [data?.untaggedQuestions, tableState.state, questionAccessors, searchScopes])

  const queueEntries = useMemo<UcatApprovalQueueEntry[]>(
    () =>
      filteredQuestions.map((question) => ({
        stemId: question.stemId,
        mode: 'reconciliation' as const,
        issueType: 'missing_tags' as const,
        questionId: question.questionId,
        questionIndex: Math.max(0, question.questionIndex - 1),
      })),
    [filteredQuestions],
  )

  const handleAutoAddTags = useCallback(
    async (item: UntaggedQuestion) => {
      const section = bulkImportSectionFromUcatName(item.sectionName)
      if (!section) {
        toast({
          title: 'Could not infer tags',
          description: 'This question section is not supported by the bulk import tag parser.',
          variant: 'destructive',
        })
        return
      }
      const parsedStem = toParsedStem(item)
      const tagIds = inferBulkImportTagIdsForParsedQuestion({
        stem: parsedStem,
        question: parsedStem.questions[0]!,
        section,
        sectionId: item.sectionId,
        tags: tagsQuery.data ?? [],
      })
      if (tagIds.length === 0) {
        toast({
          title: 'Could not infer tags',
          description: 'The bulk import parser did not find matching tags for this question.',
          variant: 'destructive',
        })
        return
      }
      try {
        await addTagsMutation.mutateAsync({ stemId: item.stemId, questionId: item.questionId, tagIds })
        toast({
          title: 'Tags added',
          description: (
            <>
              {tagIds.length} tag(s) have been added.{' '}
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
          title: 'Failed to add tags',
          description: 'Please try again.',
          variant: 'destructive',
        })
      }
    },
    [addTagsMutation, tagsQuery.data, toast, onOpenStemDialog]
  )

  const handleAutoAddAllTags = useCallback(async () => {
    const questions = data?.untaggedQuestions ?? []
    const updates: Array<{ stemId: string; questionId: string; tagIds: string[] }> = []
    let skippedCount = 0

    for (const question of questions) {
      const section = bulkImportSectionFromUcatName(question.sectionName)
      if (!section) {
        skippedCount += 1
        continue
      }
      const parsedStem = toParsedStem(question)
      const tagIds = inferBulkImportTagIdsForParsedQuestion({
        stem: parsedStem,
        question: parsedStem.questions[0]!,
        section,
        sectionId: question.sectionId,
        tags: tagsQuery.data ?? [],
      })
      if (tagIds.length === 0) {
        skippedCount += 1
        continue
      }
      updates.push({ stemId: question.stemId, questionId: question.questionId, tagIds })
    }

    if (updates.length === 0) {
      toast({
        title: 'Could not infer tags',
        description: 'No matching tags were found for the untagged questions.',
        variant: 'destructive',
      })
      return
    }

    setAutoAllPending(true)
    try {
      const result = await ucatQuestionsApi.addQuestionTagsBulk(updates)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ucatKeys.reconciliation() }),
        queryClient.invalidateQueries({ queryKey: ucatKeys.questions() }),
        queryClient.invalidateQueries({ queryKey: ucatKeys.stemCatalog() }),
      ])
      toast({
        title: result.failedQuestionCount === 0 ? 'Tags added' : 'Some tags could not be saved',
        description: `${result.updatedQuestionCount} tagged, ${skippedCount} had no parser match, and ${result.failedQuestionCount} failed to save.`,
        variant: result.failedQuestionCount === 0 ? 'default' : 'destructive',
      })
    } finally {
      setAutoAllPending(false)
    }
  }, [data?.untaggedQuestions, queryClient, tagsQuery.data, toast])

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
      {...tutorToolbarProps}
      searchPlaceholder="Search questions..."
      searchFromOptions={[
        { label: 'Stem text', value: 'stem_text' },
        { label: 'Question text', value: 'question_text' },
        { label: 'Section', value: 'section_id' },
      ]}
      searchFromValue={searchScopes}
      onSearchFromChange={setSearchScopes}
    />
  )

  return (
    <>
      <ReconciliationTable<UntaggedQuestion>
        title="Untagged questions"
        items={filteredQuestions}
        isLoading={isLoading}
        columnDefinitions={columnDefinitions}
        visibleColumnKeys={tableState.state.visibleColumns}
        toolbar={toolbar}
        headerActions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className={tutorBtnOutline}
              onClick={() => void handleAutoAddAllTags()}
              disabled={
                autoAllPending ||
                tagsQuery.isLoading ||
                (data?.untaggedQuestions.length ?? 0) === 0
              }
            >
              {autoAllPending ? 'Auto-adding…' : 'Auto-add all tags'}
            </Button>
            <Button size="sm" className={tutorBtnPrimary} onClick={() => setQueueOpen(true)} disabled={queueEntries.length === 0}>
              Begin reconciling
            </Button>
          </div>
        }
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
                  className={tutorBtnOutline}
                  onClick={() => onOpenStemDialog?.(item.stemId)}
                >
                  View
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className={tutorBtnOutline}
                  onClick={() => void handleAutoAddTags(item)}
                  disabled={addTagsMutation.isPending || tagsQuery.isLoading}
                >
                  Auto add tags
                </Button>
              </div>
            </TableCell>
          </TableRow>
        )
        }}
      />
      <UcatQuestionStemApprovalQueueDialog
        open={queueOpen}
        title="Reconcile missing tags"
        entries={queueEntries}
        onClose={() => setQueueOpen(false)}
      />
    </>
  )
}
