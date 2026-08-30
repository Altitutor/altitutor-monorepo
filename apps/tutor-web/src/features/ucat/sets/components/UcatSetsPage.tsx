'use client'

import { useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import type { DataTableColumnDefinition, DataTableFilterDefinition, DataTableSortOption } from '@altitutor/shared'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  Checkbox,
  DataTable,
  DataTableToolbar,
  SearchableSelect,
  TablePagination,
  useToast,
} from '@altitutor/ui'
import { CheckCircle2, FilePenLine, ListChecks, Pencil, RotateCcw, Send, Trash2 } from 'lucide-react'
import { useUcatSections } from '@/features/ucat/sections/hooks/useUcatSections'
import { useDeleteUcatSet, useRestoreUcatSet, useSetUcatSetStatus, useUcatSets, useUpdateUcatSet } from '@/features/ucat/sets/hooks/useUcatSets'
import { useUcatMocks } from '@/features/ucat/mocks/hooks/useUcatMocks'
import { UcatAccessDenied, UcatPageHeader, UcatPageSkeleton } from '@/features/ucat/shared/components'
import { useUcatAccess } from '@/features/ucat/shared/hooks/useUcatAccess'
import { getUcatContentStatusTransitionOptions, type UcatContentStatus, type UcatQuestionSetFormat } from '@/features/ucat/shared/types'
import { UcatRowActions } from '@/features/ucat/shared/row-actions'
import { UcatPdfExportDialog, type UcatPdfExportSource } from '@/features/ucat/shared/components/UcatPdfExportDialog'
import { buildUcatPdfExportAction } from '@/features/ucat/shared/pdf/pdf-export-action'
import { UcatCreateSetDialog } from '@/features/ucat/sets/components/UcatCreateSetDialog'
import {
  UcatSetCatalogOrderView,
  type SetCatalogOrderRow,
} from '@/features/ucat/sets/components/UcatSetCatalogOrderView'
import { UcatSetEditorDialog } from '@/features/ucat/sets/components/UcatSetEditorDialog'
import { UcatMockEditorDialog } from '@/features/ucat/mocks/components/UcatMockEditorDialog'
import { UcatDeleteConfirmDialog } from '@/features/ucat/shared/delete-confirm-dialog'
import { UCAT_FILTER_NOT_IN_ANY_MOCK } from '@/features/ucat/shared/lib/table-filter-sentinel'
import { UcatSelectionToolbar } from '@/features/ucat/shared/selection-toolbar'
import { useUcatSetsTable, type SetRow } from '@/features/ucat/sets/hooks/useUcatSetsTable'
import { ucatSetsApi } from '@/features/ucat/sets/api/sets'
import { setDetailToUpdatePayload } from '@/features/ucat/sets/lib/set-payload-mappers'
import { useUcatRowSelection } from '@/features/ucat/shared/hooks/useUcatRowSelection'
import { useBackgroundBulkAction } from '@/features/ucat/shared/hooks/useBackgroundBulkAction'
import {
  bulkDeleteProgressToast,
  bulkStatusProgressToast,
  bulkUpdateProgressToast,
  nextBulkActionToastId,
  type BackgroundBulkToast,
} from '@/features/ucat/shared/lib/background-bulk-action'
import { ucatKeys } from '@/features/ucat/shared/lib/query-keys'
import { cn } from '@/shared/utils'
import { tutorBtnOutline, tutorBtnPrimary, tutorDataTableProps, tutorToolbarProps } from '@/shared/lib/tutor-visual'
import { SegmentedControl } from '@/shared/components/segmented-control'
import {
  firstUcatBulkStatusFailureError,
  lifecycleErrorToast,
  lifecycleStatusSuccessToast,
  type UcatLifecycleEntityType,
} from '@/features/ucat/shared/lifecycle-errors'
import { confirmDiscardUnsavedOrder } from '@/features/ucat/shared/components/UcatOrderSaveToolbar'
function parseStatusTab(value: string | null): UcatContentStatus {
  return value === 'in_review' || value === 'published' ? value : 'draft'
}

const columnDefinitions: DataTableColumnDefinition[] = [
  { key: 'name', label: 'Name', visibleByDefault: true },
  { key: 'sections', label: 'Sections', visibleByDefault: true },
  { key: 'time_limit_seconds', label: 'Time Limit', visibleByDefault: true },
  { key: 'stem_count', label: 'Question stems', visibleByDefault: true },
  { key: 'question_count', label: 'Questions', visibleByDefault: true },
  { key: 'mocks', label: 'Mocks', visibleByDefault: true },
  { key: 'visibility', label: 'Visibility', visibleByDefault: false },
  { key: 'created_by', label: 'Created by', visibleByDefault: true },
  { key: 'actions', label: 'Actions', visibleByDefault: true },
]

