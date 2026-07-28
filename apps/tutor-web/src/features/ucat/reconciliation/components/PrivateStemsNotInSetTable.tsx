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
import { usePrivateStemsNotInSetQueue } from '../hooks/useReconciliation'
import { ucatQuestionsApi } from '@/features/ucat/questions/api/questions'
import { ucatSetsApi } from '@/features/ucat/sets/api/sets'
import { useUcatSets } from '@/features/ucat/sets/hooks/useUcatSets'
import { useUcatCategories, useUcatSections } from '@/features/ucat/questions/hooks/useUcatQuestions'
import {
  buildTaxonomyPathLookup,
  categoriesToTaxonomyNodes,
  resolveCategoryPathLabel,
} from '@/features/ucat/shared/lib/taxonomy-paths'
import { useQueryClient } from '@tanstack/react-query'
import { ucatKeys } from '@/features/ucat/shared/lib/query-keys'
import { useUcatTableUrlState } from '@/features/ucat/shared/hooks/useUcatTableUrlState'
import type { DataTableColumnDefinition, DataTableFilterDefinition } from '@altitutor/shared'
import { cn } from '@/shared/utils'
import { tutorBtnOutline, tutorBtnPrimary, tutorTableBodyRow, tutorToolbarProps } from '@/shared/lib/tutor-visual'
import { getSetAddStemWarning } from '@/features/ucat/shared/lib/set-section-status'
import {
  UcatQuestionStemApprovalQueueDialog,
  type UcatApprovalQueueEntry,
} from '@/features/ucat/questions/components/approval-queue/UcatQuestionStemApprovalQueue'

const TRUNCATE_LEN = 80

function truncate(text: string, max: number): string {
  if (text.length <= max) return text
  return text.slice(0, max).trim() + '…'
}

