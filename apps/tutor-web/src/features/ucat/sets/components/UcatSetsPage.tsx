'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import type { DataTableColumnDefinition, DataTableFilterDefinition, DataTableSortOption } from '@altitutor/shared'
import {
  Badge,
  Button,
  Checkbox,
  DataTable,
  DataTableToolbar,
  Input,
  Textarea,
} from '@altitutor/ui'
import { Pencil, RotateCcw, Trash2 } from 'lucide-react'
import { useCreateUcatSet, useDeleteUcatSet, useRestoreUcatSet, useUcatSets } from '@/features/ucat/sets/hooks/useUcatSets'
import { UcatAccessDenied, UcatPageHeader, UcatPageSkeleton } from '@/features/ucat/shared/components'
import { useUcatAccess } from '@/features/ucat/shared/hooks/useUcatAccess'
import type { UcatQuestionSetPayload } from '@/features/ucat/shared/types'
import { useUcatTableState } from '@/features/ucat/shared/hooks/useUcatTableState'
import { UcatRowActions } from '@/features/ucat/shared/row-actions'
import { parseTimeToSeconds } from '@/features/ucat/shared/lib/time-utils'
import { UcatSetEditorDialog } from '@/features/ucat/sets/components/UcatSetEditorDialog'
import { UcatDeleteConfirmDialog } from '@/features/ucat/shared/delete-confirm-dialog'
import { UcatDialogShell } from '@/features/ucat/shared/dialog-shell'
import { plainTextToProseMirror } from '@/features/ucat/shared/lib/rich-text'
import { useUcatSetsTable, type SetRow } from '@/features/ucat/sets/hooks/useUcatSetsTable'

const DEFAULT_FILTERS: Record<string, unknown[]> = { is_student_generated: ['staff'] }

