'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Input,
  SearchableSelect,
  TablePagination,
  useToast,
} from '@altitutor/ui'
import { CheckCircle2, FilePenLine, ListChecks, Pencil, RotateCcw, Send, Trash2 } from 'lucide-react'
import { useCreateUcatMock, useDeleteUcatMock, useRestoreUcatMock, useSetUcatMockStatus, useUcatMocks, useUpdateUcatMock } from '@/features/ucat/mocks/hooks/useUcatMocks'
import { useUcatMocksTable, type MockRow } from '@/features/ucat/mocks/hooks/useUcatMocksTable'
import { UcatAccessDenied, UcatPageHeader, UcatPageSkeleton } from '@/features/ucat/shared/components'
import { useUcatAccess } from '@/features/ucat/shared/hooks/useUcatAccess'
import { useUcatRowSelection } from '@/features/ucat/shared/hooks/useUcatRowSelection'
import { useBackgroundBulkAction } from '@/features/ucat/shared/hooks/useBackgroundBulkAction'
import {
  bulkDeleteProgressToast,
  bulkStatusProgressToast,
  bulkUpdateProgressToast,
  nextBulkActionToastId,
  type BackgroundBulkToast,
} from '@/features/ucat/shared/lib/background-bulk-action'
import { UcatRowActions } from '@/features/ucat/shared/row-actions'
import { UcatPdfExportDialog, type UcatPdfExportSource } from '@/features/ucat/shared/components/UcatPdfExportDialog'
import { buildUcatPdfExportAction } from '@/features/ucat/shared/pdf/pdf-export-action'
import { UcatMockEditorDialog } from '@/features/ucat/mocks/components/UcatMockEditorDialog'
import { UcatSetEditorDialog } from '@/features/ucat/sets/components/UcatSetEditorDialog'
import { UcatDeleteConfirmDialog } from '@/features/ucat/shared/delete-confirm-dialog'
import { UcatDialogShell } from '@/features/ucat/shared/dialog-shell'
import { UcatSelectionToolbar } from '@/features/ucat/shared/selection-toolbar'
import { ucatMocksApi } from '@/features/ucat/mocks/api/mocks'
import { UcatRichTextEditor } from '@/features/ucat/shared/UcatRichTextEditor'
import { getUcatContentStatusTransitionOptions, type RichTextJson, type UcatContentStatus } from '@/features/ucat/shared/types'
import { ucatKeys } from '@/features/ucat/shared/lib/query-keys'
import { useUcatSections } from '@/features/ucat/sections/hooks/useUcatSections'
import { cn } from '@/shared/utils'
import { tutorBtnOutline, tutorBtnPrimary, tutorDataTableProps, tutorToolbarProps } from '@/shared/lib/tutor-visual'
import { SegmentedControl } from '@/shared/components/segmented-control'
import {
  firstUcatBulkStatusFailureError,
  lifecycleErrorToast,
  lifecycleStatusSuccessToast,
  type UcatLifecycleEntityType,
} from '@/features/ucat/shared/lifecycle-errors'

function parseStatusTab(value: string | null): UcatContentStatus {
  return value === 'in_review' || value === 'published' ? value : 'draft'
}

const filterDefinitions: DataTableFilterDefinition[] = [
  {
    key: 'visibility',
    label: 'Visibility',
    options: [
      { label: 'Public', value: 'public' },
      { label: 'Private', value: 'private' },
    ],
  },
]

const columnDefinitions: DataTableColumnDefinition[] = [
  { key: 'name', label: 'Name', visibleByDefault: true },
  { key: 'visibility', label: 'Visibility', visibleByDefault: false },
  { key: 'set_count', label: 'Sets', visibleByDefault: true },
  { key: 'updated_at', label: 'Updated', visibleByDefault: false },
  { key: 'actions', label: 'Actions', visibleByDefault: true },
]

const sortOptions: DataTableSortOption[] = [
  { key: 'name', label: 'Name' },
  { key: 'visibility', label: 'Visibility' },
  { key: 'set_count', label: 'Sets' },
  { key: 'updated_at', label: 'Updated' },
]

