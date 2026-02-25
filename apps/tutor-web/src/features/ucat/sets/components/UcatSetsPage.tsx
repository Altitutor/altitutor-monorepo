'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import type { ColumnDef } from '@tanstack/react-table'
import type { DataTableColumnDefinition, DataTableFilterDefinition } from '@altitutor/shared'
import {
  Badge,
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
import {
  applyBooleanTextFilter,
  applyRangeFilter,
  applySingleSelectFilter,
  useUcatTableState,
  useVisibleColumns,
} from '@/features/ucat/shared/hooks/useUcatTableState'
import { UcatRowActions } from '@/features/ucat/shared/row-actions'
import { UcatSetEditorDialog } from '@/features/ucat/sets/components/UcatSetEditorDialog'
import { UcatDialogShell } from '@/features/ucat/shared/dialog-shell'
import { proseMirrorToPlainText } from '@/features/ucat/shared/lib/rich-text'

const DEFAULT_FILTERS: Record<string, unknown[]> = { is_student_generated: ['staff'] }

type SetRow = {
  id: string
  name: string
  time_limit_seconds: number | null
  is_private: boolean
  is_student_generated: boolean
  stem_count: number
  question_count: number
  created_by_first_name: string | null
  created_by_last_name: string | null
}

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

export function UcatSetsPage() {
  const searchParams = useSearchParams()
  const access = useUcatAccess()
  const sets = useUcatSets()
  const createSet = useCreateUcatSet()
  const deleteSet = useDeleteUcatSet()
  const tableState = useUcatTableState(columnDefinitions.filter((c) => c.visibleByDefault).map((c) => c.key), {
    defaultFilters: DEFAULT_FILTERS,
  })

  const [openCreate, setOpenCreate] = useState(false)
  const [editingSetId, setEditingSetId] = useState<string | null>(null)
  const [form, setForm] = useState({ description: '', timeLimitSeconds: '', isPrivate: false, isStudentGenerated: false })

  useEffect(() => {
    const editId = searchParams.get('edit')
    if (editId) setEditingSetId(editId)
  }, [searchParams])

  const rows: SetRow[] = (sets.data ?? []).map((row) => {
    const r = row as typeof row & { stem_count?: number; question_count?: number }
    return {
      id: row.id ?? '',
      name: proseMirrorToPlainText(row.name ?? null) || '—',
      time_limit_seconds: row.time_limit_seconds,
      is_private: !!row.is_private,
      is_student_generated: !!row.is_student_generated,
      stem_count: r.stem_count ?? 0,
      question_count: r.question_count ?? 0,
      created_by_first_name: row.created_by_first_name ?? null,
      created_by_last_name: row.created_by_last_name ?? null,
    }
  })

  const filteredRows = useMemo(() => {
    const search = tableState.state.search.trim().toLowerCase()
    return rows.filter((row) => {
      const searchHit = search.length === 0 || row.name.toLowerCase().includes(search)
      const visibilityHit = applyBooleanTextFilter(tableState.state, 'visibility', row.is_private)
      const originValue = row.is_student_generated ? 'student' : 'staff'
      const originHit = applySingleSelectFilter(tableState.state, 'is_student_generated', originValue)
      const timeLimitHit = applyRangeFilter(
        tableState.state,
        'time_limit_min',
        'time_limit_max',
        row.time_limit_seconds
      )
      const stemCountHit = applyRangeFilter(
        tableState.state,
        'stem_count_min',
        'stem_count_max',
        row.stem_count
      )
      const questionCountHit = applyRangeFilter(
        tableState.state,
        'question_count_min',
        'question_count_max',
        row.question_count
      )
      return searchHit && visibilityHit && originHit && timeLimitHit && stemCountHit && questionCountHit
    })
  }, [rows, tableState.state])

  const allColumns: Array<{ key: string; column: ColumnDef<SetRow> }> = [
    { key: 'name', column: { accessorKey: 'name', header: 'Name' } },
    {
      key: 'time_limit_seconds',
      column: {
        accessorKey: 'time_limit_seconds',
        header: 'Time Limit',
        cell: ({ row }) => (row.original.time_limit_seconds ? `${row.original.time_limit_seconds}s` : '-'),
      },
    },
    {
      key: 'stem_count',
      column: {
        accessorKey: 'stem_count',
        header: 'Question stems',
        cell: ({ row }) => String(row.original.stem_count),
      },
    },
    {
      key: 'question_count',
      column: {
        accessorKey: 'question_count',
        header: 'Questions',
        cell: ({ row }) => String(row.original.question_count),
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
      key: 'created_by',
      column: {
        id: 'created_by',
        header: 'Created by',
        cell: ({ row }) => {
          const r = row.original
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