const filterDefinitions: DataTableFilterDefinition[] = [
  {
    key: 'is_student_generated',
    label: 'Origin',
    options: [
      { label: 'Staff', value: 'staff' },
      { label: 'Student', value: 'student' },
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
    key: 'time_limit',
    label: 'Time limit (s)',
    type: 'number-range',
    minKey: 'time_limit_min',
    maxKey: 'time_limit_max',
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

const columnDefinitions: DataTableColumnDefinition[] = [
  { key: 'name', label: 'Name', visibleByDefault: true },
  { key: 'time_limit_seconds', label: 'Time Limit', visibleByDefault: true },
  { key: 'stem_count', label: 'Question stems', visibleByDefault: true },
  { key: 'question_count', label: 'Questions', visibleByDefault: true },
  { key: 'visibility', label: 'Visibility', visibleByDefault: true },
  { key: 'created_by', label: 'Created by', visibleByDefault: true },
  { key: 'actions', label: 'Actions', visibleByDefault: true },
]

const sortOptions: DataTableSortOption[] = [
  { key: 'name', label: 'Name' },
  { key: 'time_limit_seconds', label: 'Time Limit' },
  { key: 'stem_count', label: 'Question stems' },
  { key: 'question_count', label: 'Questions' },
  { key: 'visibility', label: 'Visibility' },
  { key: 'created_by', label: 'Created by' },
]

export function UcatSetsPage() {
  const searchParams = useSearchParams()
  const access = useUcatAccess()
  const sets = useUcatSets()
  const createSet = useCreateUcatSet()
  const deleteSet = useDeleteUcatSet()
  const restoreSet = useRestoreUcatSet()
  const [showDeleted, setShowDeleted] = useState(false)
  const tableState = useUcatTableState(columnDefinitions.filter((c) => c.visibleByDefault).map((c) => c.key), {
    defaultFilters: DEFAULT_FILTERS,
  })

  const [openCreate, setOpenCreate] = useState(false)
  const [editingSetId, setEditingSetId] = useState<string | null>(null)
  const [deletingSetId, setDeletingSetId] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', description: '', timeLimitSeconds: '', isPrivate: false, isStudentGenerated: false })

  useEffect(() => {
    const editId = searchParams.get('edit')
    if (editId) setEditingSetId(editId)
  }, [searchParams])

  const { rows, visibleColumns } = useUcatSetsTable({
    data: sets.data,
    showDeleted,
    defaultFilters: DEFAULT_FILTERS,
  })

  async function onCreate() {
    const payload: UcatQuestionSetPayload = {
      name: plainTextToProseMirror(form.name),
      description: form.description,
      timeLimitSeconds: parseTimeToSeconds(form.timeLimitSeconds),
      isPrivate: form.isPrivate,
      isStudentGenerated: false,
      stemIds: [],
    }
    const result = await createSet.mutateAsync(payload)
    setOpenCreate(false)
    setForm({ name: '', description: '', timeLimitSeconds: '', isPrivate: false, isStudentGenerated: false })
    if (result.id) setEditingSetId(result.id)
  }

  if (access.isLoading || sets.isLoading) return <UcatPageSkeleton rows={8} />
  if (!access.data) return <UcatAccessDenied />

  return (
    <div className="p-6">
      <UcatPageHeader
        title="UCAT Sets"
        description="Build and organize UCAT question sets"
        backHref="/ucat"
        breadcrumbs={[{ label: 'UCAT', href: '/ucat' }, { label: 'Sets' }]}
        actions={<Button onClick={() => setOpenCreate(true)}>Add Set</Button>}
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
        searchPlaceholder="Search sets"
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

      <div className="pt-3">
        <DataTable
          columns={[
            ...visibleColumns,
            {
              id: 'created_by',
              header: 'Created by',
              cell: ({ row }) => {
                const r = row.original as SetRow
                if (r.is_student_generated) {
                  return (
                    <span className="inline-flex items-center gap-1.5">
                      <Badge variant="secondary" className="text-xs">Student</Badge>
                      <span className="text-muted-foreground">Student-generated</span>
                    </span>
                  )
                }
                const name = [r.created_by_first_name, r.created_by_last_name].filter(Boolean).join(' ') || '—'
                return (
                  <span className="inline-flex items-center gap-1.5">
                    <Badge variant="secondary" className="text-xs">Staff</Badge>
                    <span>{name}</span>
                  </span>
                )
              },
            },
            {
              id: 'actions',
              header: 'Actions',
              cell: ({ row }) => {
                const r = row.original as SetRow
                return (
                  <div className="flex justify-end">
                    <UcatRowActions
                      actions={[
                        { label: 'Edit', icon: <Pencil className="h-4 w-4" />, onClick: () => setEditingSetId(r.id) },
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
          data={rows}
          pageSizeOptions={[10, 20, 50]}
          getRowClassName={(row) => (row.deleted_at ? 'bg-destructive/10' : '')}
        />
      </div>

      <UcatDialogShell
        open={openCreate}
        onClose={() => setOpenCreate(false)}
        title="Create Set"
        subtitle="Create a new UCAT set"
        onSave={onCreate}
        saveLabel="Create"
        saveDisabled={createSet.isPending}
        isSaving={createSet.isPending}
      >
        <div className="p-6 overflow-y-auto h-full space-y-4">
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Name</span>
            <Input value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} placeholder="Set name" />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Description</span>
            <Textarea className="min-h-20" value={form.description} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Time limit (mm:ss or seconds)</span>
            <Input type="text" value={form.timeLimitSeconds} onChange={(e) => setForm((prev) => ({ ...prev, timeLimitSeconds: e.target.value }))} placeholder="e.g. 1:30 or 90" />
          </label>
          <label className="inline-flex items-center gap-2 text-sm">
            <Checkbox checked={form.isPrivate} onCheckedChange={(checked) => setForm((prev) => ({ ...prev, isPrivate: checked === true }))} />
            Private set
          </label>
        </div>
      </UcatDialogShell>

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
      <UcatDeleteConfirmDialog
        open={!!deletingSetId}
        onOpenChange={(open) => !open && setDeletingSetId(null)}
        title="Delete set?"
        description="The set will be hidden from students. You can restore it later from the deleted list."
        onConfirm={async () => {
          if (deletingSetId) {
            await deleteSet.mutateAsync(deletingSetId)
            setEditingSetId((prev) => (prev === deletingSetId ? null : prev))
          }
        }}
        isPending={deleteSet.isPending}
      />
    </div>
  )
}
