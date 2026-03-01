'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
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
  TablePagination,
  useToast,
} from '@altitutor/ui'
import { Pencil, RotateCcw, Trash2 } from 'lucide-react'
import { useCreateUcatMock, useDeleteUcatMock, useRestoreUcatMock, useUcatMocks, useUpdateUcatMock } from '@/features/ucat/mocks/hooks/useUcatMocks'
import { UcatAccessDenied, UcatPageHeader, UcatPageSkeleton } from '@/features/ucat/shared/components'
import { useUcatAccess } from '@/features/ucat/shared/hooks/useUcatAccess'
import { applyBooleanTextFilter, applySort, useUcatTableState, useVisibleColumns } from '@/features/ucat/shared/hooks/useUcatTableState'
import { UcatRowActions } from '@/features/ucat/shared/row-actions'
import { UcatMockEditorDialog } from '@/features/ucat/mocks/components/UcatMockEditorDialog'
import { UcatSetEditorDialog } from '@/features/ucat/sets/components/UcatSetEditorDialog'
import { UcatDeleteConfirmDialog } from '@/features/ucat/shared/delete-confirm-dialog'
import { UcatDialogShell } from '@/features/ucat/shared/dialog-shell'
import { UcatSelectionToolbar } from '@/features/ucat/shared/selection-toolbar'
import { ucatMocksApi } from '@/features/ucat/mocks/api/mocks'
import { ucatKeys } from '@/features/ucat/shared/lib/query-keys'
import { cn } from '@/shared/utils'

