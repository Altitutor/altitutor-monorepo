'use client'

import React, { useMemo, useCallback, useState } from 'react'
import {
  TableRow,
  TableCell,
  SearchableSelect,
  Button,
  DataTableToolbar,
  useToast,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Checkbox,
} from '@altitutor/ui'
import { ReconciliationTable } from './ReconciliationTable'
import { getQuestionIssueDefinition } from '../lib/question-issue-definitions'
import { UcatSelectionToolbar } from '@/features/ucat/shared/selection-toolbar'
import { proseMirrorToPlainText } from '@/features/ucat/shared/lib/rich-text'
import type { StemWithNoCategory } from '../api/reconciliation'
import { useReconciliationData, useSetStemCategory } from '../hooks/useReconciliation'
import { ucatQuestionsApi } from '@/features/ucat/questions/api/questions'
import { useQueryClient } from '@tanstack/react-query'
import { ucatKeys } from '@/features/ucat/shared/lib/query-keys'
import { useUcatCategories, useUcatSections } from '@/features/ucat/questions/hooks/useUcatQuestions'
import { mapCategoriesToOptions, taxonomyDisplayLabel } from '@/features/ucat/shared/lib/taxonomy-paths'
import type { CategoryOption } from '@/features/ucat/questions/components/UcatQuestionStemDialog'
import { cn } from '@/shared/utils'
import { tutorBtnOutline, tutorBtnPrimary, tutorTableBodyRow, tutorToolbarProps } from '@/shared/lib/tutor-visual'
import { applyCoreStringFilter, applySingleSelectFilter, applySort } from '@/features/ucat/shared/hooks/useUcatTableState'
import { useUcatTableUrlState } from '@/features/ucat/shared/hooks/useUcatTableUrlState'
import type { DataTableColumnDefinition, DataTableFilterDefinition, DataTableSortOption, Json } from '@altitutor/shared'
import {
  UcatQuestionStemApprovalQueueDialog,
  type UcatApprovalQueueEntry,
} from '@/features/ucat/questions/components/approval-queue/UcatQuestionStemApprovalQueue'
import { bulkImportSectionFromUcatName } from '@/features/ucat/questions/components/bulk-import/bulkImportLogicalLines'
import { inferBulkImportCategoryIdForParsedStem } from '@/features/ucat/questions/components/bulk-import/bulkImportMetadataInference'
import type { ParsedStem } from '@/features/ucat/questions/lib/parsers/core'

const ISSUE = getQuestionIssueDefinition('missing-category')
const TRUNCATE_LEN = 80

function truncate(text: string, max: number): string {
  if (text.length <= max) return text
  return text.slice(0, max).trim() + '…'
}

function richTextishToPlainText(value: unknown): string {
  if (typeof value === 'string') return value
  return proseMirrorToPlainText(value as Json) ?? ''
}

function toParsedStem(item: StemWithNoCategory): ParsedStem {
  return {
    stemText: richTextishToPlainText(item.stemText),
    questions: [...(item.questions ?? [])]
      .sort((a, b) => a.index - b.index)
      .map((question) => ({
        number: question.index,
        text: richTextishToPlainText(question.question_text),
        options: (question.answer_options ?? []).map((option, index) => ({
          label: String.fromCharCode(97 + index),
          text: richTextishToPlainText(option.answer_text),
        })),
      })),
  }
}

