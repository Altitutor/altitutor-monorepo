'use client'

import { useMemo, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import type { DataTableColumnDefinition, DataTableFilterDefinition } from '@altitutor/shared'
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
import { applySingleSelectFilter, useUcatTableState, useVisibleColumns } from '@/features/ucat/shared/hooks/useUcatTableState'
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
  updated_at: string | null
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
]

const columnDefinitions: DataTableColumnDefinition[] = [
  { key: 'section_number', label: 'Section #', visibleByDefault: true },
  { key: 'name', label: 'Name', visibleByDefault: true },
  { key: 'display_columns', label: 'Display', visibleByDefault: true },
  { key: 'updated_at', label: 'Updated', visibleByDefault: true },
  { key: 'actions', label: 'Actions', visibleByDefault: true },
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

  const rows: SectionRow[] = (sections.data ?? []).map((row) => ({
    id: row.id ?? '',
    section_number: row.section_number ?? 0,
    name: row.name ?? '',
    display_columns: row.display_columns ?? 2,
    description: proseMirrorToPlainText(row.description),
    updated_at: row.updated_at ?? null,
  }))

  const filteredRows = useMemo(() => {
    const search = tableState.state.search.trim().toLowerCase()

    return rows.filter((row) => {
      const searchHit =
        search.length === 0 ||
        row.name.toLowerCase().includes(search) ||
        String(row.section_number).includes(search)
      const columnsHit = applySingleSelectFilter(tableState.state, 'display_columns', String(row.display_columns))
      return searchHit && columnsHit
    })
  }, [rows, tableState.state])

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
        searchPlaceholder="Search sections"
      />

      <div className="pt-3">
        <DataTable columns={visibleColumns} data={filteredRows} pageSizeOptions={[10, 20, 50]} />
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