const sortOptions: DataTableSortOption[] = [
  { key: 'name', label: 'Name' },
  { key: 'sections', label: 'Sections' },
  { key: 'time_limit_seconds', label: 'Time Limit' },
  { key: 'stem_count', label: 'Question stems' },
  { key: 'question_count', label: 'Questions' },
  { key: 'mocks', label: 'Mocks' },
  { key: 'visibility', label: 'Visibility' },
  { key: 'created_by', label: 'Created by' },
]

function countSetsInMocks(setIds: string[], rows: SetRow[]): number {
  return setIds.filter((id) => (rows.find((r) => r.id === id)?.ucat_mock_ids.length ?? 0) > 0).length
}

export function UcatSetsPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const activeStatus = parseStatusTab(searchParams.get('tab'))
  const viewMode = searchParams.get('view') === 'order' ? 'order' : 'table'
  const bulkStatusOptions = useMemo(() => getUcatContentStatusTransitionOptions(activeStatus), [activeStatus])
  const queryClient = useQueryClient()
  const access = useUcatAccess()
  const sets = useUcatSets()
  const sectionsQuery = useUcatSections()
  const sections = useMemo(() => sectionsQuery.data ?? [], [sectionsQuery.data])
  const deleteSet = useDeleteUcatSet()
  const restoreSet = useRestoreUcatSet()
  const setStatus = useSetUcatSetStatus()
  const [openCreate, setOpenCreate] = useState(false)
  const [editingSetId, setEditingSetId] = useState<string | null>(null)
  const [editingMockId, setEditingMockId] = useState<string | null>(null)
  const [deletingSetId, setDeletingSetId] = useState<string | null>(null)
  const [pdfExportSource, setPdfExportSource] = useState<UcatPdfExportSource | null>(null)
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [bulkVisibilityOpen, setBulkVisibilityOpen] = useState(false)
  const [bulkVisibilityPrivate, setBulkVisibilityPrivate] = useState<boolean | null>(null)
  const [bulkStatusOpen, setBulkStatusOpen] = useState(false)
  const [bulkStatus, setBulkStatus] = useState<UcatContentStatus | null>(null)
  const [singleDeletePending, setSingleDeletePending] = useState(false)
  const [mockFilterSearch, setMockFilterSearch] = useState('')
  const [createSectionId, setCreateSectionId] = useState<string | null>(null)
  const [createSetFormat, setCreateSetFormat] = useState<UcatQuestionSetFormat>('full_section')
  const [orderDirty, setOrderDirty] = useState(false)
  const updateSetMutation = useUpdateUcatSet()
  const mocksQuery = useUcatMocks()

  useEffect(() => {
    const editId = searchParams.get('edit')
    if (editId) setEditingSetId(editId)
  }, [searchParams])

  function setViewMode(value: 'table' | 'order') {
    if (!confirmDiscardUnsavedOrder(orderDirty)) return
    const params = new URLSearchParams(searchParams.toString())
    if (value === 'order') params.set('view', 'order')
    else params.delete('view')
    const query = params.toString()
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }

  const mockFilterOptions = useMemo(() => {
    const list = (mocksQuery.data ?? []) as Array<{
      id: string | null
      name: string | null
      deleted_at?: string | null
    }>
    const active = list.filter((m) => m.deleted_at == null && m.id)
    const q = mockFilterSearch.trim().toLowerCase()
    const filtered = q ? active.filter((m) => (m.name ?? '').toLowerCase().includes(q)) : active
    const fromMocks = filtered
      .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''))
      .map((m) => ({ label: m.name ?? 'Untitled', value: m.id as string }))
    const noneOption = { label: 'Not in any mock', value: UCAT_FILTER_NOT_IN_ANY_MOCK }
    const combined = [noneOption, ...fromMocks]
    if (!q) return combined
    return combined.filter((o) => o.label.toLowerCase().includes(q))
  }, [mocksQuery.data, mockFilterSearch])

  const filterDefinitions = useMemo((): DataTableFilterDefinition[] => {
    return [
      {
        key: 'visibility',
        label: 'Visibility',
        options: [
          { label: 'Public', value: 'public' },
          { label: 'Private', value: 'private' },
        ],
      },
      {
        key: 'section',
        label: 'Section',
        options: [
          { label: 'All sections', value: 'all' },
          ...sections
            .filter((s) => s.section_number != null)
            .sort((a, b) => (a.section_number ?? 0) - (b.section_number ?? 0))
            .map((s) => ({
              label: `${s.name ?? `Section ${s.section_number}`}`,
              value: String(s.section_number),
            })),
        ],
      },
      {
        key: 'ucat_mock_id',
        label: 'Mock',
        options: mockFilterOptions,
        searchable: true,
        searchPlaceholder: 'Search mocks...',
      },
      {
        key: 'time_limit',
        label: 'Time limit (s)',
        type: 'number-range',
        minKey: 'time_limit_min',
        maxKey: 'time_limit_max',
        nullOptionLabel: 'Untimed',
      },
      {
        key: 'stem_count',
        label: 'Question stems',
        type: 'number-range',
        minKey: 'stem_count_min',
        maxKey: 'stem_count_max',
      },
      {
        key: 'question_count',
        label: 'Questions',
        type: 'number-range',
        minKey: 'question_count_min',
        maxKey: 'question_count_max',
      },
    ]
  }, [sections, mockFilterOptions])

  const { rows, visibleColumns, tableState, showDeleted, setShowDeleted } = useUcatSetsTable({
    data: sets.data,
    defaultFilters: {},
    sections,
    mocks: mocksQuery.data ?? [],
    initialVisibleColumns: columnDefinitions.filter((c) => c.visibleByDefault).map((c) => c.key),
    status: activeStatus,
    onOpenMock: setEditingMockId,
  })

  function changeStatusTab(status: UcatContentStatus) {
    const params = new URLSearchParams(searchParams.toString())
    if (status === 'draft') params.delete('tab')
    else params.set('tab', status)
    const query = params.toString()
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
    clearSelection()
  }

  const { page, pageSize } = tableState.state
  const totalRows = rows.length
  const pageCount = Math.max(1, Math.ceil(totalRows / pageSize))
  const effectivePage = Math.min(page, pageCount)
  const paginatedRows = rows.slice((effectivePage - 1) * pageSize, effectivePage * pageSize)

  const {
    selectedIds: selectedSetIds,
    selectedIdsArray: selectedSetIdsArray,
    selectionMode,
    allVisibleSelected,
    someVisibleSelected,
    toggleSelection: toggleSetSelection,
    toggleSelectAllVisible,
    clearSelection,
  } = useUcatRowSelection(paginatedRows)
  const { toast } = useToast()
  const { start: startBackgroundBulk, selectionIsBusy } = useBackgroundBulkAction()
  const bulkSelectionBusy = selectionIsBusy(selectedSetIds)

  function handleBulkVisibilityConfirm() {
    if (bulkVisibilityPrivate == null) return
    const ids = Array.from(selectedSetIds)
    const accessScope = bulkVisibilityPrivate ? 'private' : 'public'
    startBackgroundBulk({
      ids,
      toastId: nextBulkActionToastId('visibility'),
      progress: bulkUpdateProgressToast(ids.length, 'set', 'visibility'),
      begin: () => {
        setBulkVisibilityOpen(false)
        setBulkVisibilityPrivate(null)
        clearSelection()
      },
      run: async () => {
        for (const setId of ids) {
          const detail = await ucatSetsApi.detail(setId)
          if (!detail) continue
          await updateSetMutation.mutateAsync({
            setId,
            payload: setDetailToUpdatePayload(detail, { accessScope }),
          })
        }
      },
      onSuccess: () => ({ title: ids.length === 1 ? 'Visibility updated' : `Visibility updated for ${ids.length} sets` }),
      onError: (error) => lifecycleErrorToast(error, 'Could not update visibility', router.push, openLifecycleEntity),
    })
  }

  async function openSetPdfExport(row: Pick<SetRow, 'id' | 'name'>) {
    try {
      const detail = await ucatSetsApi.detail(row.id)
      if (!detail) throw new Error('Set not found')
      const stems = (detail.stems as Array<{ stem_id: string }> | null) ?? []
      setPdfExportSource({
        kind: 'set',
        title: row.name === '—' ? 'Untitled set' : row.name,
        stemIds: stems.map((stem) => stem.stem_id),
      })
    } catch (error) {
      toast({
        title: 'Could not prepare export',
        description: error instanceof Error ? error.message : 'Failed to load this set.',
        variant: 'destructive',
      })
    }
  }

  const bulkDeleteInMocksCount = countSetsInMocks(selectedSetIdsArray, rows)
  const singleDeleteInMocksCount = deletingSetId
    ? (rows.find((r) => r.id === deletingSetId)?.ucat_mock_ids.length ?? 0)
    : 0
  async function invalidateSetsListQueries(setIds: string[] = []) {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ucatKeys.sets() }),
      queryClient.invalidateQueries({ queryKey: ucatKeys.mocks() }),
      ...setIds.map((setId) => queryClient.invalidateQueries({ queryKey: ucatKeys.set(setId) })),
      ...setIds.flatMap((setId) => {
        const row = rows.find((r) => r.id === setId)
        return (row?.ucat_mock_ids ?? []).map((mockId) =>
          queryClient.invalidateQueries({ queryKey: ucatKeys.mock(mockId) }),
        )
      }),
    ])
  }

  function openLifecycleEntity(entityType: UcatLifecycleEntityType, entityId: string) {
    if (entityType === 'set') {
      setEditingSetId(entityId)
      return true
    }
    if (entityType === 'mock') {
      setEditingSetId(null)
      setDeletingSetId(null)
      setEditingMockId(entityId)
      return true
    }
    return false
  }

  function changeSetStatus(
    setId: string,
    status: UcatContentStatus,
    previousStatus: UcatContentStatus,
    title: string,
  ) {
    void (async () => {
      try {
        await setStatus.mutateAsync({ setId, status })
        toast(lifecycleStatusSuccessToast({
          contentLabel: 'Set',
          count: 1,
          status,
          onUndo: () => {
            void ucatSetsApi.bulkRestoreStatus([setId], status, previousStatus)
              .then(async () => {
                await invalidateSetsListQueries([setId])
                toast({ title: 'Set status restored' })
              })
              .catch((error) => toast(lifecycleErrorToast(error, 'Could not undo status change', router.push, openLifecycleEntity)))
          },
        }))
      } catch (error) {
        toast(lifecycleErrorToast(error, title, router.push, openLifecycleEntity))
      }
    })()
  }

  function handleBulkStatusConfirm() {
    if (!bulkStatus) return
    const ids = Array.from(selectedSetIds)
    const nextStatus = bulkStatus
    startBackgroundBulk({
      ids,
      toastId: nextBulkActionToastId('status'),
      progress: bulkStatusProgressToast(ids.length, 'set', nextStatus),
      begin: () => {
        setBulkStatusOpen(false)
        setBulkStatus(null)
        clearSelection()
      },
      run: async () => {
        const result = await ucatSetsApi.bulkSetStatus(ids, nextStatus)
        await invalidateSetsListQueries(ids)
        return result
      },
      onSuccess: (result) => {
        const toasts: BackgroundBulkToast[] = []
        if (result.movedIds.length > 0) {
          toasts.push(lifecycleStatusSuccessToast({
            contentLabel: 'Set',
            count: result.movedIds.length,
            status: nextStatus,
            onUndo: () => {
              void ucatSetsApi.bulkRestoreStatus(result.movedIds, nextStatus, activeStatus)
                .then(async () => {
                  await invalidateSetsListQueries(result.movedIds)
                  toast({ title: result.movedIds.length === 1 ? 'Set status restored' : 'Set statuses restored' })
                })
                .catch((error) => toast(lifecycleErrorToast(error, 'Could not undo status change', router.push, openLifecycleEntity)))
            },
          }))
        }
        const failureError = firstUcatBulkStatusFailureError(result)
        if (failureError) {
          const count = result.failures.length
          toasts.push(lifecycleErrorToast(
            failureError,
            count === 1 ? '1 set could not be moved' : `${count} sets could not be moved`,
            router.push,
            openLifecycleEntity,
          ))
        }
        return toasts
      },
      onError: (error) => lifecycleErrorToast(error, 'Cannot move selected sets', router.push, openLifecycleEntity),
    })
  }

  function setDeleteSuccessToast(setIds: string[]) {
    const count = setIds.length
    return {
      title: count === 1 ? 'Set deleted' : `${count} sets deleted`,
      description: 'Tap Undo to restore.',
      duration: 10_000,
      action: {
        label: 'Undo',
        onClick: () => {
          void (async () => {
            try {
              await Promise.all(setIds.map((id) => restoreSet.mutateAsync(id)))
              await invalidateSetsListQueries(setIds)
              toast({
                title: count === 1 ? 'Set restored' : `${count} sets restored`,
              })
            } catch (err) {
              toast({
                title: 'Could not undo',
                description: err instanceof Error ? err.message : 'Failed to restore sets.',
                variant: 'destructive',
              })
            }
          })()
        },
      },
    }
  }

  async function deleteSets(setIds: string[]) {
    if (setIds.length === 1) {
      await deleteSet.mutateAsync(setIds[0])
    } else {
      await ucatSetsApi.bulkRemove(setIds)
    }
    await invalidateSetsListQueries(setIds)
  }

  async function deleteSetsWithMockRemoval(setIds: string[]) {
    await deleteSets(setIds)
    toast(setDeleteSuccessToast(setIds))
  }

  function handleBulkDeleteConfirm() {
    const ids = Array.from(selectedSetIds)
    const started = startBackgroundBulk({
      ids,
      toastId: nextBulkActionToastId('delete'),
      progress: bulkDeleteProgressToast(ids.length, 'set'),
      begin: () => {
        setBulkDeleteOpen(false)
        clearSelection()
      },
      run: () => deleteSets(ids),
      onSuccess: () => setDeleteSuccessToast(ids),
      onError: (error) => lifecycleErrorToast(error, 'Cannot delete', router.push, openLifecycleEntity),
    })
    if (!started) throw new Error('already in progress')
  }

  if (access.isLoading || sets.isLoading) return <UcatPageSkeleton rows={8} />
  if (!access.data) return <UcatAccessDenied />

  if (viewMode === 'order') {
    const orderRows: SetCatalogOrderRow[] = (sets.data ?? [])
      .filter((set) => set.deleted_at == null && set.mock_id == null)
      .flatMap((set) => set.id && set.section_id && set.set_format ? [{
        id: set.id,
        displayName: set.display_name ?? set.compact_display_name ?? set.id,
        authoringNote: set.authoring_note ?? null,
        sectionId: set.section_id,
        sectionName: set.section_name ?? 'Unknown section',
        sectionNumber: set.section_number ?? null,
        setFormat: set.set_format,
        catalogIndex: set.catalog_index ?? null,
        status: set.status ?? 'draft',
        timingMode: set.timing_mode ?? 'untimed',
        paceMultiplier: set.pace_multiplier ?? null,
        timeLimitSeconds: set.time_limit_seconds ?? null,
        questionCount: set.question_count ?? 0,
      }] : [])
    return (
      <div className="space-y-6 py-8 md:py-10">
        <UcatPageHeader
          title="UCAT Sets"
          description="Set deterministic published order within each section and format"
          backHref="/ucat"
          breadcrumbs={[{ label: 'UCAT', href: '/ucat' }, { label: 'Sets' }]}
          actions={<div className="flex items-center gap-2">
            <SegmentedControl options={[{ value: 'table', label: 'Table' }, { value: 'order', label: 'Order' }]} value="order" onValueChange={(value) => setViewMode(value === 'order' ? 'order' : 'table')} />
            <Button
              className={tutorBtnPrimary}
              onClick={() => {
                setCreateSectionId(null)
                setCreateSetFormat('full_section')
                setOpenCreate(true)
              }}
            >
              Add Set
            </Button>
          </div>}
        />
        <UcatSetCatalogOrderView
          rows={orderRows}
          sections={sections.flatMap((section) => section.id ? [{
            id: section.id,
            name: section.name ?? 'Untitled section',
            sectionNumber: section.section_number ?? null,
          }] : [])}
          onDirtyChange={setOrderDirty}
          onSave={async (scopes) => {
            await Promise.all(scopes.map((scope) =>
              ucatSetsApi.reorder(scope.sectionId, scope.setFormat, scope.ids)
            ))
            await queryClient.invalidateQueries({ queryKey: ucatKeys.sets() })
          }}
          onCreate={(sectionId, setFormat) => {
            setCreateSectionId(sectionId)
            setCreateSetFormat(setFormat)
            setOpenCreate(true)
          }}
          onView={setEditingSetId}
          onExportPdf={(setId) => {
            const row = orderRows.find((candidate) => candidate.id === setId)
            if (row) void openSetPdfExport({ id: row.id, name: row.displayName })
          }}
          onStatusChange={(row, status) => {
            if (!confirmDiscardUnsavedOrder(orderDirty)) return
            changeSetStatus(row.id, status, row.status, 'Cannot change set status')
          }}
          onDelete={setDeletingSetId}
        />

        <UcatCreateSetDialog
          key={openCreate ? `open:${createSectionId ?? 'none'}:${createSetFormat}` : 'closed'}
          open={openCreate}
          initialSectionId={createSectionId}
          initialSetFormat={createSetFormat}
          onClose={() => setOpenCreate(false)}
          onCreated={(setId, setName) => {
            setEditingSetId(setId)
            toast({ title: `Set ${setName} created` })
          }}
          onOpenLifecycleEntity={openLifecycleEntity}
        />
        <UcatSetEditorDialog
          open={!!editingSetId}
          setId={editingSetId}
          onClose={() => setEditingSetId(null)}
          onDelete={editingSetId ? () => setDeletingSetId(editingSetId) : undefined}
        />
        {pdfExportSource ? (
          <UcatPdfExportDialog open onClose={() => setPdfExportSource(null)} source={pdfExportSource} />
        ) : null}
        <UcatDeleteConfirmDialog
          open={!!deletingSetId}
          onOpenChange={(open) => !open && setDeletingSetId(null)}
          title="Delete set?"
          description="The set will be hidden from students. You can restore it later from the deleted list."
          onConfirm={async () => {
            if (!deletingSetId) return
            setSingleDeletePending(true)
            try {
              await deleteSetsWithMockRemoval([deletingSetId])
              setEditingSetId((previous) => previous === deletingSetId ? null : previous)
              setDeletingSetId(null)
            } catch (error) {
              toast(lifecycleErrorToast(error, 'Cannot delete', router.push, openLifecycleEntity))
            } finally {
              setSingleDeletePending(false)
            }
          }}
          isPending={singleDeletePending}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6 py-8 md:py-10">
      <UcatPageHeader
        title="UCAT Sets"
        description="Draft, review, and publish UCAT question sets"
        backHref="/ucat"
        breadcrumbs={[{ label: 'UCAT', href: '/ucat' }, { label: 'Sets' }]}
        actions={<div className="flex items-center gap-2">
          <SegmentedControl options={[{ value: 'table', label: 'Table' }, { value: 'order', label: 'Order' }]} value="table" onValueChange={(value) => setViewMode(value === 'order' ? 'order' : 'table')} />
          <Button className={tutorBtnPrimary} onClick={() => setOpenCreate(true)}>Add Set</Button>
        </div>}
      />

      <SegmentedControl
        className="w-fit max-w-full"
        value={activeStatus}
        onValueChange={(value) => changeStatusTab(parseStatusTab(value))}
        options={[
          { value: 'draft', label: 'Draft' },
          { value: 'in_review', label: 'In review' },
          { value: 'published', label: 'Published' },
        ]}
      />

      <DataTableToolbar
        state={tableState.state}
        onSearchChange={tableState.actions.onSearchChange}
        onFiltersChange={tableState.actions.onFiltersChange}
        onSortChange={tableState.actions.onSortChange}
        onGroupByChange={tableState.actions.onGroupByChange}
        onVisibleColumnsChange={tableState.actions.onVisibleColumnsChange}
        onQuickFilterApply={tableState.actions.onQuickFilterApply}
        onReset={tableState.actions.onReset}
        filterDefinitions={filterDefinitions}
        columnDefinitions={columnDefinitions}
        sortOptions={sortOptions}
        {...tutorToolbarProps}
        searchPlaceholder="Search sets"
        filterSearchValues={{ ucat_mock_id: mockFilterSearch }}
        onFilterSearchChange={(filterKey, value) => {
          if (filterKey === 'ucat_mock_id') setMockFilterSearch(value)
        }}
        filterFooter={
          <div className="px-2 py-2 border-t">
            <Button
              variant="outline"
              size="sm"
              className={cn(tutorBtnOutline, 'w-full justify-center')}
              onClick={() => {
                setShowDeleted((prev) => {
                  const next = !prev
                  if (next) {
                    tableState.actions.onFiltersChange({})
                    tableState.actions.onSearchChange('')
                  }
                  return next
                })
              }}
            >
              {showDeleted ? 'Show active only' : 'Show deleted'}
            </Button>
          </div>
        }
        showDeletedActive={showDeleted}
        onClearShowDeleted={() => setShowDeleted(false)}
      />

      <div className={cn('pt-3', selectionMode && 'pb-24')}>
        <DataTable
          {...tutorDataTableProps}
          columns={[
            {
              id: 'select',
              header: () => (
                <Checkbox
                  checked={allVisibleSelected ? true : someVisibleSelected ? 'indeterminate' : false}
                  onCheckedChange={toggleSelectAllVisible}
                  aria-label="Select all visible rows"
                />
              ),
              cell: ({ row }) => {
                const r = row.original as SetRow
                return (
                  <div onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selectedSetIds.has(r.id)}
                      onCheckedChange={() => toggleSetSelection(r.id)}
                      aria-label={`Select set ${r.id}`}
                    />
                  </div>
                )
              },
            },
            ...visibleColumns,
            {
              id: 'created_by',
              header: 'Created by',
              cell: ({ row }) => {
                const r = row.original as SetRow
                const name = [r.created_by_first_name, r.created_by_last_name].filter(Boolean).join(' ') || '—'
                return <span>{name}</span>
              },
            },
            {
              id: 'actions',
              header: 'Actions',
              cell: ({ row }) => {
                const r = row.original as SetRow
                return (
                  <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
                    <UcatRowActions
                      actions={[
                        { label: 'Edit', icon: <Pencil className="h-4 w-4" />, onClick: () => setEditingSetId(r.id) },
                        ...(!showDeleted
                          ? [buildUcatPdfExportAction(() => void openSetPdfExport(r))]
                          : []),
                        ...(!showDeleted && r.status === 'draft'
                          ? [{ label: 'Send for review', icon: <Send className="h-4 w-4" />, onClick: () => changeSetStatus(r.id, 'in_review', r.status, 'Cannot send for review') }]
                          : []),
                        ...(!showDeleted && r.status === 'in_review'
                          ? [
                              { label: 'Publish', icon: <CheckCircle2 className="h-4 w-4" />, onClick: () => changeSetStatus(r.id, 'published', r.status, 'Cannot publish') },
                              { label: 'Return to draft', icon: <FilePenLine className="h-4 w-4" />, onClick: () => changeSetStatus(r.id, 'draft', r.status, 'Cannot return to draft') },
                            ]
                          : []),
                        ...(!showDeleted && r.status === 'published'
                          ? [
                              { label: 'Move to review', icon: <ListChecks className="h-4 w-4" />, onClick: () => changeSetStatus(r.id, 'in_review', r.status, 'Cannot move set') },
                              { label: 'Move to draft', icon: <FilePenLine className="h-4 w-4" />, onClick: () => changeSetStatus(r.id, 'draft', r.status, 'Cannot move set') },
                            ]
                          : []),
                        ...(showDeleted
                          ? [{ label: 'Restore', icon: <RotateCcw className="h-4 w-4" />, onClick: () => restoreSet.mutate(r.id) }]
                          : [
                              {
                                label: 'Delete',
                                icon: <Trash2 className="h-4 w-4" />,
                                onClick: () => setDeletingSetId(r.id),
                                destructive: true,
                              },
                            ]),
                      ]}
                    />
                  </div>
                )
              },
            },
          ]}
          data={paginatedRows}
          pagination="external"
          pageSizeOptions={[10, 20, 50]}
          getRowClassName={(row) => cn(row.deleted_at ? 'bg-destructive/10' : '', selectedSetIds.has(row.id) && 'bg-muted/50')}
          onRowClick={selectionMode ? (row) => toggleSetSelection(row.id) : undefined}
        />
        <TablePagination
          page={effectivePage}
          pageSize={pageSize}
          total={totalRows}
          onPageChange={tableState.actions.onPageChange}
          onPageSizeChange={tableState.actions.onPageSizeChange}
          pageSizeOptions={[10, 20, 50]}
          className="pt-3"
        />
      </div>

      <UcatSelectionToolbar
        selectedCount={selectedSetIds.size}
        onCancel={clearSelection}
        onDelete={() => setBulkDeleteOpen(true)}
        deletePending={bulkSelectionBusy}
      >
        <SearchableSelect<{ value: boolean; label: string }>
          items={[
            { value: false, label: 'Public' },
            { value: true, label: 'Private' },
          ]}
          value={null}
          disabled={bulkSelectionBusy}
          onValueChange={(item) => {
            if (item) {
              setBulkVisibilityPrivate(item.value);
              setBulkVisibilityOpen(true);
            }
          }}
          getItemId={(i) => (i.value ? 'private' : 'public')}
          getItemLabel={(i) => i.label}
          placeholder="Visibility"
          searchPlaceholder="Search..."
          emptyMessage="No options"
          trigger={
            <Button variant="outline" size="sm" className={tutorBtnOutline}>
              Visibility
            </Button>
          }
          contentWidth="160px"
          align="start"
          side="top"
        />
        <SearchableSelect<{ value: UcatContentStatus; label: string }>
          items={bulkStatusOptions}
          value={null}
          onValueChange={(item) => {
            if (!item) return
            setBulkStatus(item.value)
            setBulkStatusOpen(true)
          }}
          getItemId={(item) => item.value}
          getItemLabel={(item) => item.label}
          placeholder="Status"
          searchPlaceholder="Search statuses..."
          emptyMessage="No status found"
          disabled={bulkSelectionBusy}
          trigger={
            <Button variant="outline" size="sm" className={tutorBtnOutline}>
              Status
            </Button>
          }
          contentWidth="180px"
          align="start"
          side="top"
        />
      </UcatSelectionToolbar>

      <AlertDialog open={bulkVisibilityOpen} onOpenChange={setBulkVisibilityOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Set visibility for {selectedSetIds.size} set(s)?</AlertDialogTitle>
            <AlertDialogDescription>
              Visibility will be set to {bulkVisibilityPrivate ? 'Private' : 'Public'} for all selected sets.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => handleBulkVisibilityConfirm()}>
              Yes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={bulkStatusOpen} onOpenChange={setBulkStatusOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Move {selectedSetIds.size} set(s) to {bulkStatus?.replace('_', ' ')}?</AlertDialogTitle>
            <AlertDialogDescription>
              Eligible sets will move. Any blocked sets will remain in their current status.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => handleBulkStatusConfirm()}>
              Move sets
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <UcatDeleteConfirmDialog
        open={bulkDeleteOpen}
        onOpenChange={(open) => !open && setBulkDeleteOpen(false)}
        title={`Delete ${selectedSetIds.size} set(s)?`}
        description={
          bulkDeleteInMocksCount > 0
            ? `${bulkDeleteInMocksCount} of the selected set(s) are in one or more mocks. Remove them from those mocks before deleting. No mock membership will be changed automatically.`
            : 'The selected sets will be hidden from students. You can restore them later from the deleted list.'
        }
        onConfirm={handleBulkDeleteConfirm}
      />

      <UcatCreateSetDialog
        key={openCreate ? 'open' : 'closed'}
        open={openCreate}
        initialSectionId={null}
        initialSetFormat="full_section"
        onClose={() => setOpenCreate(false)}
        onCreated={(setId, setName) => {
          setEditingSetId(setId)
          toast({
            title: `Set ${setName} created`,
            description: (
              <button
                type="button"
                onClick={() => setEditingSetId(setId)}
                className="underline font-medium hover:no-underline text-left"
              >
                View set
              </button>
            ),
          })
        }}
        onOpenLifecycleEntity={openLifecycleEntity}
      />

      <UcatSetEditorDialog
        open={!!editingSetId}
        setId={editingSetId}
        onClose={() => setEditingSetId(null)}
        onDelete={
          editingSetId
            ? () => {
                setDeletingSetId(editingSetId)
              }
            : undefined
        }
      />
      {pdfExportSource ? (
        <UcatPdfExportDialog
          open
          onClose={() => setPdfExportSource(null)}
          source={pdfExportSource}
        />
      ) : null}
      <UcatMockEditorDialog
        open={!!editingMockId}
        mockId={editingMockId}
        onClose={() => setEditingMockId(null)}
        onEditSet={(setId) => {
          setEditingSetId(setId)
        }}
      />
      <UcatDeleteConfirmDialog
        open={!!deletingSetId}
        onOpenChange={(open) => !open && setDeletingSetId(null)}
        title="Delete set?"
        description={
          singleDeleteInMocksCount > 0
            ? `This set is in ${singleDeleteInMocksCount} mock(s). Remove it from those mocks before deleting. No mock membership will be changed automatically.`
            : 'The set will be hidden from students. You can restore it later from the deleted list.'
        }
        onConfirm={async () => {
          if (!deletingSetId) return
          setSingleDeletePending(true)
          try {
            await deleteSetsWithMockRemoval([deletingSetId])
            setEditingSetId((prev) => (prev === deletingSetId ? null : prev))
          } catch (err) {
            toast(lifecycleErrorToast(err, 'Cannot delete', router.push, openLifecycleEntity))
          } finally {
            setSingleDeletePending(false)
          }
        }}
        isPending={singleDeletePending}
      />
    </div>
  )
}