export function StemsWithNoCategoryTable({
  onOpenStemDialog,
  showCountBadge = true,
}: {
  onOpenStemDialog?: (stemId: string) => void
  showCountBadge?: boolean
}) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { data, isLoading } = useReconciliationData()
  const categoriesQuery = useUcatCategories()
  const sectionsQuery = useUcatSections()
  const setCategoryMutation = useSetStemCategory()

  const [selectedStemIds, setSelectedStemIds] = useState<Set<string>>(new Set())
  const [bulkCategoryOpen, setBulkCategoryOpen] = useState(false)
  const [bulkCategoryId, setBulkCategoryId] = useState<string | null>(null)
  const [bulkCategoryPending, setBulkCategoryPending] = useState(false)
  const [autoAllPending, setAutoAllPending] = useState(false)
  const [searchScopes, setSearchScopes] = useState(['stem_text', 'questions', 'section_id'])
  const [queueOpen, setQueueOpen] = useState(false)

  const categories = useMemo(
    () => mapCategoriesToOptions(categoriesQuery.data ?? []) as CategoryOption[],
    [categoriesQuery.data]
  )

  const columnDefinitions: DataTableColumnDefinition[] = [
    { key: 'section_id', label: 'Section', visibleByDefault: true },
    { key: 'stem_text', label: 'Question stem', visibleByDefault: true },
    { key: 'questions', label: 'Questions', visibleByDefault: true },
  ]

  const sortOptions: DataTableSortOption[] = [
    { key: 'section_id', label: 'Section' },
    { key: 'stem_text', label: 'Question stem' },
    { key: 'questions', label: 'Questions' },
  ]

  const tableState = useUcatTableUrlState(columnDefinitions.filter((c) => c.visibleByDefault !== false).map((c) => c.key), {
    paramPrefix: 'noCategory',
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

  const stemAccessors = useMemo(
    () => ({
      section_id: (s: StemWithNoCategory) => s.sectionName ?? '',
      stem_text: (s: StemWithNoCategory) =>
        proseMirrorToPlainText(s.stemText as import('@altitutor/shared').Json) ?? '',
      questions: (s: StemWithNoCategory) =>
        (s.questions ?? [])
          .sort((a, b) => a.index - b.index)
          .map((q, i) => `${i + 1}. ${truncate(proseMirrorToPlainText(q.question_text as import('@altitutor/shared').Json) ?? '', 60)}`)
          .join(' '),
    }),
    []
  )

  const filteredStems = useMemo(() => {
    const stems = data?.stemsWithNoCategory ?? []
    let result = stems
    const { search } = tableState.state
    if (search.trim()) {
      result = result.filter((stem) => {
        const values: Record<string, string> = {
          stem_text: stemAccessors.stem_text(stem),
          questions: stemAccessors.questions(stem),
          section_id: stem.sectionName ?? '',
        }
        return searchScopes.some((scope) => applyCoreStringFilter(values[scope] ?? '', search))
      })
    }
    result = result.filter((stem) => applySingleSelectFilter(tableState.state, 'section_id', stem.sectionId))
    result = applySort(result, tableState.state.sortBy, tableState.state.sortDirection, stemAccessors)
    return result
  }, [data?.stemsWithNoCategory, tableState.state, stemAccessors, searchScopes])

  const queueEntries = useMemo<UcatApprovalQueueEntry[]>(
    () =>
      filteredStems.map((stem) => ({
        stemId: stem.id,
        mode: 'reconciliation' as const,
        issueType: 'missing_category' as const,
      })),
    [filteredStems],
  )

  const handleSetCategory = useCallback(
    async (item: StemWithNoCategory, categoryId: string) => {
      try {
        await setCategoryMutation.mutateAsync({ stemId: item.id, categoryId })
        toast({
          title: 'Category added',
          description: (
            <>
              The question stem has been categorized.{' '}
              <button
                type="button"
                onClick={() => onOpenStemDialog?.(item.id)}
                className="text-primary underline font-medium hover:underline"
              >
                View question stem
              </button>
            </>
          ),
        })
      } catch {
        toast({
          title: 'Failed to add category',
          description: 'Please try again.',
          variant: 'destructive',
        })
      }
    },
    [setCategoryMutation, toast, onOpenStemDialog]
  )

  const handleAutoSetCategory = useCallback(
    async (item: StemWithNoCategory) => {
      const section = bulkImportSectionFromUcatName(item.sectionName)
      if (!section) {
        toast({
          title: 'Could not infer category',
          description: 'This stem section is not supported by the bulk import category parser.',
          variant: 'destructive',
        })
        return
      }
      const categoryId = inferBulkImportCategoryIdForParsedStem({
        stem: toParsedStem(item),
        section,
        sectionId: item.sectionId,
        categories: categoriesQuery.data ?? [],
      })
      if (!categoryId) {
        toast({
          title: 'Could not infer category',
          description: 'The bulk import parser did not find a matching category for this stem.',
          variant: 'destructive',
        })
        return
      }
      await handleSetCategory(item, categoryId)
    },
    [categoriesQuery.data, handleSetCategory, toast]
  )

  const handleAutoSetAllCategories = useCallback(async () => {
    const stems = data?.stemsWithNoCategory ?? []
    const stemIdsByCategory = new Map<string, string[]>()
    let skippedCount = 0

    for (const stem of stems) {
      const section = bulkImportSectionFromUcatName(stem.sectionName)
      const categoryId = section
        ? inferBulkImportCategoryIdForParsedStem({
            stem: toParsedStem(stem),
            section,
            sectionId: stem.sectionId,
            categories: categoriesQuery.data ?? [],
          })
        : null
      if (!categoryId) {
        skippedCount += 1
        continue
      }
      const stemIds = stemIdsByCategory.get(categoryId)
      if (stemIds) stemIds.push(stem.id)
      else stemIdsByCategory.set(categoryId, [stem.id])
    }

    const inferredCount = stems.length - skippedCount
    if (inferredCount === 0) {
      toast({
        title: 'Could not infer categories',
        description: 'No matching categories were found for the uncategorized stems.',
        variant: 'destructive',
      })
      return
    }

    setAutoAllPending(true)
    try {
      const categoryGroups = Array.from(stemIdsByCategory)
      const results = await Promise.all(
        categoryGroups.map(async ([categoryId, stemIds]) => {
          try {
            await ucatQuestionsApi.bulkUpdateMetadata(stemIds, { categoryId })
            return { updatedCount: stemIds.length, failedCount: 0 }
          } catch {
            let updatedCount = 0
            let failedCount = 0
            const concurrency = 5
            for (let index = 0; index < stemIds.length; index += concurrency) {
              const batch = stemIds.slice(index, index + concurrency)
              const fallbackResults = await Promise.allSettled(
                batch.map((stemId) =>
                  ucatQuestionsApi.bulkUpdateMetadata([stemId], { categoryId }),
                ),
              )
              fallbackResults.forEach((result) => {
                if (result.status === 'fulfilled') updatedCount += 1
                else failedCount += 1
              })
            }
            return { updatedCount, failedCount }
          }
        }),
      )
      const updatedCount = results.reduce((count, result) => count + result.updatedCount, 0)
      const failedCount = results.reduce((count, result) => count + result.failedCount, 0)

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ucatKeys.reconciliation() }),
        queryClient.invalidateQueries({ queryKey: ucatKeys.questions('all') }),
        queryClient.invalidateQueries({ queryKey: ucatKeys.stemCatalog() }),
      ])
      toast({
        title: failedCount === 0 ? 'Categories added' : 'Some categories could not be saved',
        description: `${updatedCount} categorized, ${skippedCount} had no parser match, and ${failedCount} failed to save.`,
        variant: failedCount === 0 ? 'default' : 'destructive',
      })
    } finally {
      setAutoAllPending(false)
    }
  }, [categoriesQuery.data, data?.stemsWithNoCategory, queryClient, toast])

  const toggleStemSelection = useCallback((id: string) => {
    setSelectedStemIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const toggleSelectAllVisible = useCallback(() => {
    const pagedStems = filteredStems.slice(
      (tableState.state.page - 1) * tableState.state.pageSize,
      tableState.state.page * tableState.state.pageSize
    )
    if (pagedStems.every((s) => selectedStemIds.has(s.id))) {
      setSelectedStemIds((prev) => {
        const next = new Set(prev)
        pagedStems.forEach((s) => next.delete(s.id))
        return next
      })
    } else {
      setSelectedStemIds((prev) => new Set([...prev, ...pagedStems.map((s) => s.id)]))
    }
  }, [filteredStems, tableState.state.page, tableState.state.pageSize, selectedStemIds])

  const allVisibleSelected =
    filteredStems.length > 0 &&
    filteredStems
      .slice(
        (tableState.state.page - 1) * tableState.state.pageSize,
        tableState.state.page * tableState.state.pageSize
      )
      .every((s) => selectedStemIds.has(s.id))
  const someVisibleSelected = filteredStems
    .slice(
      (tableState.state.page - 1) * tableState.state.pageSize,
      tableState.state.page * tableState.state.pageSize
    )
    .some((s) => selectedStemIds.has(s.id))

  const handleBulkCategoryConfirm = useCallback(async () => {
    if (!bulkCategoryId || selectedStemIds.size === 0) return
    const count = selectedStemIds.size
    setBulkCategoryPending(true)
    try {
      await ucatQuestionsApi.bulkUpdateMetadata(Array.from(selectedStemIds), { categoryId: bulkCategoryId })
      setSelectedStemIds(new Set())
      setBulkCategoryOpen(false)
      setBulkCategoryId(null)
      queryClient.invalidateQueries({ queryKey: ucatKeys.reconciliation() })
      toast({
        title: 'Categories added',
        description: `${count} question stem(s) have been categorized.`,
      })
    } catch {
      toast({
        title: 'Failed to add categories',
        description: 'Please try again.',
        variant: 'destructive',
      })
    } finally {
      setBulkCategoryPending(false)
    }
  }, [bulkCategoryId, selectedStemIds, toast, queryClient])

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
      searchPlaceholder="Search stems..."
      searchFromOptions={[
        { label: 'Stem text', value: 'stem_text' },
        { label: 'Question text', value: 'questions' },
        { label: 'Section', value: 'section_id' },
      ]}
      searchFromValue={searchScopes}
      onSearchFromChange={setSearchScopes}
    />
  )

  return (
    <>
      <ReconciliationTable<StemWithNoCategory>
        title={ISSUE.title}
        description={ISSUE.description}
        showCountBadge={showCountBadge}
        items={filteredStems}
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
              onClick={() => void handleAutoSetAllCategories()}
              disabled={
                autoAllPending ||
                categoriesQuery.isLoading ||
                (data?.stemsWithNoCategory.length ?? 0) === 0
              }
            >
              {autoAllPending ? 'Auto-setting…' : 'Auto-set all categories'}
            </Button>
            <Button size="sm" className={tutorBtnPrimary} onClick={() => setQueueOpen(true)} disabled={queueEntries.length === 0}>
              Begin reconciling
            </Button>
          </div>
        }
        selection={{
          getItemId: (s) => s.id,
          selectedIds: selectedStemIds,
          onToggleSelection: toggleStemSelection,
          onToggleSelectAll: toggleSelectAllVisible,
          allVisibleSelected,
          someVisibleSelected,
        }}
        renderRow={(item, _index, visibleColumnKeys, sel) => (
          <StemWithNoCategoryRow
            key={item.id}
            item={item}
            categories={categories}
            sectionId={item.sectionId}
            visibleColumnKeys={visibleColumnKeys}
            selection={sel}
            onAutoSetCategory={() => handleAutoSetCategory(item)}
            isSettingCategory={setCategoryMutation.isPending}
            onOpenStemDialog={onOpenStemDialog}
          />
        )}
      />

      <UcatSelectionToolbar
        selectedCount={selectedStemIds.size}
        onCancel={() => setSelectedStemIds(new Set())}
        hideDelete
      >
        <SearchableSelect<CategoryOption>
          items={categories}
          value={null}
          onValueChange={(c) => {
            if (c?.id) {
              setBulkCategoryId(c.id)
              setBulkCategoryOpen(true)
            }
          }}
          getItemId={(c) => c.id ?? ''}
          getItemLabel={(c) => taxonomyDisplayLabel(c)}
          getItemValue={(c) => taxonomyDisplayLabel(c)}
          placeholder="Add category"
          searchPlaceholder="Search categories..."
          emptyMessage="No categories found"
          trigger={
            <Button variant="outline" size="sm" className={tutorBtnOutline}>
              Add category
            </Button>
          }
          contentWidth="240px"
          align="start"
          side="top"
        />
      </UcatSelectionToolbar>

      <AlertDialog open={bulkCategoryOpen} onOpenChange={setBulkCategoryOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Set category for {selectedStemIds.size} stem(s)?</AlertDialogTitle>
            <AlertDialogDescription>
              Category will be set to &quot;{taxonomyDisplayLabel(categories.find((c) => c.id === bulkCategoryId) ?? { name: '' })}&quot; for all selected stems.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkCategoryPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleBulkCategoryConfirm()} disabled={bulkCategoryPending}>
              {bulkCategoryPending ? 'Updating...' : 'Yes'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <UcatQuestionStemApprovalQueueDialog
        open={queueOpen}
        title="Reconcile missing categories"
        entries={queueEntries}
        onClose={() => setQueueOpen(false)}
      />
    </>
  )
}

