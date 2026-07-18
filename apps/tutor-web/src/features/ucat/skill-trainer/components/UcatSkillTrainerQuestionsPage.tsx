'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import type { ColumnDef } from '@tanstack/react-table'
import type { DataTableColumnDefinition, DataTableFilterDefinition, DataTableSortOption } from '@altitutor/shared'
import {
  UCAT_SKILL_TRAINER_KEYS,
  trainerKeyToSlug,
  trainerSlugToKey,
  type UcatSkillTrainerApprovalStatus,
  type UcatSkillTrainerKey,
} from '@altitutor/shared'
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
import { Pencil, Trash2 } from 'lucide-react'
import { UcatAccessDenied, UcatPageHeader, UcatPageSkeleton } from '@/features/ucat/shared/components'
import { useUcatAccess } from '@/features/ucat/shared/hooks/useUcatAccess'
import { UcatDeleteConfirmDialog } from '@/features/ucat/shared/delete-confirm-dialog'
import { UcatRowActions } from '@/features/ucat/shared/row-actions'
import { UcatSelectionToolbar } from '@/features/ucat/shared/selection-toolbar'
import { UcatSkillTrainerItemDialog } from '@/features/ucat/skill-trainer/components/UcatSkillTrainerItemDialog'
import {
  useBulkDeleteUcatSkillTrainerItems,
  useBulkSetUcatSkillTrainerItemApproval,
  useDeleteUcatSkillTrainerItem,
  useSetUcatSkillTrainerItemApproval,
  useUcatSkillTrainerItem,
  useUcatSkillTrainerItems,
  useUcatSkillTrainersCatalog,
  useUpsertUcatSkillTrainerItem,
} from '@/features/ucat/skill-trainer/hooks/useUcatSkillTrainerItems'
import {
  useUcatSkillTrainerItemsTable,
  type SkillTrainerItemTableRow,
} from '@/features/ucat/skill-trainer/hooks/useUcatSkillTrainerItemsTable'
import { clearUcatTableUrlParams } from '@/features/ucat/shared/lib/ucat-table-url-state'
import { cn } from '@/shared/utils'
import { tutorBtnOutline, tutorBtnPrimary, tutorDataTableProps, tutorToolbarProps } from '@/shared/lib/tutor-visual'
import { SegmentedControl } from '@/shared/components/segmented-control'

const APPROVAL_OPTIONS: Array<{ value: UcatSkillTrainerApprovalStatus; label: string }> = [
  { value: 'approved', label: 'Approved' },
  { value: 'pending', label: 'Pending' },
  { value: 'rejected', label: 'Rejected' },
]

const columnDefinitions: DataTableColumnDefinition[] = [
  { key: 'summary', label: 'Content', visibleByDefault: true },
  { key: 'approval_status', label: 'Approval', visibleByDefault: true },
  { key: 'is_active', label: 'Active', visibleByDefault: true },
  { key: 'updated_at', label: 'Updated', visibleByDefault: true },
  { key: 'actions', label: 'Actions', visibleByDefault: true },
]

const sortOptions: DataTableSortOption[] = [
  { key: 'summary', label: 'Content' },
  { key: 'approval_status', label: 'Approval' },
  { key: 'is_active', label: 'Active' },
  { key: 'updated_at', label: 'Updated' },
]

function parseTrainerTab(value: string | null, trainers: Array<{ key: string | null }>): UcatSkillTrainerKey {
  const fromSlug = value ? trainerSlugToKey(value) : null
  if (fromSlug) return fromSlug
  const first = trainers.find((t) => t.key)?.key
  return (first as UcatSkillTrainerKey | undefined) ?? UCAT_SKILL_TRAINER_KEYS[0]
}