export function UcatMocksPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const activeStatus = parseStatusTab(searchParams.get('tab'))
  const bulkStatusOptions = useMemo(() => getUcatContentStatusTransitionOptions(activeStatus), [activeStatus])
  const access = useUcatAccess()
  const mocks = useUcatMocks()
  const sectionsQuery = useUcatSections()
  const sections = useMemo(() => sectionsQuery.data ?? [], [sectionsQuery.data])
  const createMock = useCreateUcatMock()
  const deleteMock = useDeleteUcatMock()
  const restoreMock = useRestoreUcatMock()
  const setStatus = useSetUcatMockStatus()
  const [openCreate, setOpenCreate] = useState(false)
  const [editingMockId, setEditingMockId] = useState<string | null>(null)
  const [editingSetId, setEditingSetId] = useState<string | null>(null)
  const [deletingMockId, setDeletingMockId] = useState<string | null>(null)
  const [pdfExportSource, setPdfExportSource] = useState<UcatPdfExportSource | null>(null)
  const [name, setName] = useState('')
  const [isPrivate, setIsPrivate] = useState(false)
  const [instructionsText, setInstructionsText] = useState<RichTextJson | null>(null)
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [bulkVisibilityOpen, setBulkVisibilityOpen] = useState(false)
  const [bulkVisibilityPrivate, setBulkVisibilityPrivate] = useState<boolean | null>(null)
  const [bulkStatusOpen, setBulkStatusOpen] = useState(false)
  const [bulkStatus, setBulkStatus] = useState<UcatContentStatus | null>(null)
  const [singleDeletePending, setSingleDeletePending] = useState(false)
  const queryClient = useQueryClient()
  const updateMockMutation = useUpdateUcatMock()
  const { toast } = useToast()

  useEffect(() => {
    const editId = searchParams.get('edit')
    if (editId) setEditingMockId(editId)
  }, [searchParams])

  const { rows, visibleColumns, tableState, showDeleted, setShowDeleted } = useUcatMocksTable({
    data: mocks.data,
    initialVisibleColumns: columnDefinitions.filter((column) => column.visibleByDefault).map((column) => column.key),
    availableColumns: columnDefinitions.map((column) => column.key),
    sections,
    onOpenSet: setEditingSetId,
    status: activeStatus,
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
    selectedIds: selectedMockIds,
    selectionMode,
    allVisibleSelected,
    someVisibleSelected,
    toggleSelection: toggleMockSelection,
    toggleSelectAllVisible,
    clearSelection,
  } = useUcatRowSelection(paginatedRows)
  const { start: startBackgroundBulk, selectionIsBusy } = useBackgroundBulkAction()
  const bulkSelectionBusy = selectionIsBusy(selectedMockIds)

  const openLifecycleEntity = useCallback((entityType: UcatLifecycleEntityType, entityId: string) => {
    if (entityType === 'mock') {
      setEditingMockId(entityId)
      return true
    }
    if (entityType === 'set') {
      setEditingSetId(entityId)
      return true
    }
    return false
  }, [])

  const changeMockStatus = useCallback((
    mockId: string,
    status: UcatContentStatus,
    previousStatus: UcatContentStatus,
    title: string,
  ) => {
    void (async () => {
      try {
        await setStatus.mutateAsync({ mockId, status })
        toast(lifecycleStatusSuccessToast({
          contentLabel: 'Mock',
          count: 1,
          status,
          onUndo: () => {
            void ucatMocksApi.bulkRestoreStatus([mockId], status, previousStatus)
              .then(async () => {
                await queryClient.invalidateQueries({ queryKey: ucatKeys.mocks() })
                await queryClient.invalidateQueries({ queryKey: ucatKeys.mock(mockId) })
                toast({ title: 'Mock status restored' })
              })
              .catch((error) => toast(lifecycleErrorToast(error, 'Could not undo status change', router.push, openLifecycleEntity)))
          },
        }))
      } catch (error) {
        toast(lifecycleErrorToast(error, title, router.push, openLifecycleEntity))
      }
    })()
  }, [openLifecycleEntity, queryClient, router, setStatus, toast])

  const openMockPdfExport = useCallback(async (row: MockRow) => {
    try {
      const detail = await ucatMocksApi.detail(row.id)
      if (!detail) throw new Error('Mock not found')
      const sets = (detail.sets as Array<{ id: string }> | null) ?? []
      setPdfExportSource({
        kind: 'mock',
        title: row.name || 'Untitled mock',
        setIds: sets.map((set) => set.id),
      })
    } catch (error) {
      toast({
        title: 'Could not prepare export',
        description: error instanceof Error ? error.message : 'Failed to load this mock.',
        variant: 'destructive',
      })
    }
  }, [toast])

  const actionsColumn: ColumnDef<MockRow> = useMemo(
    () => ({
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="flex justify-end" onClick={(event) => event.stopPropagation()}>
          <UcatRowActions
            actions={[
              { label: 'Edit', icon: <Pencil className="h-4 w-4" />, onClick: () => setEditingMockId(row.original.id) },
              ...(!showDeleted
                ? [buildUcatPdfExportAction(() => void openMockPdfExport(row.original))]
                : []),
              ...(!showDeleted && row.original.status === 'draft'
                ? [{ label: 'Send for review', icon: <Send className="h-4 w-4" />, onClick: () => changeMockStatus(row.original.id, 'in_review', row.original.status, 'Cannot send for review') }]
                : []),
              ...(!showDeleted && row.original.status === 'in_review'
                ? [
                    { label: 'Publish', icon: <CheckCircle2 className="h-4 w-4" />, onClick: () => changeMockStatus(row.original.id, 'published', row.original.status, 'Cannot publish') },
                    { label: 'Return to draft', icon: <FilePenLine className="h-4 w-4" />, onClick: () => changeMockStatus(row.original.id, 'draft', row.original.status, 'Cannot return to draft') },
                  ]
                : []),
              ...(!showDeleted && row.original.status === 'published'
                ? [
                    { label: 'Move to review', icon: <ListChecks className="h-4 w-4" />, onClick: () => changeMockStatus(row.original.id, 'in_review', row.original.status, 'Cannot move mock') },
                    { label: 'Move to draft', icon: <FilePenLine className="h-4 w-4" />, onClick: () => changeMockStatus(row.original.id, 'draft', row.original.status, 'Cannot move mock') },
                  ]
                : []),
              ...(showDeleted
                ? [{ label: 'Restore', icon: <RotateCcw className="h-4 w-4" />, onClick: () => restoreMock.mutate(row.original.id) }]
                : [{ label: 'Delete', icon: <Trash2 className="h-4 w-4" />, onClick: () => setDeletingMockId(row.original.id), destructive: true }]),
            ]}
          />
        </div>
      ),
    }),
    [changeMockStatus, openMockPdfExport, showDeleted, restoreMock],
  )

  const tableColumns = useMemo(() => {
    if (tableState.state.visibleColumns.includes('actions')) {
      return [...visibleColumns, actionsColumn]
    }
    return visibleColumns
  }, [visibleColumns, tableState.state.visibleColumns, actionsColumn])

  const selectColumn: ColumnDef<MockRow> = {
    id: 'select',
    header: () => (
      <Checkbox
        checked={allVisibleSelected ? true : someVisibleSelected ? 'indeterminate' : false}
        onCheckedChange={toggleSelectAllVisible}
        aria-label="Select all visible rows"
      />
    ),
    cell: ({ row }) => (
      <div onClick={(event) => event.stopPropagation()}>
        <Checkbox
          checked={selectedMockIds.has(row.original.id)}
          onCheckedChange={() => toggleMockSelection(row.original.id)}
          aria-label={`Select mock ${row.original.id}`}
        />
      </div>
    ),
  }

  function handleBulkVisibilityConfirm() {
    if (bulkVisibilityPrivate == null) return
    const ids = Array.from(selectedMockIds)
    const accessScope = bulkVisibilityPrivate ? 'private' : 'public'
    startBackgroundBulk({
      ids,
      toastId: nextBulkActionToastId('visibility'),
      progress: bulkUpdateProgressToast(ids.length, 'mock', 'visibility'),
      begin: () => {
        setBulkVisibilityOpen(false)
        setBulkVisibilityPrivate(null)
        clearSelection()
      },
      run: async () => {
        for (const mockId of ids) {
          const detail = await ucatMocksApi.detail(mockId)
          if (!detail) continue
          const setIds = (detail.sets as Array<{ id: string }> | null)?.map((set) => set.id) ?? []
          await updateMockMutation.mutateAsync({
            mockId,
            payload: {
              name: detail.name ?? 'Untitled',
              accessScope,
              setIds,
            },
          })
        }
      },
      onSuccess: () => ({ title: ids.length === 1 ? 'Visibility updated' : `Visibility updated for ${ids.length} mocks` }),
      onError: (error) => lifecycleErrorToast(error, 'Could not update visibility', router.push, openLifecycleEntity),
    })
  }

  async function invalidateMocksListQueries(mockIds: string[] = []) {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ucatKeys.mocks() }),
      queryClient.invalidateQueries({ queryKey: ucatKeys.sets() }),
      ...mockIds.map((mockId) => queryClient.invalidateQueries({ queryKey: ucatKeys.mock(mockId) })),
    ])
  }

  function handleBulkStatusConfirm() {
    if (!bulkStatus) return
    const ids = Array.from(selectedMockIds)
    const nextStatus = bulkStatus
    startBackgroundBulk({
      ids,
      toastId: nextBulkActionToastId('status'),
      progress: bulkStatusProgressToast(ids.length, 'mock', nextStatus),
      begin: () => {
        setBulkStatusOpen(false)
        setBulkStatus(null)
        clearSelection()
      },
      run: async () => {
        const result = await ucatMocksApi.bulkSetStatus(ids, nextStatus)
        await invalidateMocksListQueries(ids)
        return result
      },
      onSuccess: (result) => {
        const toasts: BackgroundBulkToast[] = []
        if (result.movedIds.length > 0) {
          toasts.push(lifecycleStatusSuccessToast({
            contentLabel: 'Mock',
            count: result.movedIds.length,
            status: nextStatus,
            onUndo: () => {
              void ucatMocksApi.bulkRestoreStatus(result.movedIds, nextStatus, activeStatus)
                .then(async () => {
                  await invalidateMocksListQueries(result.movedIds)
                  toast({ title: result.movedIds.length === 1 ? 'Mock status restored' : 'Mock statuses restored' })
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
            count === 1 ? '1 mock could not be moved' : `${count} mocks could not be moved`,
            router.push,
            openLifecycleEntity,
          ))
        }
        return toasts
      },
      onError: (error) => lifecycleErrorToast(error, 'Cannot move selected mocks', router.push, openLifecycleEntity),
    })
  }

  function mockDeleteSuccessToast(mockIds: string[]) {
    const count = mockIds.length
    return {
      title: count === 1 ? 'Mock deleted' : `${count} mocks deleted`,
      description: 'Tap Undo to restore.',
      duration: 10_000,
      action: {
        label: 'Undo',
        onClick: () => {
          void (async () => {
            try {
              await Promise.all(mockIds.map((id) => restoreMock.mutateAsync(id)))
              await invalidateMocksListQueries(mockIds)
              toast({
                title: count === 1 ? 'Mock restored' : `${count} mocks restored`,
              })
            } catch (err) {
              toast({
                title: 'Could not undo',
                description: err instanceof Error ? err.message : 'Failed to restore mocks.',
                variant: 'destructive' as const,
              })
            }
          })()
        },
      },
    }
  }

  async function deleteMocks(mockIds: string[]) {
    if (mockIds.length === 1) {
      await deleteMock.mutateAsync(mockIds[0])
    } else {
      await ucatMocksApi.bulkRemove(mockIds)
    }
    await invalidateMocksListQueries(mockIds)
  }

  async function deleteMocksWithToast(mockIds: string[]) {
    await deleteMocks(mockIds)
    toast(mockDeleteSuccessToast(mockIds))
  }

  function handleBulkDeleteConfirm() {
    const ids = Array.from(selectedMockIds)
    const started = startBackgroundBulk({
      ids,
      toastId: nextBulkActionToastId('delete'),
      progress: bulkDeleteProgressToast(ids.length, 'mock'),
      begin: () => {
        setBulkDeleteOpen(false)
        clearSelection()
      },
      run: () => deleteMocks(ids),
      onSuccess: () => mockDeleteSuccessToast(ids),
      onError: (error) => lifecycleErrorToast(error, 'Cannot delete', router.push, openLifecycleEntity),
    })
    if (!started) throw new Error('already in progress')
  }

  async function onCreate() {
    const result = await createMock.mutateAsync({
      name,
      accessScope: isPrivate ? 'private' : 'public',
      setIds: [],
      instructionsText: instructionsText ?? undefined,
    })
    const mockName = name.trim() || 'Untitled'
    setOpenCreate(false)
    setName('')
    setIsPrivate(false)
    setInstructionsText(null)
    if (result.id) setEditingMockId(result.id)
    toast({
      title: `Mock ${mockName} created`,
      description: (
        <button
          type="button"
          onClick={() => setEditingMockId(result.id)}
          className="underline font-medium hover:no-underline text-left"
        >
          View mock
        </button>
      ),
    })
  }

  function closeCreateDialog() {
    setOpenCreate(false)
    setName('')
    setIsPrivate(false)
    setInstructionsText(null)
  }

  if (access.isLoading || mocks.isLoading) return <UcatPageSkeleton rows={8} />
  if (!access.data) return <UcatAccessDenied />

  return (
    <div className="space-y-6 py-8 md:py-10">
      <UcatPageHeader
        title="UCAT Mocks"
        description="Draft, review, and publish full mock exams"
        backHref="/ucat"
        breadcrumbs={[{ label: 'UCAT', href: '/ucat' }, { label: 'Mocks' }]}
        actions={
          <Button className={tutorBtnPrimary} onClick={() => setOpenCreate(true)}>
            Add Mock
          </Button>
        }
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
        searchPlaceholder="Search mocks"
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
          columns={[selectColumn, ...tableColumns]}
          data={paginatedRows}
          pagination="external"
          pageSizeOptions={[10, 20, 50]}
          getRowClassName={(row) => cn(row.deleted_at ? 'bg-destructive/10' : '', selectedMockIds.has(row.id) && 'bg-muted/50')}
          onRowClick={selectionMode ? (row) => toggleMockSelection(row.id) : undefined}
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
        selectedCount={selectedMockIds.size}
        onCancel={clearSelection}
        onDelete={() => setBulkDeleteOpen(true)}
        deletePending={bulkSelectionBusy}
      >
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className={tutorBtnOutline} disabled={bulkSelectionBusy}>
              Visibility
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="top">
            <DropdownMenuItem onClick={() => { setBulkVisibilityPrivate(false); setBulkVisibilityOpen(true) }}>
              Public
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => { setBulkVisibilityPrivate(true); setBulkVisibilityOpen(true) }}>
              Private
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
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
            <AlertDialogTitle>Set visibility for {selectedMockIds.size} mock(s)?</AlertDialogTitle>
            <AlertDialogDescription>
              Visibility will be set to {bulkVisibilityPrivate ? 'Private' : 'Public'} for all selected mocks.
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
            <AlertDialogTitle>Move {selectedMockIds.size} mock(s) to {bulkStatus?.replace('_', ' ')}?</AlertDialogTitle>
            <AlertDialogDescription>
              Eligible mocks will move. Any blocked mocks will remain in their current status.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => handleBulkStatusConfirm()}>
              Move mocks
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <UcatDeleteConfirmDialog
        open={bulkDeleteOpen}
        onOpenChange={(open) => !open && setBulkDeleteOpen(false)}
        title={`Delete ${selectedMockIds.size} mock(s)?`}
        description="The selected mocks will be hidden from students. You can restore them later from the deleted list."
        onConfirm={handleBulkDeleteConfirm}
      />

      <UcatDialogShell
        open={openCreate}
        onClose={closeCreateDialog}
        title="Create Mock"
        subtitle="Create a new UCAT mock"
        onSave={onCreate}
        saveLabel="Create"
        saveDisabled={createMock.isPending}
        isSaving={createMock.isPending}
      >
        <div className="p-6 overflow-y-auto h-full space-y-4">
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Name</span>
            <Input value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Visibility</span>
            <SearchableSelect<{ value: 'public' | 'private'; label: string }>
              items={[
                { value: 'public', label: 'Public' },
                { value: 'private', label: 'Private' },
              ]}
              value={isPrivate ? { value: 'private', label: 'Private' } : { value: 'public', label: 'Public' }}
              onValueChange={(item) => setIsPrivate(item?.value === 'private')}
              getItemLabel={(item) => item.label}
              getItemId={(item) => item.value}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Instructions</span>
            <p className="mb-1 text-muted-foreground text-xs">
              Shown to students at the start of the mock before set instructions.
            </p>
            <div className="rounded-md border border-input bg-background overflow-hidden focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 ring-offset-background">
              <UcatRichTextEditor
                value={instructionsText}
                onChange={(value) => setInstructionsText(value)}
                placeholder="Optional mock instructions..."
                minHeight="120px"
              />
            </div>
          </label>
        </div>
      </UcatDialogShell>

      <UcatMockEditorDialog
        open={!!editingMockId}
        mockId={editingMockId}
        onClose={() => setEditingMockId(null)}
        onEditSet={(setId) => setEditingSetId(setId)}
        onDelete={
          editingMockId
            ? () => {
                setDeletingMockId(editingMockId)
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
      <UcatSetEditorDialog open={!!editingSetId} setId={editingSetId} onClose={() => setEditingSetId(null)} />
      <UcatDeleteConfirmDialog
        open={!!deletingMockId}
        onOpenChange={(open) => !open && setDeletingMockId(null)}
        title="Delete mock?"
        description="The mock will be hidden from students. You can restore it later from the deleted list."
        onConfirm={async () => {
          if (!deletingMockId) return
          setSingleDeletePending(true)
          try {
            await deleteMocksWithToast([deletingMockId])
            setEditingMockId((prev) => (prev === deletingMockId ? null : prev))
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
