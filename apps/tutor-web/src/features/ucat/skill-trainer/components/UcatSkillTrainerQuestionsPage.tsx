'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import type { DataTableColumnDefinition, DataTableFilterDefinition, DataTableSortOption } from '@altitutor/shared'
import {
  UCAT_SKILL_TRAINER_KEYS,
  trainerKeyToSlug,
  trainerSlugToKey,
  type UcatSkillTrainerKey,
} from '@altitutor/shared'
import {
  Button,
  DataTable,
  DataTableToolbar,
  TablePagination,
  useToast,
} from '@altitutor/ui'
import { Pencil } from 'lucide-react'
import { UcatAccessDenied, UcatPageHeader, UcatPageSkeleton } from '@/features/ucat/shared/components'
import { useUcatAccess } from '@/features/ucat/shared/hooks/useUcatAccess'
import { UcatRowActions } from '@/features/ucat/shared/row-actions'
import { UcatSkillTrainerItemDialog } from '@/features/ucat/skill-trainer/components/UcatSkillTrainerItemDialog'
import {
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
import { tutorBtnPrimary, tutorDataTableProps } from '@/shared/lib/tutor-visual'
import { SegmentedControl } from '@/shared/components/segmented-control'

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

  const [createOpen, setCreateOpen] = useState(false)
  const [editingItemId, setEditingItemId] = useState<string | null>(null)

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
  useEffect(() => {
    if (previousTabRef.current === activeTab) return
    previousTabRef.current = activeTab
    tableState.actions.onReset()
  }, [activeTab, tableState.actions])

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
  }) => {
    const id = await upsert.mutateAsync(payload)
    toast({ title: 'Saved', description: 'Skill trainer item saved.' })
    setCreateOpen(false)
    setEditingItemId(id)
    await itemsQuery.refetch()
    return id
  }

  const handleApproval = async (status: 'approved' | 'pending' | 'rejected') => {
    if (!editingItemId) return
    await setApproval.mutateAsync({ itemId: editingItemId, approvalStatus: status })
    toast({ title: 'Approval updated', description: `Item marked as ${status}.` })
    await editingItem.refetch()
    await itemsQuery.refetch()
  }

  if (access.isLoading || trainersQuery.isLoading) return <UcatPageSkeleton rows={8} />
  if (!access.data) return <UcatAccessDenied />

  return (
    <div className="space-y-6 py-8 md:py-10">
      <UcatPageHeader
        title="Skill trainer questions"
        description="Author drill content for each UCAT skill trainer type."
        backHref="/ucat"
        breadcrumbs={[{ label: 'UCAT', href: '/ucat' }, { label: 'Skill trainer questions' }]}
        actions={
          <Button type="button" className={tutorBtnPrimary} onClick={() => setCreateOpen(true)}>
            Add question
          </Button>
        }
      />

      <SegmentedControl
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
        searchPlaceholder={`Search ${activeTrainerName} questions`}
      />

      <div className="pt-3">
        <DataTable
          {...tutorDataTableProps}
          columns={[
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
        onApprovalChange={handleApproval}
        trainers={trainers}
        trainerKey={activeTab}
        initial={editingItem.data ?? null}
        loading={upsert.isPending || editingItem.isLoading}
      />
    </div>
  )
}
