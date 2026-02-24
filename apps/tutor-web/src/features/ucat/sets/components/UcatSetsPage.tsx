'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import type { ColumnDef } from '@tanstack/react-table'
import type { DataTableColumnDefinition, DataTableFilterDefinition } from '@altitutor/shared'
import {
  Button,
  Checkbox,
  DataTable,
  DataTableToolbar,
  Input,
  Textarea,
} from '@altitutor/ui'
import { Pencil, Trash2 } from 'lucide-react'
import { useCreateUcatSet, useDeleteUcatSet, useUcatSets } from '@/features/ucat/sets/hooks/useUcatSets'
import { UcatAccessDenied, UcatPageHeader, UcatPageSkeleton } from '@/features/ucat/shared/components'
import { useUcatAccess } from '@/features/ucat/shared/hooks/useUcatAccess'
import type { UcatQuestionSetPayload } from '@/features/ucat/shared/types'
import { applyBooleanTextFilter, applySingleSelectFilter, useUcatTableState, useVisibleColumns } from '@/features/ucat/shared/hooks/useUcatTableState'
import { UcatRowActions } from '@/features/ucat/shared/row-actions'
import { UcatSetEditorDialog } from '@/features/ucat/sets/components/UcatSetEditorDialog'
import { UcatDialogShell } from '@/features/ucat/shared/dialog-shell'

type SetRow = {
  id: string
  description: string
  time_limit_seconds: number | null
  is_private: boolean
  is_student_generated: boolean
  updated_at: string | null
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
  {
    key: 'origin',
    label: 'Origin',
    options: [
      { label: 'Staff', value: 'staff' },
      { label: 'Student', value: 'student' },
    ],
  },
]

const columnDefinitions: DataTableColumnDefinition[] = [
  { key: 'description', label: 'Description', visibleByDefault: true },
  { key: 'time_limit_seconds', label: 'Time Limit', visibleByDefault: true },
  { key: 'visibility', label: 'Visibility', visibleByDefault: true },
  { key: 'origin', label: 'Origin', visibleByDefault: true },
  { key: 'updated_at', label: 'Updated', visibleByDefault: true },
  { key: 'actions', label: 'Actions', visibleByDefault: true },
]

export function UcatSetsPage() {
  const searchParams = useSearchParams()
  const access = useUcatAccess()
  const sets = useUcatSets()
  const createSet = useCreateUcatSet()
  const deleteSet = useDeleteUcatSet()
  const tableState = useUcatTableState(columnDefinitions.filter((c) => c.visibleByDefault).map((c) => c.key))

  const [openCreate, setOpenCreate] = useState(false)
  const [editingSetId, setEditingSetId] = useState<string | null>(null)
  const [form, setForm] = useState({ description: '', timeLimitSeconds: '', isPrivate: false, isStudentGenerated: false })

  useEffect(() => {
    const editId = searchParams.get('edit')
    if (editId) setEditingSetId(editId)
  }, [searchParams])

  const rows: SetRow[] = (sets.data ?? []).map((row) => ({
    id: row.id ?? '',
    description: JSON.stringify(row.description ?? ''),
    time_limit_seconds: row.time_limit_seconds,
    is_private: !!row.is_private,
    is_student_generated: !!row.is_student_generated,
    updated_at: row.updated_at,
  }))

  const filteredRows = useMemo(() => {
    const search = tableState.state.search.trim().toLowerCase()
    return rows.filter((row) => {
      const searchHit = search.length === 0 || row.description.toLowerCase().includes(search)
      const visibilityHit = applyBooleanTextFilter(tableState.state, 'visibility', row.is_private)
      const originValue = row.is_student_generated ? 'student' : 'staff'
      const originHit = applySingleSelectFilter(tableState.state, 'origin', originValue)
      return searchHit && visibilityHit && originHit
    })
  }, [rows, tableState.state])

  const allColumns: Array<{ key: string; column: ColumnDef<SetRow> }> = [
    { key: 'description', column: { accessorKey: 'description', header: 'Description' } },
    {
      key: 'time_limit_seconds',
      column: {
        accessorKey: 'time_limit_seconds',
        header: 'Time Limit',
        cell: ({ row }) => (row.original.time_limit_seconds ? `${row.original.time_limit_seconds}s` : '-'),
      },
    },
    {
      key: 'visibility',
      column: {
        accessorKey: 'is_private',
        header: 'Visibility',
        cell: ({ row }) => (row.original.is_private ? 'Private' : 'Public'),
      },
    },
    {
      key: 'origin',
      column: {
        accessorKey: 'is_student_generated',
        header: 'Origin',
        cell: ({ row }) => (row.original.is_student_generated ? 'Student' : 'Staff'),
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
        header: 'Actions',
        cell: ({ row }) => (
          <div className="flex justify-end">
            <UcatRowActions
              actions={[
                { label: 'Edit', icon: <Pencil className="h-4 w-4" />, onClick: () => setEditingSetId(row.original.id) },
                { label: 'Delete', icon: <Trash2 className="h-4 w-4" />, onClick: () => deleteSet.mutate(row.original.id), destructive: true },
              ]}
            />
          </div>
        ),
      },
    },
  ]

  const visibleColumns = useVisibleColumns(allColumns, tableState.state.visibleColumns)

  async function onCreate() {
    const payload: UcatQuestionSetPayload = {
      description: form.description,
      timeLimitSeconds: form.timeLimitSeconds ? Number(form.timeLimitSeconds) : null,
      isPrivate: form.isPrivate,
      isStudentGenerated: form.isStudentGenerated,
      stemIds: [],
    }
    const result = await createSet.mutateAsync(payload)
    setOpenCreate(false)
    setForm({ description: '', timeLimitSeconds: '', isPrivate: false, isStudentGenerated: false })
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
        searchPlaceholder="Search sets"
      />

      <div className="pt-3">
        <DataTable columns={visibleColumns} data={filteredRows} pageSizeOptions={[10, 20, 50]} />
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
        <div className="space-y-4">
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Description</span>
            <Textarea className="min-h-20" value={form.description} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Time limit (seconds)</span>
            <Input type="number" value={form.timeLimitSeconds} onChange={(e) => setForm((prev) => ({ ...prev, timeLimitSeconds: e.target.value }))} />
          </label>
          <label className="inline-flex items-center gap-2 text-sm">
            <Checkbox checked={form.isPrivate} onCheckedChange={(checked) => setForm((prev) => ({ ...prev, isPrivate: checked === true }))} />
            Private set
          </label>
          <label className="inline-flex items-center gap-2 text-sm">
            <Checkbox checked={form.isStudentGenerated} onCheckedChange={(checked) => setForm((prev) => ({ ...prev, isStudentGenerated: checked === true }))} />
            Student-generated set
          </label>
        </div>
      </UcatDialogShell>

      <UcatSetEditorDialog open={!!editingSetId} setId={editingSetId} onClose={() => setEditingSetId(null)} />
    </div>
  )
}