export function PrivateStemsNotInSetTable({
  onOpenStemDialog,
  onEditSet,
}: {
  onOpenStemDialog?: (stemId: string) => void
  onEditSet?: (setId: string) => void
}) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const setsQuery = useUcatSets()
  const sectionsQuery = useUcatSections()
  const categoriesQuery = useUcatCategories()
  const categoryPathLookup = useMemo(
    () => buildTaxonomyPathLookup(categoriesToTaxonomyNodes(categoriesQuery.data ?? [])),
    [categoriesQuery.data]
  )
  const staffSets = useMemo(
    () =>
      (setsQuery.data ?? []).filter(
        (s) => (s as { deleted_at?: string | null }).deleted_at == null
      ),
    [setsQuery.data]
  )

  const [selectedStemIds, setSelectedStemIds] = useState<Set<string>>(new Set())
  const [bulkSetOpen, setBulkSetOpen] = useState(false)
  const [bulkSetId, setBulkSetId] = useState<string | null>(null)
  const [bulkSetPending, setBulkSetPending] = useState(false)
  const [queueOpen, setQueueOpen] = useState(false)
  const [makingPublicStemId, setMakingPublicStemId] = useState<string | null>(null)
  const [setWarning, setSetWarning] = useState<{
    setId: string
    setName: string
    title: string
    description: string
    action: () => Promise<void>
  } | null>(null)

  const columnDefinitions: DataTableColumnDefinition[] = [
    { key: 'category_name', label: 'Category', visibleByDefault: true },
    { key: 'stem_text', label: 'Question stem', visibleByDefault: true },
    { key: 'questions', label: 'Questions', visibleByDefault: true },
  ]

  const tableState = useUcatTableUrlState(columnDefinitions.filter((c) => c.visibleByDefault !== false).map((c) => c.key), {
    paramPrefix: 'privateNotInSet',
    availableColumns: columnDefinitions.map((c) => c.key),
  })
  const sectionIds = (tableState.state.filters.section_id ?? [])
    .map(String)
    .filter((value) => value && value !== 'all')
  const queueQuery = usePrivateStemsNotInSetQueue({
    search: tableState.state.search,
    sectionIds,
    page: tableState.state.page,
    pageSize: tableState.state.pageSize,
  })
  const { data, isLoading } = queueQuery

  const sectionFilterDef: DataTableFilterDefinition = useMemo(
    () => ({
      key: 'section_id',
      label: 'Section',
      options: (sectionsQuery.data ?? []).map((s) => ({ label: s.name ?? 'Untitled', value: s.id ?? '' })),
    }),
    [sectionsQuery.data]
  )

  const filteredStems = useMemo(() => data?.items ?? [], [data?.items])

  const queueEntries = useMemo<UcatApprovalQueueEntry[]>(
    () =>
      filteredStems.map((stem) => ({
        stemId: stem.id,
        mode: 'reconciliation' as const,
        issueType: 'missing_set' as const,
      })),
    [filteredStems],
  )

  const addStemToSet = useCallback(
    async (item: PrivateStemNotInSet, setId: string) => {
      try {
        await ucatSetsApi.addStemsToSet(setId, [item.id])
        queryClient.invalidateQueries({
          queryKey: ucatKeys.reconciliationQueue('private-stems-not-in-set'),
        })
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

  const handleAddToSet = useCallback(
    async (item: PrivateStemNotInSet, setId: string) => {
      const selectedSet = staffSets.find((set) => set.id === setId)
      const warning = getSetAddStemWarning(selectedSet, item.sectionId, sectionsQuery.data ?? [])
      if (warning) {
        setSetWarning({
          setId,
          ...warning,
          action: async () => {
            await addStemToSet(item, setId)
          },
        })
        return
      }
      await addStemToSet(item, setId)
    },
    [addStemToSet, staffSets, sectionsQuery.data]
  )

  const handleMakePublic = useCallback(async (item: PrivateStemNotInSet) => {
    await queryClient.cancelQueries({
      queryKey: ucatKeys.reconciliationQueue('private-stems-not-in-set'),
    })
    queryClient.setQueriesData<{ items: PrivateStemNotInSet[]; total: number }>(
      { queryKey: ucatKeys.reconciliationQueue('private-stems-not-in-set') },
      (previous) => previous
        ? {
            ...previous,
            items: previous.items.filter((stem) => stem.id !== item.id),
            total: Math.max(0, previous.total - 1),
          }
        : previous,
    )
    setMakingPublicStemId(item.id)
    try {
      await ucatQuestionsApi.bulkUpdateMetadata([item.id], { accessScope: 'public' })
      void queryClient.invalidateQueries({
        queryKey: ucatKeys.reconciliationQueue('private-stems-not-in-set'),
      })
      void queryClient.invalidateQueries({ queryKey: ucatKeys.questions('all') })
      toast({
        title: 'Question stem made public',
        description: 'It no longer needs to belong to a question set.',
      })
    } catch {
      void queryClient.invalidateQueries({
        queryKey: ucatKeys.reconciliationQueue('private-stems-not-in-set'),
      })
      toast({
        title: 'Failed to make question stem public',
        description: 'Please try again.',
        variant: 'destructive',
      })
    } finally {
      setMakingPublicStemId(null)
    }
  }, [queryClient, toast])

  const toggleStemSelection = useCallback((id: string) => {
    setSelectedStemIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const toggleSelectAllVisible = useCallback(() => {
    const pagedStems = filteredStems
    if (pagedStems.every((s) => selectedStemIds.has(s.id))) {
      setSelectedStemIds((prev) => {
        const next = new Set(prev)
        pagedStems.forEach((s) => next.delete(s.id))
        return next
      })
    } else {
      setSelectedStemIds((prev) => new Set([...prev, ...pagedStems.map((s) => s.id)]))
    }
  }, [filteredStems, selectedStemIds])

  const allVisibleSelected =
    filteredStems.length > 0 &&
    filteredStems.every((s) => selectedStemIds.has(s.id))
  const someVisibleSelected = filteredStems.some((s) => selectedStemIds.has(s.id))

  const addSelectedStemsToSet = useCallback(async (setId: string, stemIds: string[]) => {
    if (stemIds.length === 0) return
    const count = stemIds.length
    setBulkSetPending(true)
    try {
      await ucatSetsApi.addStemsToSet(setId, stemIds)
      setSelectedStemIds(new Set())
      setBulkSetOpen(false)
      setBulkSetId(null)
      queryClient.invalidateQueries({
        queryKey: ucatKeys.reconciliationQueue('private-stems-not-in-set'),
      })
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
  }, [queryClient, toast])

  const handleBulkAddToSetConfirm = useCallback(async () => {
    if (!bulkSetId || selectedStemIds.size === 0) return
    const stemIds = Array.from(selectedStemIds)
    const selectedSet = staffSets.find((set) => set.id === bulkSetId)
    const selectedStems = filteredStems.filter((stem) => selectedStemIds.has(stem.id))
    const firstStem = selectedStems[0]
    const warning = firstStem ? getSetAddStemWarning(selectedSet, firstStem.sectionId, sectionsQuery.data ?? []) : null
    if (warning) {
      setSetWarning({
        setId: bulkSetId,
        ...warning,
        action: async () => {
          await addSelectedStemsToSet(bulkSetId, stemIds)
        },
      })
      setBulkSetOpen(false)
      return
    }
    await addSelectedStemsToSet(bulkSetId, stemIds)
  }, [addSelectedStemsToSet, bulkSetId, selectedStemIds, staffSets, filteredStems, sectionsQuery.data])

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
      {...tutorToolbarProps}
      searchPlaceholder="Search stems..."
    />
  )

  return (
    <>
      <ReconciliationTable<PrivateStemNotInSet>
        title="Private question stems not in a set"
        items={filteredStems}
        isLoading={isLoading}
        pagination={{
          page: tableState.state.page,
          pageSize: tableState.state.pageSize,
          total: data?.total ?? 0,
          onPageChange: tableState.actions.onPageChange,
          onPageSizeChange: tableState.actions.onPageSizeChange,
        }}
        columnDefinitions={columnDefinitions}
        visibleColumnKeys={tableState.state.visibleColumns}
        toolbar={toolbar}
        headerActions={
          <Button size="sm" className={tutorBtnPrimary} onClick={() => setQueueOpen(true)} disabled={queueEntries.length === 0}>
            Begin reconciling
          </Button>
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
          <PrivateStemNotInSetRow
            key={item.id}
            item={item}
            sets={staffSets}
            categoryPathLookup={categoryPathLookup}
            visibleColumnKeys={visibleColumnKeys}
            selection={sel}
            onAddToSet={(setId) => handleAddToSet(item, setId)}
            onMakePublic={() => handleMakePublic(item)}
            isMakingPublic={makingPublicStemId === item.id}
            onOpenStemDialog={onOpenStemDialog}
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
            <Button variant="outline" size="sm" className={tutorBtnOutline}>
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
      <UcatQuestionStemApprovalQueueDialog
        open={queueOpen}
        title="Reconcile set membership"
        entries={queueEntries}
        onClose={() => setQueueOpen(false)}
      />
      <AlertDialog open={setWarning != null} onOpenChange={(open) => !open && setSetWarning(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{setWarning?.title ?? 'Review set before adding'}</AlertDialogTitle>
            <AlertDialogDescription>
              {setWarning?.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkSetPending}>Cancel</AlertDialogCancel>
            {setWarning ? (
              <Button
                type="button"
                variant="outline"
                className={tutorBtnOutline}
                onClick={() => {
                  const setId = setWarning.setId
                  setSetWarning(null)
                  onEditSet?.(setId)
                }}
              >
                View set
              </Button>
            ) : null}
            <AlertDialogAction
              onClick={() => {
                const action = setWarning?.action
                setSetWarning(null)
                if (action) void action()
              }}
              disabled={bulkSetPending}
            >
              Add anyway
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
  categoryPathLookup,
  visibleColumnKeys,
  selection,
  onAddToSet,
  onMakePublic,
  isMakingPublic,
  onOpenStemDialog,
}: {
  item: PrivateStemNotInSet
  sets: Array<{ id: string | null; name: unknown }>
  categoryPathLookup: Map<string, string>
  visibleColumnKeys: string[]
  selection?: {
    getItemId: (item: PrivateStemNotInSet) => string
    selectedIds: Set<string>
    onToggleSelection: (id: string) => void
  }
  onAddToSet: (setId: string) => Promise<void>
  onMakePublic: () => Promise<void>
  isMakingPublic: boolean
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
  const compactQuestionsDisplay = useMemo(() => {
    const sorted = [...(item.questions ?? [])].sort((a, b) => a.index - b.index)
    const firstQuestion = sorted[0]
    if (!firstQuestion) return ''
    const firstQuestionText = truncate(
      proseMirrorToPlainText(firstQuestion.question_text as import('@altitutor/shared').Json) ?? '',
      80,
    )
    const remainingCount = sorted.length - 1
    return remainingCount > 0
      ? `${firstQuestionText} (+${remainingCount} more)`
      : firstQuestionText
  }, [item.questions])

  const cells: Record<string, React.ReactNode> = {
    category_name: (
      <TableCell className="whitespace-nowrap">
        {resolveCategoryPathLabel(categoryPathLookup, item.categoryId, item.categoryName)}
      </TableCell>
    ),
    stem_text: (
      <TableCell className="max-w-[300px]" title={stemText}>
        {stemTruncated || '—'}
      </TableCell>
    ),
    questions: (
      <TableCell className="w-[320px] max-w-[320px] text-muted-foreground" title={questionsDisplay}>
        <span className="block truncate">{compactQuestionsDisplay || '—'}</span>
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
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" className={tutorBtnOutline} onClick={() => onOpenStemDialog?.(item.id)}>
            View
          </Button>
          <Button
            variant="outline"
            size="sm"
            className={tutorBtnOutline}
            onClick={() => void onMakePublic()}
            disabled={isMakingPublic}
          >
            {isMakingPublic ? 'Making public…' : 'Make public'}
          </Button>
          <AddToSetSelect sets={sets} onSelect={onAddToSet} />
        </div>
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
      <Button variant="outline" size="sm" className={tutorBtnOutline} disabled>
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
        <Button variant="outline" size="sm" className={tutorBtnOutline}>
          Add to set
        </Button>
      }
    />
  )
}