function StemWithNoCategoryRow({
  item,
  categories,
  sectionId,
  visibleColumnKeys,
  selection,
  onAutoSetCategory,
  isSettingCategory,
  onOpenStemDialog,
}: {
  item: StemWithNoCategory
  categories: CategoryOption[]
  sectionId: string
  visibleColumnKeys: string[]
  selection?: {
    getItemId: (item: StemWithNoCategory) => string
    selectedIds: Set<string>
    onToggleSelection: (id: string) => void
  }
  onAutoSetCategory: () => Promise<void>
  isSettingCategory: boolean
  onOpenStemDialog?: (stemId: string) => void
}) {
  const stemText = proseMirrorToPlainText(item.stemText as import('@altitutor/shared').Json) ?? ''
  const stemTruncated = truncate(stemText, TRUNCATE_LEN)
  const questionsDisplay = useMemo(() => {
    const sorted = [...(item.questions ?? [])].sort((a, b) => a.index - b.index)
    return sorted
      .map((q, i) => `${i + 1}. ${truncate(proseMirrorToPlainText(q.question_text as import('@altitutor/shared').Json) ?? '', 60)}`)
      .join(' ')
  }, [item.questions])

  const sectionCategories = useMemo(
    () => categories.filter((c) => (c.ucat_section_id ?? null) === sectionId),
    [categories, sectionId]
  )

  const cells: Record<string, React.ReactNode> = {
    section_id: <TableCell className="whitespace-nowrap">{item.sectionName || '—'}</TableCell>,
    stem_text: (
      <TableCell className="max-w-[300px]" title={stemText}>
        {stemTruncated || '—'}
      </TableCell>
    ),
    questions: (
      <TableCell className="max-w-[400px] text-muted-foreground" title={questionsDisplay}>
        <span className="block truncate">{questionsDisplay || '—'}</span>
      </TableCell>
    ),
  }

  const selectionMode = selection && selection.selectedIds.size > 0
  const isSelected = selection?.selectedIds.has(item.id) ?? false

  return (
    <TableRow
      key={item.id}
      className={cn(tutorTableBodyRow, isSelected && 'bg-muted/50')}
      onClick={selectionMode ? () => selection.onToggleSelection(item.id) : undefined}
    >
      {selection && (
        <TableCell className="w-12" onClick={(e) => e.stopPropagation()}>
          <Checkbox
            checked={isSelected}
            onCheckedChange={() => selection.onToggleSelection(item.id)}
            aria-label={`Select ${item.id}`}
          />
        </TableCell>
      )}
      {visibleColumnKeys.map((key) => cells[key]).filter((c): c is React.ReactNode => c != null)}
      <TableCell onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className={tutorBtnOutline}
            onClick={() => onOpenStemDialog?.(item.id)}
          >
            View
          </Button>
          <Button
            variant="outline"
            size="sm"
            className={tutorBtnOutline}
            onClick={() => void onAutoSetCategory()}
            disabled={isSettingCategory || sectionCategories.length === 0}
          >
            Auto-set category
          </Button>
        </div>
      </TableCell>
    </TableRow>
  )
}