export function UcatSkillTrainerQuestionsPage() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const access = useUcatAccess()
  const trainersQuery = useUcatSkillTrainersCatalog()
  const trainers = trainersQuery.data ?? []

  const activeTab = parseTrainerTab(searchParams.get('tab'), trainers)

  const setActiveTab = useCallback(
    (key: UcatSkillTrainerKey) => {
      const params = new URLSearchParams(searchParams.toString())
      clearUcatTableUrlParams(params)
      params.set('tab', trainerKeyToSlug(key))
      params.delete('edit')
      router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    },
    [pathname, router, searchParams]
  )

  const itemsQuery = useUcatSkillTrainerItems({ trainerKey: activeTab })
  const upsert = useUpsertUcatSkillTrainerItem()
  const setApproval = useSetUcatSkillTrainerItemApproval()
  const deleteItem = useDeleteUcatSkillTrainerItem()
  const bulkDelete = useBulkDeleteUcatSkillTrainerItems()
  const bulkSetApproval = useBulkSetUcatSkillTrainerItemApproval()

  const [createOpen, setCreateOpen] = useState(false)
  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  const [deletingItemId, setDeletingItemId] = useState<string | null>(null)
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set())
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [bulkApprovalOpen, setBulkApprovalOpen] = useState(false)
  const [bulkApprovalStatus, setBulkApprovalStatus] = useState<UcatSkillTrainerApprovalStatus | null>(null)
  const [bulkDeletePending, setBulkDeletePending] = useState(false)
  const [bulkApprovalPending, setBulkApprovalPending] = useState(false)
  const [singleDeletePending, setSingleDeletePending] = useState(false)
  const selectionMode = selectedItemIds.size > 0

  const editParam = searchParams.get('edit')
  useEffect(() => {
    if (editParam) setEditingItemId(editParam)
  }, [editParam])

  const editingItem = useUcatSkillTrainerItem(editingItemId)

  const handleOpenItem = useCallback((itemId: string) => {
    setEditingItemId(itemId)
  }, [])

  const { rows, visibleColumns, tableState } = useUcatSkillTrainerItemsTable({
    data: itemsQuery.data,
    initialVisibleColumns: columnDefinitions.filter((c) => c.visibleByDefault).map((c) => c.key),
    availableColumns: columnDefinitions.map((c) => c.key),
    onOpenItem: handleOpenItem,
  })

  const previousTabRef = useRef(activeTab)
  const tableActionsRef = useRef(tableState.actions)
  tableActionsRef.current = tableState.actions
  useEffect(() => {
    if (previousTabRef.current === activeTab) return
    previousTabRef.current = activeTab
    tableActionsRef.current.onReset()
    setSelectedItemIds(new Set())
  }, [activeTab])

  const filterDefinitions = useMemo((): DataTableFilterDefinition[] => {
    return [
      {
        key: 'approval_status',
        label: 'Approval',
        options: [
          { label: 'Approved', value: 'approved' },
          { label: 'Pending', value: 'pending' },
          { label: 'Rejected', value: 'rejected' },
        ],
      },
      {
        key: 'is_active',
        label: 'Active',
        options: [
          { label: 'Active', value: 'active' },
          { label: 'Inactive', value: 'inactive' },
        ],
      },
    ]
  }, [])

  const { page, pageSize } = tableState.state
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize))
  const effectivePage = Math.min(page, pageCount)
  const paginatedRows = rows.slice((effectivePage - 1) * pageSize, effectivePage * pageSize)

  const activeTrainerName = trainers.find((t) => t.key === activeTab)?.name ?? activeTab

  function toggleItemSelection(id: string) {
    setSelectedItemIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const allVisibleSelected = paginatedRows.length > 0 && paginatedRows.every((r) => selectedItemIds.has(r.id))
  const someVisibleSelected = paginatedRows.some((r) => selectedItemIds.has(r.id))

  function toggleSelectAllVisible() {
    if (allVisibleSelected) {
      setSelectedItemIds((prev) => {
        const next = new Set(prev)
        paginatedRows.forEach((r) => next.delete(r.id))
        return next
      })
    } else {
      setSelectedItemIds((prev) => new Set([...prev, ...paginatedRows.map((r) => r.id)]))
    }
  }

  const selectColumn: ColumnDef<SkillTrainerItemTableRow> = {
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
          checked={selectedItemIds.has(row.original.id)}
          onCheckedChange={() => toggleItemSelection(row.original.id)}
          aria-label={`Select item ${row.original.id}`}
        />
      </div>
    ),
  }

  const handleCloseDialog = () => {
    setCreateOpen(false)
    setEditingItemId(null)
    const params = new URLSearchParams(searchParams.toString())
    params.delete('edit')
    const query = params.toString()
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }

  const handleSave = async (payload: {
    itemId?: string | null
    skillTrainerId: string
    content: Record<string, unknown>
    isActive: boolean
    approvalStatus?: 'approved' | 'pending' | 'rejected'
  }) => {
    const id = await upsert.mutateAsync(payload)
    if (payload.itemId && payload.approvalStatus) {
      await setApproval.mutateAsync({ itemId: id, approvalStatus: payload.approvalStatus })
    }
    toast({ title: 'Saved', description: 'Skill trainer item saved.' })
    handleCloseDialog()
    await itemsQuery.refetch()
    return id
  }

  async function handleBulkApprovalConfirm() {
    if (!bulkApprovalStatus) return
    const ids = Array.from(selectedItemIds)
    setBulkApprovalPending(true)
    try {
      await bulkSetApproval.mutateAsync({ itemIds: ids, approvalStatus: bulkApprovalStatus })
      toast({
        title: 'Approval updated',
        description: `${ids.length} question(s) marked as ${bulkApprovalStatus}.`,
      })
      setBulkApprovalOpen(false)
      setBulkApprovalStatus(null)
      setSelectedItemIds(new Set())
      await itemsQuery.refetch()
    } catch (error) {
      toast({
        title: 'Failed to update approval',
        description: error instanceof Error ? error.message : 'Failed to update approval',
        variant: 'destructive',
      })
    } finally {
      setBulkApprovalPending(false)
    }
  }

  async function handleBulkDeleteConfirm() {
    const ids = Array.from(selectedItemIds)
    setBulkDeletePending(true)
    try {
      if (ids.length === 1) {
        await deleteItem.mutateAsync(ids[0])
      } else {
        await bulkDelete.mutateAsync(ids)
      }
      toast({
        title: ids.length === 1 ? 'Question deleted' : `${ids.length} questions deleted`,
        description: 'Deleted questions are hidden from the bank.',
      })
      setBulkDeleteOpen(false)
      setSelectedItemIds(new Set())
      await itemsQuery.refetch()
    } catch (error) {
      toast({
        title: 'Cannot delete',
        description: error instanceof Error ? error.message : 'Failed to delete questions.',
        variant: 'destructive',
      })
    } finally {
      setBulkDeletePending(false)
    }
  }

  async function handleSingleDeleteConfirm() {
    if (!deletingItemId) return
    setSingleDeletePending(true)
    try {
      await deleteItem.mutateAsync(deletingItemId)
      toast({ title: 'Question deleted', description: 'The question has been removed from the bank.' })
      setDeletingItemId(null)
      await itemsQuery.refetch()
    } catch (error) {
      toast({
        title: 'Cannot delete',
        description: error instanceof Error ? error.message : 'Failed to delete question.',
        variant: 'destructive',
      })
    } finally {
      setSingleDeletePending(false)
    }
  }

  if (access.isLoading || trainersQuery.isLoading) return <UcatPageSkeleton rows={8} />
  if (!access.data) return <UcatAccessDenied />

  return (
    <div className="space-y-6 py-8 md:py-10">
      <UcatPageHeader
        title="Skill trainer"
        description="Author drill content for each UCAT skill trainer type."
        backHref="/ucat"
        breadcrumbs={[{ label: 'UCAT', href: '/ucat' }, { label: 'Skill trainer' }]}
        actions={
          <Button type="button" className={tutorBtnPrimary} onClick={() => setCreateOpen(true)}>
            Add question
          </Button>
        }
      />

      <SegmentedControl
        fullWidth
        className="w-full min-w-0"
        value={trainerKeyToSlug(activeTab)}
        onValueChange={(v) => {
          const key = trainerSlugToKey(v)
          if (key) setActiveTab(key)
        }}
        options={trainers
          .filter((t): t is typeof t & { key: UcatSkillTrainerKey } => Boolean(t.key))
          .map((trainer) => ({
            value: trainerKeyToSlug(trainer.key),
            label: trainer.name ?? trainer.key,
          }))}
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
        searchPlaceholder={`Search ${activeTrainerName} questions`}
      />

      <div className={cn('pt-3', selectionMode && 'pb-24')}>
        <DataTable
          {...tutorDataTableProps}
          columns={[
            selectColumn,
            ...visibleColumns,
            {
              id: 'actions',
              header: 'Actions',
              cell: ({ row }) => {
                const r = row.original as SkillTrainerItemTableRow
                return (
                  <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
                    <UcatRowActions
                      actions={[
                        {
                          label: 'Edit',
                          icon: <Pencil className="h-4 w-4" />,
                          onClick: () => handleOpenItem(r.id),
                        },
                        {
                          label: 'Delete',
                          icon: <Trash2 className="h-4 w-4" />,
                          onClick: () => setDeletingItemId(r.id),
                          destructive: true,
                        },
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
          getRowClassName={(row) => cn(selectedItemIds.has(row.id) && 'bg-muted/50')}
          onRowClick={selectionMode ? (row) => toggleItemSelection(row.id) : undefined}
        />
        <TablePagination
          page={effectivePage}
          pageSize={pageSize}
          total={rows.length}
          onPageChange={tableState.actions.onPageChange}
          onPageSizeChange={tableState.actions.onPageSizeChange}
          pageSizeOptions={[10, 20, 50]}
          className="pt-3"
        />
      </div>

      <UcatSelectionToolbar
        selectedCount={selectedItemIds.size}
        onCancel={() => setSelectedItemIds(new Set())}
        onDelete={() => setBulkDeleteOpen(true)}
        deletePending={bulkDeletePending}
      >
        <SearchableSelect<{ value: UcatSkillTrainerApprovalStatus; label: string }>
          items={APPROVAL_OPTIONS}
          value={null}
          onValueChange={(item) => {
            if (item) {
              setBulkApprovalStatus(item.value)
              setBulkApprovalOpen(true)
            }
          }}
          getItemId={(item) => item.value}
          getItemLabel={(item) => item.label}
          placeholder="Approval"
          searchPlaceholder="Search approval status..."
          emptyMessage="No options"
          trigger={
            <Button variant="outline" size="sm" className={tutorBtnOutline}>
              Approval
            </Button>
          }
          contentWidth="180px"
          align="start"
          side="top"
        />
      </UcatSelectionToolbar>

      <AlertDialog open={bulkApprovalOpen} onOpenChange={setBulkApprovalOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Set approval for {selectedItemIds.size} question(s)?</AlertDialogTitle>
            <AlertDialogDescription>
              Approval will be set to {bulkApprovalStatus ?? 'the selected status'} for all selected questions.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkApprovalPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                void handleBulkApprovalConfirm()
              }}
              disabled={bulkApprovalPending}
            >
              {bulkApprovalPending ? 'Updating...' : 'Yes'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <UcatDeleteConfirmDialog
        open={bulkDeleteOpen}
        onOpenChange={(open) => !open && setBulkDeleteOpen(false)}
        title={`Delete ${selectedItemIds.size} question(s)?`}
        description="The selected questions will be removed from the bank. Questions already in sets may still appear in those sets until removed."
        onConfirm={handleBulkDeleteConfirm}
        isPending={bulkDeletePending}
      />

      <UcatDeleteConfirmDialog
        open={deletingItemId != null}
        onOpenChange={(open) => !open && setDeletingItemId(null)}
        title="Delete question?"
        description="This question will be removed from the bank."
        onConfirm={handleSingleDeleteConfirm}
        isPending={singleDeletePending}
      />

      <UcatSkillTrainerItemDialog
        open={createOpen}
        title={`New ${activeTrainerName} question`}
        submitLabel="Create"
        onClose={handleCloseDialog}
        onSubmit={handleSave}
        trainers={trainers}
        trainerKey={activeTab}
        loading={upsert.isPending}
      />

      <UcatSkillTrainerItemDialog
        open={!!editingItemId}
        title={`Edit ${activeTrainerName} question`}
        submitLabel="Save"
        onClose={handleCloseDialog}
        onSubmit={handleSave}
        trainers={trainers}
        trainerKey={activeTab}
        initial={editingItem.data ?? null}
        loading={upsert.isPending || editingItem.isLoading}
      />
    </div>
  )
}