type MockRow = {
  id: string
  name: string
  is_private: boolean
  set_count: number
  updated_at: string | null
  deleted_at: string | null
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
  { key: 'visibility', label: 'Visibility', visibleByDefault: true },
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
  const access = useUcatAccess()
  const mocks = useUcatMocks()
  const createMock = useCreateUcatMock()
  const deleteMock = useDeleteUcatMock()
  const restoreMock = useRestoreUcatMock()
  const [showDeleted, setShowDeleted] = useState(false)
  const tableState = useUcatTableState(columnDefinitions.filter((c) => c.visibleByDefault).map((c) => c.key))

  const [openCreate, setOpenCreate] = useState(false)
  const [editingMockId, setEditingMockId] = useState<string | null>(null)
  const [editingSetId, setEditingSetId] = useState<string | null>(null)
  const [deletingMockId, setDeletingMockId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [isPrivate, setIsPrivate] = useState(false)
  const [selectedMockIds, setSelectedMockIds] = useState<Set<string>>(new Set())
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [bulkVisibilityOpen, setBulkVisibilityOpen] = useState(false)
  const [bulkVisibilityPrivate, setBulkVisibilityPrivate] = useState<boolean | null>(null)
  const [bulkDeletePending, setBulkDeletePending] = useState(false)
  const selectionMode = selectedMockIds.size > 0
  const queryClient = useQueryClient()
  const updateMockMutation = useUpdateUcatMock()

  useEffect(() => {
    const editId = searchParams.get('edit')
    if (editId) setEditingMockId(editId)
  }, [searchParams])

  const rows: MockRow[] = (mocks.data ?? []).map((m) => {
    const row = m as typeof m & { set_count?: number; deleted_at?: string | null }
    return {
      id: m.id ?? '',
      name: m.name ?? 'Untitled',
      is_private: !!m.is_private,
      set_count: row.set_count ?? 0,
      updated_at: m.updated_at,
      deleted_at: row.deleted_at ?? null,
    }
  })

  const filteredRows = useMemo(() => {
    const byDeleted = showDeleted
      ? rows.filter((row) => row.deleted_at != null)
      : rows.filter((row) => row.deleted_at == null)
    const search = tableState.state.search.trim().toLowerCase()
    return byDeleted.filter((row) => {
      const searchHit = search.length === 0 || row.name.toLowerCase().includes(search)
      const visibilityHit = applyBooleanTextFilter(tableState.state, 'visibility', row.is_private)
      return searchHit && visibilityHit
    })
  }, [rows, tableState.state, showDeleted])

  const sortedRows = useMemo(
    () =>
      applySort(filteredRows, tableState.state.sortBy, tableState.state.sortDirection, {
        name: (r) => r.name,
        visibility: (r) => (r.is_private ? 'Private' : 'Public'),
        set_count: (r) => r.set_count,
        updated_at: (r) => r.updated_at ?? '',
      }),
    [filteredRows, tableState.state.sortBy, tableState.state.sortDirection]
  )

  const { page, pageSize } = tableState.state
  const totalRows = sortedRows.length
  const pageCount = Math.max(1, Math.ceil(totalRows / pageSize))
  const effectivePage = Math.min(page, pageCount)
  const paginatedRows = sortedRows.slice((effectivePage - 1) * pageSize, effectivePage * pageSize)

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
      <div onClick={(e) => e.stopPropagation()}>
        <Checkbox
          checked={selectedMockIds.has(row.original.id)}
          onCheckedChange={() => toggleMockSelection(row.original.id)}
          aria-label={`Select mock ${row.original.id}`}
        />
      </div>
    ),
  }

  const allColumns: Array<{ key: string; column: ColumnDef<MockRow> }> = [
    { key: 'name', column: { accessorKey: 'name', header: 'Name' } },
    {
      key: 'visibility',
      column: {
        accessorKey: 'is_private',
        header: 'Visibility',
        cell: ({ row }) => (row.original.is_private ? 'Private' : 'Public'),
      },
    },
    {
      key: 'set_count',
      column: {
        accessorKey: 'set_count',
        header: 'Sets',
        cell: ({ row }) => String(row.original.set_count),
      },
    },
    {
      key: 'updated_at',
      column: {
        accessorKey: 'updated_at',
        header: 'Updated',
        cell: ({ row }) => (row.original.updated_at ? new Date(row.original.updated_at).toLocaleString() : '-'),
      },
    },
    {
      key: 'actions',
      column: {
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
            <UcatRowActions
              actions={[
                { label: 'Edit', icon: <Pencil className="h-4 w-4" />, onClick: () => setEditingMockId(row.original.id) },
                ...(showDeleted
                  ? [{ label: 'Restore', icon: <RotateCcw className="h-4 w-4" />, onClick: () => restoreMock.mutate(row.original.id) }]
                  : [{ label: 'Delete', icon: <Trash2 className="h-4 w-4" />, onClick: () => setDeletingMockId(row.original.id), destructive: true }]),
              ]}
            />
          </div>
        ),
      },
    },
  ]

  const visibleColumns = useVisibleColumns(allColumns, tableState.state.visibleColumns)

  function toggleMockSelection(id: string) {
    setSelectedMockIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const allVisibleSelected = paginatedRows.length > 0 && paginatedRows.every((r) => selectedMockIds.has(r.id))
  const someVisibleSelected = paginatedRows.some((r) => selectedMockIds.has(r.id))
  function toggleSelectAllVisible() {
    if (allVisibleSelected) {
      setSelectedMockIds((prev) => {
        const next = new Set(prev)
        paginatedRows.forEach((r) => next.delete(r.id))
        return next
      })
    } else {
      setSelectedMockIds((prev) => new Set([...prev, ...paginatedRows.map((r) => r.id)]))
    }
  }

  async function handleBulkVisibilityConfirm() {
    if (bulkVisibilityPrivate == null) return
    const ids = Array.from(selectedMockIds)
    for (const mockId of ids) {
      const detail = await ucatMocksApi.detail(mockId)
      if (!detail) continue
      const setIds = (detail.sets as Array<{ id: string }> | null)?.map((s) => s.id) ?? []
      await updateMockMutation.mutateAsync({
        mockId,
        payload: {
          name: detail.name ?? 'Untitled',
          isPrivate: bulkVisibilityPrivate,
          setIds,
        },
      })
    }
    setBulkVisibilityOpen(false)
    setBulkVisibilityPrivate(null)
    setSelectedMockIds(new Set())
  }

  const { toast } = useToast()
  async function handleBulkDeleteConfirm() {
    const ids = Array.from(selectedMockIds)
    setBulkDeletePending(true)
    try {
      await ucatMocksApi.bulkRemove(ids)
      await queryClient.invalidateQueries({ queryKey: ucatKeys.mocks() })
      setBulkDeleteOpen(false)
      setSelectedMockIds(new Set())
    } catch (err) {
      toast({
        title: 'Cannot delete',
        description: err instanceof Error ? err.message : 'Failed to delete mocks.',
        variant: 'destructive',
      })
    } finally {
      setBulkDeletePending(false)
    }
  }

  async function onCreate() {
    const result = await createMock.mutateAsync({ name, isPrivate, setIds: [] })
    setOpenCreate(false)
    setName('')
    setIsPrivate(false)
    if (result.id) setEditingMockId(result.id)
  }

  if (access.isLoading || mocks.isLoading) return <UcatPageSkeleton rows={8} />
  if (!access.data) return <UcatAccessDenied />

  return (
    <div className="p-6">
      <UcatPageHeader
        title="UCAT Mocks"
        description="Manage full mock exams (ordered sets)"
        backHref="/ucat"
        breadcrumbs={[{ label: 'UCAT', href: '/ucat' }, { label: 'Mocks' }]}
        actions={<Button onClick={() => setOpenCreate(true)}>Add Mock</Button>}
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
        searchPlaceholder="Search mocks"
        filterFooter={
          <div className="px-2 py-2 border-t">
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-center"
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
          columns={[selectColumn, ...visibleColumns]}
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
        onCancel={() => setSelectedMockIds(new Set())}
        onDelete={() => setBulkDeleteOpen(true)}
        deletePending={bulkDeletePending}
      >
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
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
            <AlertDialogAction onClick={() => void handleBulkVisibilityConfirm()}>
              Yes
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
        isPending={bulkDeletePending}
      />

      <UcatDialogShell
        open={openCreate}
        onClose={() => setOpenCreate(false)}
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
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="inline-flex items-center gap-2 text-sm">
            <Checkbox checked={isPrivate} onCheckedChange={(checked) => setIsPrivate(checked === true)} />
            Private mock
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
      <UcatSetEditorDialog open={!!editingSetId} setId={editingSetId} onClose={() => setEditingSetId(null)} />
      <UcatDeleteConfirmDialog
        open={!!deletingMockId}
        onOpenChange={(open) => !open && setDeletingMockId(null)}
        title="Delete mock?"
        description="The mock will be hidden from students. You can restore it later from the deleted list."
        onConfirm={async () => {
          if (deletingMockId) {
            await deleteMock.mutateAsync(deletingMockId)
            setEditingMockId((prev) => (prev === deletingMockId ? null : prev))
          }
        }}
        isPending={deleteMock.isPending}
      />
    </div>
  )
}
