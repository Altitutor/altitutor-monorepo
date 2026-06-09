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
  Input,
  Label,
  TablePagination,
  useToast,
} from '@altitutor/ui'
import { Pencil, Trash2 } from 'lucide-react'
import { UcatAccessDenied, UcatPageHeader, UcatPageSkeleton } from '@/features/ucat/shared/components'
import { useUcatAccess } from '@/features/ucat/shared/hooks/useUcatAccess'
import { UcatDialogShell } from '@/features/ucat/shared/dialog-shell'
import { UcatDeleteConfirmDialog } from '@/features/ucat/shared/delete-confirm-dialog'
import { UcatRowActions } from '@/features/ucat/shared/row-actions'
import { useUcatSkillTrainersCatalog } from '@/features/ucat/skill-trainer/hooks/useUcatSkillTrainerItems'
import {
  useDeleteUcatSkillTrainerSet,
  useUcatSkillTrainerSets,
  useUpsertUcatSkillTrainerSet,
} from '@/features/ucat/skill-trainer-sets/hooks/useUcatSkillTrainerSets'
import {
  useUcatSkillTrainerSetsTable,
  type SkillTrainerSetTableRow,
} from '@/features/ucat/skill-trainer-sets/hooks/useUcatSkillTrainerSetsTable'
import { UcatSkillTrainerSetDialog } from '@/features/ucat/skill-trainer-sets/components/UcatSkillTrainerSetDialog'
import { tutorBtnPrimary, tutorDataTableProps } from '@/shared/lib/tutor-visual'
import { SegmentedControl } from '@/shared/components/segmented-control'

const columnDefinitions: DataTableColumnDefinition[] = [
  { key: 'name', label: 'Name', visibleByDefault: true },
  { key: 'item_count', label: 'Items', visibleByDefault: true },
  { key: 'visibility', label: 'Visibility', visibleByDefault: true },
  { key: 'updated_at', label: 'Updated', visibleByDefault: true },
  { key: 'actions', label: 'Actions', visibleByDefault: true },
]

const sortOptions: DataTableSortOption[] = [
  { key: 'name', label: 'Name' },
  { key: 'item_count', label: 'Items' },
  { key: 'visibility', label: 'Visibility' },
  { key: 'updated_at', label: 'Updated' },
]

function parseTrainerTab(value: string | null, trainers: Array<{ key: string | null }>): UcatSkillTrainerKey {
  const fromSlug = value ? trainerSlugToKey(value) : null
  if (fromSlug) return fromSlug
  const first = trainers.find((t) => t.key)?.key
  return (first as UcatSkillTrainerKey | undefined) ?? UCAT_SKILL_TRAINER_KEYS[0]
}

export function UcatSkillTrainerSetsPage() {
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
      params.set('tab', trainerKeyToSlug(key))
      router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    },
    [pathname, router, searchParams],
  )

  const setsQuery = useUcatSkillTrainerSets({ trainerKey: activeTab })
  const upsert = useUpsertUcatSkillTrainerSet()
  const deleteSet = useDeleteUcatSkillTrainerSet()

  const [createOpen, setCreateOpen] = useState(false)
  const [editingSetId, setEditingSetId] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const [deletingSetId, setDeletingSetId] = useState<string | null>(null)

  const handleOpenSet = useCallback((setId: string) => {
    setEditingSetId(setId)
  }, [])

  const { rows, visibleColumns, tableState } = useUcatSkillTrainerSetsTable({
    data: setsQuery.data,
    initialVisibleColumns: columnDefinitions.filter((c) => c.visibleByDefault).map((c) => c.key),
    onOpenSet: handleOpenSet,
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
        key: 'visibility',
        label: 'Visibility',
        options: [
          { label: 'Public', value: 'public' },
          { label: 'Private', value: 'private' },
        ],
      },
      {
        key: 'item_count',
        label: 'Items',
        type: 'number-range',
        minKey: 'item_count_min',
        maxKey: 'item_count_max',
      },
    ]
  }, [])

  const { page, pageSize } = tableState.state
  const totalRows = rows.length
  const pageCount = Math.max(1, Math.ceil(totalRows / pageSize))
  const effectivePage = Math.min(page, pageCount)
  const paginatedRows = rows.slice((effectivePage - 1) * pageSize, effectivePage * pageSize)

  const activeTrainer = trainers.find((t) => t.key === activeTab)
  const activeTrainerName = activeTrainer?.name ?? activeTab
  const activeTrainerId = activeTrainer?.id ?? ''

  const handleCreate = async () => {
    if (!newName.trim() || !activeTrainerId) return
    try {
      const id = await upsert.mutateAsync({
        skillTrainerId: activeTrainerId,
        name: newName.trim(),
      })
      setCreateOpen(false)
      setNewName('')
      setEditingSetId(id)
    } catch (e) {
      toast({ title: 'Failed to create set', description: String(e), variant: 'destructive' })
    }
  }

  if (access.isLoading || setsQuery.isLoading || trainersQuery.isLoading) {
    return <UcatPageSkeleton rows={8} />
  }
  if (!access.data) return <UcatAccessDenied />

  return (
    <div className="space-y-6 py-8 md:py-10">
      <UcatPageHeader
        title="Skill trainer sets"
        description="Curated bundles of skill trainer items for use in lessons or drills."
        backHref="/ucat"
        breadcrumbs={[{ label: 'UCAT', href: '/ucat' }, { label: 'Skill trainer sets' }]}
        actions={
          <Button
            type="button"
            className={tutorBtnPrimary}
            onClick={() => setCreateOpen(true)}
          >
            Add skill trainer set
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
            label: trainer.name,
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
        searchPlaceholder={`Search ${activeTrainerName} sets`}
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
                const r = row.original as SkillTrainerSetTableRow
                return (
                  <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
                    <UcatRowActions
                      actions={[
                        {
                          label: 'Edit',
                          icon: <Pencil className="h-4 w-4" />,
                          onClick: () => handleOpenSet(r.id),
                        },
                        {
                          label: 'Delete',
                          icon: <Trash2 className="h-4 w-4" />,
                          onClick: () => setDeletingSetId(r.id),
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
          onRowClick={(row) => handleOpenSet((row as SkillTrainerSetTableRow).id)}
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

      <UcatDialogShell
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title={`New ${activeTrainerName} set`}
        subtitle="Name your set, then add questions in the editor."
        onSave={handleCreate}
        saveDisabled={!newName.trim() || !activeTrainerId || upsert.isPending}
        isSaving={upsert.isPending}
      >
        <div className="h-full overflow-y-auto p-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Trainer</Label>
              <Input value={activeTrainerName} disabled />
            </div>
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Set name" />
            </div>
          </div>
        </div>
      </UcatDialogShell>

      <UcatSkillTrainerSetDialog
        open={!!editingSetId}
        setId={editingSetId}
        onClose={() => setEditingSetId(null)}
      />

      <UcatDeleteConfirmDialog
        open={!!deletingSetId}
        onOpenChange={(open) => !open && setDeletingSetId(null)}
        title="Delete skill trainer set?"
        description="This set will be removed. Items in the set are not deleted."
        onConfirm={async () => {
          if (!deletingSetId) return
          try {
            await deleteSet.mutateAsync(deletingSetId)
            setDeletingSetId(null)
          } catch (e) {
            toast({ title: 'Failed to delete set', description: String(e), variant: 'destructive' })
          }
        }}
        isPending={deleteSet.isPending}
      />
    </div>
  )
}
