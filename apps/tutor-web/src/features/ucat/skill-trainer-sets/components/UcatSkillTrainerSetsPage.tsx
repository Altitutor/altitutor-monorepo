'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { DataTableColumnDefinition, DataTableFilterDefinition, DataTableSortOption } from '@altitutor/shared'
import {
  Button,
  DataTable,
  DataTableToolbar,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  TablePagination,
  useToast,
} from '@altitutor/ui'
import { Pencil, Trash2 } from 'lucide-react'
import { UcatAccessDenied, UcatPageHeader, UcatPageSkeleton } from '@/features/ucat/shared/components'
import { useUcatAccess } from '@/features/ucat/shared/hooks/useUcatAccess'
import { UcatDialogShell } from '@/features/ucat/shared/dialog-shell'
import { UcatDeleteConfirmDialog } from '@/features/ucat/shared/delete-confirm-dialog'
import { UcatRowActions } from '@/features/ucat/shared/row-actions'
import {
  useDeleteUcatSkillTrainerSet,
  useUcatSkillTrainerSets,
  useUcatSkillTrainers,
  useUpsertUcatSkillTrainerSet,
} from '@/features/ucat/skill-trainer-sets/hooks/useUcatSkillTrainerSets'
import {
  useUcatSkillTrainerSetsTable,
  type SkillTrainerSetTableRow,
} from '@/features/ucat/skill-trainer-sets/hooks/useUcatSkillTrainerSetsTable'
import { tutorBtnPrimary, tutorDataTableProps } from '@/shared/lib/tutor-visual'

const columnDefinitions: DataTableColumnDefinition[] = [
  { key: 'name', label: 'Name', visibleByDefault: true },
  { key: 'trainer_name', label: 'Trainer', visibleByDefault: true },
  { key: 'item_count', label: 'Items', visibleByDefault: true },
  { key: 'visibility', label: 'Visibility', visibleByDefault: true },
  { key: 'updated_at', label: 'Updated', visibleByDefault: true },
  { key: 'actions', label: 'Actions', visibleByDefault: true },
]

const sortOptions: DataTableSortOption[] = [
  { key: 'name', label: 'Name' },
  { key: 'trainer_name', label: 'Trainer' },
  { key: 'item_count', label: 'Items' },
  { key: 'visibility', label: 'Visibility' },
  { key: 'updated_at', label: 'Updated' },
]

export function UcatSkillTrainerSetsPage() {
  const router = useRouter()
  const { toast } = useToast()
  const access = useUcatAccess()
  const setsQuery = useUcatSkillTrainerSets()
  const trainersQuery = useUcatSkillTrainers()
  const upsert = useUpsertUcatSkillTrainerSet()
  const deleteSet = useDeleteUcatSkillTrainerSet()

  const [createOpen, setCreateOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [newTrainerId, setNewTrainerId] = useState('')
  const [deletingSetId, setDeletingSetId] = useState<string | null>(null)

  const { rows, visibleColumns, tableState } = useUcatSkillTrainerSetsTable({
    data: setsQuery.data,
    initialVisibleColumns: columnDefinitions.filter((c) => c.visibleByDefault).map((c) => c.key),
  })

  const filterDefinitions = useMemo((): DataTableFilterDefinition[] => {
    const trainers = trainersQuery.data ?? []
    return [
      {
        key: 'trainer_key',
        label: 'Trainer',
        options: [
          { label: 'All trainers', value: 'all' },
          ...trainers
            .filter((t) => t.key)
            .map((t) => ({ label: t.name ?? t.key ?? 'Trainer', value: t.key as string })),
        ],
      },
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
  }, [trainersQuery.data])

  const { page, pageSize } = tableState.state
  const totalRows = rows.length
  const pageCount = Math.max(1, Math.ceil(totalRows / pageSize))
  const effectivePage = Math.min(page, pageCount)
  const paginatedRows = rows.slice((effectivePage - 1) * pageSize, effectivePage * pageSize)

  const handleCreate = async () => {
    if (!newName.trim() || !newTrainerId) return
    try {
      const id = await upsert.mutateAsync({
        skillTrainerId: newTrainerId,
        name: newName.trim(),
      })
      setCreateOpen(false)
      setNewName('')
      router.push(`/ucat/skill-trainer-sets/${id}`)
    } catch (e) {
      toast({ title: 'Failed to create set', description: String(e), variant: 'destructive' })
    }
  }

  if (access.isLoading || setsQuery.isLoading) return <UcatPageSkeleton rows={8} />
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
            onClick={() => {
              setCreateOpen(true)
              if (trainersQuery.data?.[0]?.id) setNewTrainerId(trainersQuery.data[0].id)
            }}
          >
            New set
          </Button>
        }
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
        searchPlaceholder="Search skill trainer sets"
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
                          onClick: () => router.push(`/ucat/skill-trainer-sets/${r.id}`),
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
        title="New skill trainer set"
        subtitle="Pick a trainer type, then add items on the detail page."
        onSave={handleCreate}
        saveDisabled={!newName.trim() || !newTrainerId || upsert.isPending}
        isSaving={upsert.isPending}
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Trainer</Label>
            <Select value={newTrainerId} onValueChange={setNewTrainerId}>
              <SelectTrigger>
                <SelectValue placeholder="Select trainer" />
              </SelectTrigger>
              <SelectContent>
                {(trainersQuery.data ?? []).map((t) => (
                  <SelectItem key={t.id} value={t.id ?? ''}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Name</Label>
            <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Set name" />
          </div>
        </div>
      </UcatDialogShell>

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
