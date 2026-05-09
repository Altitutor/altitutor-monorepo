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
import type { Json } from '@altitutor/shared'
import type { PrivateStemNotInSet } from '../api/reconciliation'
import { useReconciliationData } from '../hooks/useReconciliation'
import { ucatSetsApi } from '@/features/ucat/sets/api/sets'
import { useUcatSets } from '@/features/ucat/sets/hooks/useUcatSets'
import { useUcatSections } from '@/features/ucat/questions/hooks/useUcatQuestions'
import { useQueryClient } from '@tanstack/react-query'
import { ucatKeys } from '@/features/ucat/shared/lib/query-keys'
import { useUcatTableState, applyCoreStringFilter, applySingleSelectFilter, applySort } from '@/features/ucat/shared/hooks/useUcatTableState'
import type { DataTableColumnDefinition, DataTableFilterDefinition, DataTableSortOption } from '@altitutor/shared'
import { cn } from '@/shared/utils'
import { tutorTableBodyRow } from '@/shared/lib/tutor-visual'

const TRUNCATE_LEN = 80

function truncate(text: string, max: number): string {
  if (text.length <= max) return text
  return text.slice(0, max).trim() + '…'
}

export function PrivateStemsNotInSetTable({
  onOpenStemDialog,
}: {
  onOpenStemDialog?: (stemId: string) => void
}) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { data, isLoading } = useReconciliationData()
  const setsQuery = useUcatSets()
  const sectionsQuery = useUcatSections()
  const staffSets = useMemo(
    () =>
      (setsQuery.data ?? []).filter(
        (s) =>
          !(s as { is_student_generated?: boolean; deleted_at?: string | null }).is_student_generated &&
          (s as { deleted_at?: string | null }).deleted_at == null
      ),
    [setsQuery.data]
  )

  const [selectedStemIds, setSelectedStemIds] = useState<Set<string>>(new Set())
  const [bulkSetOpen, setBulkSetOpen] = useState(false)
  const [bulkSetId, setBulkSetId] = useState<string | null>(null)
  const [bulkSetPending, setBulkSetPending] = useState(false)

  const columnDefinitions: DataTableColumnDefinition[] = [
    { key: 'category_name', label: 'Category', visibleByDefault: true },
    { key: 'stem_text', label: 'Question stem', visibleByDefault: true },
    { key: 'questions', label: 'Questions', visibleByDefault: true },
  ]

  const sortOptions: DataTableSortOption[] = [
    { key: 'category_name', label: 'Category' },
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
      category_name: (s: PrivateStemNotInSet) => s.categoryName ?? '',
      stem_text: (s: PrivateStemNotInSet) =>
        proseMirrorToPlainText(s.stemText as import('@altitutor/shared').Json) ?? '',
      questions: (s: PrivateStemNotInSet) =>
        (s.questions ?? [])
          .sort((a, b) => a.index - b.index)
          .map((q, i) => `${i + 1}. ${truncate(proseMirrorToPlainText(q.question_text as import('@altitutor/shared').Json) ?? '', 60)}`)
          .join(' '),
    }),
    []
  )

  const filteredStems = useMemo(() => {
    const stems = data?.privateStemsNotInSet ?? []
    let result = stems
    const { search } = tableState.state
    if (search.trim()) {
      result = result.filter((stem) => {
        const stemText = stemAccessors.stem_text(stem)
        const questionsText = stemAccessors.questions(stem)
        return (
          applyCoreStringFilter(stemText, search) ||
          applyCoreStringFilter(questionsText, search) ||
          applyCoreStringFilter(stem.categoryName ?? '', search) ||
          applyCoreStringFilter(stem.sectionName, search)
        )
      })
    }
    result = result.filter((stem) => applySingleSelectFilter(tableState.state, 'section_id', stem.sectionId))
    result = applySort(result, tableState.state.sortBy, tableState.state.sortDirection, stemAccessors)
    return result
  }, [data?.privateStemsNotInSet, tableState.state, stemAccessors])

  const handleAddToSet = useCallback(
    async (item: PrivateStemNotInSet, setId: string) => {
      try {
        await ucatSetsApi.addStemsToSet(setId, [item.id])
        queryClient.invalidateQueries({ queryKey: ucatKeys.reconciliation() })
        queryClient.invalidateQueries({ queryKey: ucatKeys.sets() })
        toast({
          title: 'Added to set',
          description: (
            <>
              The question stem has been added to the set.{' '}
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
          title: 'Failed to add to set',
          description: 'Please try again.',
          variant: 'destructive',
        })
      }
    },
    [toast, onOpenStemDialog, queryClient]
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

  const handleBulkAddToSetConfirm = useCallback(async () => {
    if (!bulkSetId || selectedStemIds.size === 0) return
    const count = selectedStemIds.size
    setBulkSetPending(true)
    try {
      await ucatSetsApi.addStemsToSet(bulkSetId, Array.from(selectedStemIds))
      setSelectedStemIds(new Set())
      setBulkSetOpen(false)
      setBulkSetId(null)
      queryClient.invalidateQueries({ queryKey: ucatKeys.reconciliation() })
      queryClient.invalidateQueries({ queryKey: ucatKeys.sets() })
      toast({
        title: 'Added to set',
        description: `${count} question stem(s) have been added to the set.`,
      })
    } catch {
      toast({
        title: 'Failed to add to set',
        description: 'Please try again.',
        variant: 'destructive',
      })
    } finally {
      setBulkSetPending(false)
    }
  }, [bulkSetId, selectedStemIds, toast, queryClient])

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
      <ReconciliationTable<PrivateStemNotInSet>
        title="Private question stems not in a set"
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
          <PrivateStemNotInSetRow
            key={item.id}
            item={item}
            sets={staffSets}
            visibleColumnKeys={visibleColumnKeys}
            selection={sel}
            onAddToSet={(setId) => handleAddToSet(item, setId)}
          />
        )}
      />

      <UcatSelectionToolbar
        selectedCount={selectedStemIds.size}
        onCancel={() => setSelectedStemIds(new Set())}
        hideDelete
      >
        <SearchableSelect<{ id: string | null; name: unknown }>
          items={staffSets}
          value={null}
          onValueChange={(set) => {
            if (set?.id) {
              setBulkSetId(set.id)
              setBulkSetOpen(true)
            }
          }}
          getItemId={(s) => s.id ?? ''}
          getItemLabel={(s) => proseMirrorToPlainText(s.name as Json) ?? 'Untitled'}
          getItemValue={(s) => proseMirrorToPlainText(s.name as Json) ?? ''}
          placeholder="Add to set"
          searchPlaceholder="Search sets..."
          emptyMessage="No sets found"
          trigger={
            <Button variant="default" size="sm">
              Add to set
            </Button>
          }
          contentWidth="240px"
          align="start"
          side="top"
        />
      </UcatSelectionToolbar>

      <AlertDialog open={bulkSetOpen} onOpenChange={setBulkSetOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Add {selectedStemIds.size} stem(s) to set?</AlertDialogTitle>
            <AlertDialogDescription>
              Selected stems will be added to &quot;
              {proseMirrorToPlainText(staffSets.find((s) => s.id === bulkSetId)?.name as Json) ?? ''}&quot;.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkSetPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleBulkAddToSetConfirm()} disabled={bulkSetPending}>
              {bulkSetPending ? 'Adding...' : 'Yes'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function PrivateStemNotInSetRow({
  item,
  sets,
  visibleColumnKeys,
  selection,
  onAddToSet,
}: {
  item: PrivateStemNotInSet
  sets: Array<{ id: string | null; name: unknown }>
  visibleColumnKeys: string[]
  selection?: {
    getItemId: (item: PrivateStemNotInSet) => string
    selectedIds: Set<string>
    onToggleSelection: (id: string) => void
  }
  onAddToSet: (setId: string) => Promise<void>
}) {
  const stemText = proseMirrorToPlainText(item.stemText as import('@altitutor/shared').Json) ?? ''
  const stemTruncated = truncate(stemText, TRUNCATE_LEN)
  const questionsDisplay = useMemo(() => {
    const sorted = [...(item.questions ?? [])].sort((a, b) => a.index - b.index)
    return sorted
      .map((q, i) => `${i + 1}. ${truncate(proseMirrorToPlainText(q.question_text as import('@altitutor/shared').Json) ?? '', 60)}`)
      .join(' ')
  }, [item.questions])

  const cells: Record<string, React.ReactNode> = {
    category_name: <TableCell className="whitespace-nowrap">{item.categoryName || '—'}</TableCell>,
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
        <AddToSetSelect sets={sets} onSelect={onAddToSet} />
      </TableCell>
    </TableRow>
  )
}

function AddToSetSelect({
  sets,
  onSelect,
}: {
  sets: Array<{ id: string | null; name: unknown }>
  onSelect: (setId: string) => Promise<void>
}) {
  const items = useMemo(
    () => sets.filter((s): s is { id: string; name: unknown } => !!s.id),
    [sets]
  )

  if (items.length === 0) {
    return (
      <Button variant="default" size="sm" disabled>
        No sets available
      </Button>
    )
  }

  return (
    <SearchableSelect<{ id: string; name: unknown }>
      items={items}
      value={null}
      onValueChange={async (set) => {
        if (set) await onSelect(set.id)
      }}
      getItemLabel={(s) => proseMirrorToPlainText(s.name as Json) ?? 'Untitled'}
      getItemId={(s) => s.id}
      placeholder="Add to set"
      trigger={
        <Button variant="default" size="sm">
          Add to set
        </Button>
      }
    />
  )
}
