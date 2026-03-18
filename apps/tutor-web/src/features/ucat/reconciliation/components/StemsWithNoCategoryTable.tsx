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
import { UcatSelectionToolbar } from '@/features/ucat/shared/selection-toolbar'
import { proseMirrorToPlainText } from '@/features/ucat/shared/lib/rich-text'
import type { StemWithNoCategory } from '../api/reconciliation'
import { useReconciliationData, useSetStemCategory } from '../hooks/useReconciliation'
import { ucatQuestionsApi } from '@/features/ucat/questions/api/questions'
import { useQueryClient } from '@tanstack/react-query'
import { ucatKeys } from '@/features/ucat/shared/lib/query-keys'
import { useUcatCategories, useUcatSections } from '@/features/ucat/questions/hooks/useUcatQuestions'
import { useUcatTableState, applyCoreStringFilter, applySingleSelectFilter, applySort } from '@/features/ucat/shared/hooks/useUcatTableState'
import type { DataTableColumnDefinition, DataTableFilterDefinition, DataTableSortOption } from '@altitutor/shared'

const TRUNCATE_LEN = 80

function truncate(text: string, max: number): string {
  if (text.length <= max) return text
  return text.slice(0, max).trim() + '…'
}

export function StemsWithNoCategoryTable({
  onOpenStemDialog,
}: {
  onOpenStemDialog?: (stemId: string) => void
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

  const categories = categoriesQuery.data ?? []

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

  const tableState = useUcatTableState(columnDefinitions.filter((c) => c.visibleByDefault !== false).map((c) => c.key))

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
        const stemText = stemAccessors.stem_text(stem)
        const questionsText = stemAccessors.questions(stem)
        return (
          applyCoreStringFilter(stemText, search) ||
          applyCoreStringFilter(questionsText, search) ||
          applyCoreStringFilter(stem.sectionName, search)
        )
      })
    }
    result = result.filter((stem) => applySingleSelectFilter(tableState.state, 'section_id', stem.sectionId))
    result = applySort(result, tableState.state.sortBy, tableState.state.sortDirection, stemAccessors)
    return result
  }, [data?.stemsWithNoCategory, tableState.state, stemAccessors])

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
      searchPlaceholder="Search stems..."
    />
  )

  return (
    <>
      <ReconciliationTable<StemWithNoCategory>
        title="Question stems with no category"
        items={filteredStems}
        isLoading={isLoading}
        columnDefinitions={columnDefinitions}
        visibleColumnKeys={tableState.state.visibleColumns}
        toolbar={toolbar}
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
            onSetCategory={(categoryId) => handleSetCategory(item, categoryId)}
            isSettingCategory={setCategoryMutation.isPending}
          />
        )}
      />

      <UcatSelectionToolbar
        selectedCount={selectedStemIds.size}
        onCancel={() => setSelectedStemIds(new Set())}
        hideDelete
      >
        <SearchableSelect<{ id: string | null; name: string | null; ucat_section_id: string | null }>
          items={categories}
          value={null}
          onValueChange={(c) => {
            if (c?.id) {
              setBulkCategoryId(c.id)
              setBulkCategoryOpen(true)
            }
          }}
          getItemId={(c) => c.id ?? ''}
          getItemLabel={(c) => c.name ?? 'Untitled'}
          getItemValue={(c) => c.name ?? ''}
          placeholder="Add category"
          searchPlaceholder="Search categories..."
          emptyMessage="No categories found"
          trigger={
            <Button variant="default" size="sm">
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
              Category will be set to &quot;{categories.find((c) => c.id === bulkCategoryId)?.name ?? ''}&quot; for all selected stems.
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
    </>
  )
}

function StemWithNoCategoryRow({
  item,
  categories,
  sectionId,
  visibleColumnKeys,
  selection,
  onSetCategory,
  isSettingCategory,
}: {
  item: StemWithNoCategory
  categories: Array<{ id: string | null; name: string | null; ucat_section_id: string | null }>
  sectionId: string
  visibleColumnKeys: string[]
  selection?: {
    getItemId: (item: StemWithNoCategory) => string
    selectedIds: Set<string>
    onToggleSelection: (id: string) => void
  }
  onSetCategory: (categoryId: string) => Promise<void>
  isSettingCategory: boolean
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
      className={isSelected ? 'bg-muted/50' : undefined}
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
        <AddCategorySelect
          categories={sectionCategories}
          onSelect={onSetCategory}
          disabled={isSettingCategory}
        />
      </TableCell>
    </TableRow>
  )
}

function AddCategorySelect({
  categories,
  onSelect,
  disabled,
}: {
  categories: Array<{ id: string | null; name: string | null }>
  onSelect: (categoryId: string) => Promise<void>
  disabled: boolean
}) {
  const items = useMemo(
    () => categories.filter((c): c is { id: string; name: string } => !!c.id && !!c.name),
    [categories]
  )

  if (items.length === 0) {
    return (
      <Button variant="default" size="sm" disabled>
        No categories for section
      </Button>
    )
  }

  return (
    <SearchableSelect<{ id: string; name: string }>
      items={items}
      value={null}
      onValueChange={async (cat) => {
        if (cat) await onSelect(cat.id)
      }}
      getItemLabel={(c) => c.name}
      getItemId={(c) => c.id}
      placeholder="Add category"
      disabled={disabled}
      trigger={
        <Button variant="default" size="sm" disabled={disabled}>
          Add category
        </Button>
      }
    />
  )
}
