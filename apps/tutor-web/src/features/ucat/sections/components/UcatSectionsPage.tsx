'use client'

import { useMemo, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import type { DataTableColumnDefinition, DataTableFilterDefinition, DataTableSortOption } from '@altitutor/shared'
import {
  Button,
  DataTable,
  DataTableToolbar,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from '@altitutor/ui'
import { Pencil, Trash2 } from 'lucide-react'
import { useUcatAccess } from '@/features/ucat/shared/hooks/useUcatAccess'
import { UcatAccessDenied, UcatPageHeader, UcatPageSkeleton } from '@/features/ucat/shared/components'
import { applyRangeFilter, applySingleSelectFilter, applySort, useUcatTableState, useVisibleColumns } from '@/features/ucat/shared/hooks/useUcatTableState'
import { useCreateUcatSection, useDeleteUcatSection, useUcatSections, useUpdateUcatSection } from '@/features/ucat/sections/hooks/useUcatSections'
import { UcatDialogShell } from '@/features/ucat/shared/dialog-shell'
import { UcatRowActions } from '@/features/ucat/shared/row-actions'
import { proseMirrorToPlainText } from '@/features/ucat/shared/lib/rich-text'

type SectionRow = {
  id: string
  section_number: number
  name: string
  display_columns: number
  description: string
  time_limit_seconds: number | null
  number_of_questions: number | null
  time_per_question: number | null
}

type SectionDraft = {
  sectionNumber: string
  name: string
  displayColumns: '1' | '2'
  description: string
}

const filterDefinitions: DataTableFilterDefinition[] = [
  {
    key: 'display_columns',
    label: 'Columns',
    options: [
      { label: '1 Column', value: '1' },
      { label: '2 Columns', value: '2' },
    ],
  },
  {
    type: 'number-range',
    key: 'time_limit_seconds',
    label: 'Time limit',
    minKey: 'time_limit_seconds_min',
    maxKey: 'time_limit_seconds_max',
  },
  {
    type: 'number-range',
    key: 'number_of_questions',
    label: 'Number of questions',
    minKey: 'number_of_questions_min',
    maxKey: 'number_of_questions_max',
  },
  {
    type: 'number-range',
    key: 'time_per_question',
    label: 'Time per question',
    minKey: 'time_per_question_min',
    maxKey: 'time_per_question_max',
  },
]

const columnDefinitions: DataTableColumnDefinition[] = [
  { key: 'section_number', label: 'Section #', visibleByDefault: true },
  { key: 'name', label: 'Name', visibleByDefault: true },
  { key: 'display_columns', label: 'Display', visibleByDefault: false },
  { key: 'time_limit_seconds', label: 'Time limit', visibleByDefault: true },
  { key: 'number_of_questions', label: 'Number of questions', visibleByDefault: true },
  { key: 'time_per_question', label: 'Time per question', visibleByDefault: true },
  { key: 'actions', label: 'Actions', visibleByDefault: true },
]

const sortOptions: DataTableSortOption[] = [
  { key: 'section_number', label: 'Section #' },
  { key: 'name', label: 'Name' },
  { key: 'display_columns', label: 'Display' },
  { key: 'time_limit_seconds', label: 'Time limit' },
  { key: 'number_of_questions', label: 'Number of questions' },
  { key: 'time_per_question', label: 'Time per question' },
]

const emptyDraft: SectionDraft = {
  sectionNumber: '',
  name: '',
  displayColumns: '2',
  description: '',
}

export function UcatSectionsPage() {
  const access = useUcatAccess()
  const sections = useUcatSections()
  const createSection = useCreateUcatSection()
  const updateSection = useUpdateUcatSection()
  const deleteSection = useDeleteUcatSection()
  const tableState = useUcatTableState(columnDefinitions.filter((c) => c.visibleByDefault).map((c) => c.key))

  const [createOpen, setCreateOpen] = useState(false)
  const [editing, setEditing] = useState<SectionRow | null>(null)
  const [draft, setDraft] = useState<SectionDraft>(emptyDraft)

  const rows: SectionRow[] = (sections.data ?? []).map((row) => {
    const r = row as typeof row & {
      time_limit_seconds?: number | null
      number_of_questions?: number | null
      time_per_question?: number | null
    }
    return {
      id: r.id ?? '',
      section_number: r.section_number ?? 0,
      name: r.name ?? '',
      display_columns: r.display_columns ?? 2,
      description: proseMirrorToPlainText(r.description),
      time_limit_seconds: r.time_limit_seconds ?? null,
      number_of_questions: r.number_of_questions ?? null,
      time_per_question: r.time_per_question ?? null,
    }
  })

  const filteredRows = useMemo(() => {
    const search = tableState.state.search.trim().toLowerCase()

    return rows.filter((row) => {
      const searchHit =
        search.length === 0 ||
        row.name.toLowerCase().includes(search) ||
        String(row.section_number).includes(search)
      const columnsHit = applySingleSelectFilter(tableState.state, 'display_columns', String(row.display_columns))
      const timeLimitHit = applyRangeFilter(
        tableState.state,
        'time_limit_seconds_min',
        'time_limit_seconds_max',
        row.time_limit_seconds
      )
      const numQuestionsHit = applyRangeFilter(
        tableState.state,
        'number_of_questions_min',
        'number_of_questions_max',
        row.number_of_questions
      )
      const timePerQHit = applyRangeFilter(
        tableState.state,
        'time_per_question_min',
        'time_per_question_max',
        row.time_per_question
      )
      return searchHit && columnsHit && timeLimitHit && numQuestionsHit && timePerQHit
    })
  }, [rows, tableState.state])

  const sortedRows = useMemo(
    () =>
      applySort(filteredRows, tableState.state.sortBy, tableState.state.sortDirection, {
        section_number: (r) => r.section_number,
        name: (r) => r.name,
        display_columns: (r) => r.display_columns,
        time_limit_seconds: (r) => r.time_limit_seconds ?? -1,
        number_of_questions: (r) => r.number_of_questions ?? -1,
        time_per_question: (r) => r.time_per_question ?? -1,
      }),
    [filteredRows, tableState.state.sortBy, tableState.state.sortDirection]
  )

  const allColumns: Array<{ key: string; column: ColumnDef<SectionRow> }> = [
    { key: 'section_number', column: { accessorKey: 'section_number', header: 'Section #' } },
    { key: 'name', column: { accessorKey: 'name', header: 'Name' } },
    {
      key: 'display_columns',
      column: {
        accessorKey: 'display_columns',
        header: 'Display',
        cell: ({ row }) => `${row.original.display_columns} column${row.original.display_columns > 1 ? 's' : ''}`,
      },
    },
    {
      key: 'time_limit_seconds',
      column: {
        accessorKey: 'time_limit_seconds',
        header: 'Time limit',
        cell: ({ row }) =>
          row.original.time_limit_seconds != null ? `${row.original.time_limit_seconds}s` : '-',
      },
    },
    {
      key: 'number_of_questions',
      column: {
        accessorKey: 'number_of_questions',
        header: 'Number of questions',
        cell: ({ row }) => row.original.number_of_questions ?? '-',
      },
    },
    {
      key: 'time_per_question',
      column: {
        accessorKey: 'time_per_question',
        header: 'Time per question',
        cell: ({ row }) =>
          row.original.time_per_question != null
            ? `${Number(row.original.time_per_question).toFixed(1)}s`
            : '-',
      },
    },
    {
      key: 'actions',
      column: {
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <div className="flex justify-end">
            <UcatRowActions
              actions={[
                {
                  label: 'Edit',
                  icon: <Pencil className="h-4 w-4" />,
                  onClick: () => {
                    setEditing(row.original)
                    setDraft({
                      sectionNumber: String(row.original.section_number),
                      name: row.original.name,
                      displayColumns: String(row.original.display_columns) as '1' | '2',
                      description: row.original.description,
                    })
                  },
                },
                {
                  label: 'Delete',
                  icon: <Trash2 className="h-4 w-4" />,
                  onClick: () => deleteSection.mutate(row.original.id),
                  destructive: true,
                },
              ]}
            />
          </div>
        ),
      },
    },
  ]

  const visibleColumns = useVisibleColumns(allColumns, tableState.state.visibleColumns)

  if (access.isLoading || sections.isLoading) return <UcatPageSkeleton rows={8} />
  if (!access.data) return <UcatAccessDenied />

  async function create() {
    await createSection.mutateAsync({
      sectionNumber: Number(draft.sectionNumber),
      name: draft.name,
      displayColumns: Number(draft.displayColumns) as 1 | 2,
      description: draft.description,
    })
    setCreateOpen(false)
    setDraft(emptyDraft)
  }

  async function saveEdit() {
    if (!editing) return
    await updateSection.mutateAsync({
      id: editing.id,
      payload: {
        sectionNumber: Number(draft.sectionNumber),
        name: draft.name,
        displayColumns: Number(draft.displayColumns) as 1 | 2,
        description: draft.description,
      },
    })
    setEditing(null)
    setDraft(emptyDraft)
  }

  return (
    <div className="p-6">
      <UcatPageHeader
        title="UCAT Sections"
        description="Create and manage UCAT sections"
        backHref="/ucat"
        breadcrumbs={[{ label: 'UCAT', href: '/ucat' }, { label: 'Sections' }]}
        actions={<Button onClick={() => setCreateOpen(true)}>Add Section</Button>}
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
        searchPlaceholder="Search sections"
      />

      <div className="pt-3">
        <DataTable columns={visibleColumns} data={sortedRows} pageSizeOptions={[10, 20, 50]} />
      </div>

      <UcatDialogShell
        open={createOpen}
        onClose={() => {
          setCreateOpen(false)
          setDraft(emptyDraft)
        }}
        title="Create Section"
        subtitle="Add a new UCAT section"
        onSave={create}
        saveLabel="Create"
        saveDisabled={createSection.isPending}
        isSaving={createSection.isPending}
      >
        <SectionForm draft={draft} setDraft={setDraft} />
      </UcatDialogShell>

      <UcatDialogShell
        open={!!editing}
        onClose={() => {
          setEditing(null)
          setDraft(emptyDraft)
        }}
        title="Edit Section"
        subtitle="Update section metadata"
        onSave={saveEdit}
        saveDisabled={updateSection.isPending}
        isSaving={updateSection.isPending}
      >
        <SectionForm draft={draft} setDraft={setDraft} />
      </UcatDialogShell>
    </div>
  )
}

function SectionForm({
  draft,
  setDraft,
}: {
  draft: SectionDraft
  setDraft: React.Dispatch<React.SetStateAction<SectionDraft>>
}) {
  return (
    <div className="space-y-4">
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Section Number</span>
        <Input
          type="number"
          value={draft.sectionNumber}
          onChange={(e) => setDraft((prev) => ({ ...prev, sectionNumber: e.target.value }))}
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Name</span>
        <Input value={draft.name} onChange={(e) => setDraft((prev) => ({ ...prev, name: e.target.value }))} />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Display Columns</span>
        <Select
          value={draft.displayColumns}
          onValueChange={(value: '1' | '2') => setDraft((prev) => ({ ...prev, displayColumns: value }))}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1">1 Column</SelectItem>
            <SelectItem value="2">2 Columns</SelectItem>
          </SelectContent>
        </Select>
      </label>
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Description</span>
        <Textarea
          className="min-h-24"
          value={draft.description}
          onChange={(e) => setDraft((prev) => ({ ...prev, description: e.target.value }))}
        />
      </label>
    </div>
  )
}
