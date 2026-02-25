'use client'

import { useMemo, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import type { DataTableColumnDefinition } from '@altitutor/shared'
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
import { useUcatTableState, useVisibleColumns } from '@/features/ucat/shared/hooks/useUcatTableState'
import {
  useCreateUcatQuestionTag,
  useDeleteUcatQuestionTag,
  useUcatQuestionTags,
  useUpdateUcatQuestionTag,
} from '@/features/ucat/question-tags/hooks/useUcatQuestionTags'
import { UcatRowActions } from '@/features/ucat/shared/row-actions'
import { UcatDialogShell } from '@/features/ucat/shared/dialog-shell'
import { proseMirrorToPlainText } from '@/features/ucat/shared/lib/rich-text'

type TagRow = {
  id: string
  name: string
  parent_id: string | null
  parent_name: string
  description: string
  updated_at: string | null
}

type TagDraft = {
  name: string
  parentTagId: string
  description: string
}

const columnDefinitions: DataTableColumnDefinition[] = [
  { key: 'name', label: 'Name', visibleByDefault: true },
  { key: 'parent_name', label: 'Parent', visibleByDefault: true },
  { key: 'updated_at', label: 'Updated', visibleByDefault: true },
  { key: 'actions', label: 'Actions', visibleByDefault: true },
]

const emptyDraft: TagDraft = {
  name: '',
  parentTagId: 'none',
  description: '',
}

export function UcatQuestionTagsPage() {
  const access = useUcatAccess()
  const tags = useUcatQuestionTags()
  const createTag = useCreateUcatQuestionTag()
  const updateTag = useUpdateUcatQuestionTag()
  const deleteTag = useDeleteUcatQuestionTag()
  const tableState = useUcatTableState(columnDefinitions.filter((c) => c.visibleByDefault).map((c) => c.key))

  const [createOpen, setCreateOpen] = useState(false)
  const [editing, setEditing] = useState<TagRow | null>(null)
  const [draft, setDraft] = useState<TagDraft>(emptyDraft)

  const tagNameMap = new Map((tags.data ?? []).map((tag) => [tag.id ?? '', tag.name ?? '-']))

  const rows: TagRow[] = (tags.data ?? []).map((tag) => ({
    id: tag.id ?? '',
    name: tag.name ?? '-',
    parent_id: tag.parent_question_tag_id,
    parent_name: tagNameMap.get(tag.parent_question_tag_id ?? '') ?? '-',
    description: proseMirrorToPlainText(tag.description),
    updated_at: tag.updated_at,
  }))

  const filteredRows = useMemo(() => {
    const search = tableState.state.search.trim().toLowerCase()

    return rows.filter((row) => {
      return (
        search.length === 0 ||
        row.name.toLowerCase().includes(search) ||
        row.parent_name.toLowerCase().includes(search)
      )
    })
  }, [rows, tableState.state.search])

  const allColumns: Array<{ key: string; column: ColumnDef<TagRow> }> = [
    { key: 'name', column: { accessorKey: 'name', header: 'Name' } },
    {
      key: 'parent_name',
      column: {
        accessorKey: 'parent_name',
        header: 'Parent',
        cell: ({ row }) => (row.original.parent_id ? row.original.parent_name : '-'),
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
                      name: row.original.name,
                      parentTagId: row.original.parent_id ?? 'none',
                      description: row.original.description,
                    })
                  },
                },
                {
                  label: 'Delete',
                  icon: <Trash2 className="h-4 w-4" />,
                  onClick: () => deleteTag.mutate(row.original.id),
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

  if (access.isLoading || tags.isLoading) return <UcatPageSkeleton rows={8} />
  if (!access.data) return <UcatAccessDenied />

  async function create() {
    await createTag.mutateAsync({
      name: draft.name,
      description: draft.description,
      parentTagId: draft.parentTagId === 'none' ? null : draft.parentTagId,
    })
    setCreateOpen(false)
    setDraft(emptyDraft)
  }

  async function saveEdit() {
    if (!editing) return

    await updateTag.mutateAsync({
      id: editing.id,
      payload: {
        name: draft.name,
        description: draft.description,
        parentTagId: draft.parentTagId === 'none' ? null : draft.parentTagId,
      },
    })

    setEditing(null)
    setDraft(emptyDraft)
  }

  return (
    <div className="p-6">
      <UcatPageHeader
        title="Question Tags"
        description="Create and manage reusable question tags"
        backHref="/ucat"
        breadcrumbs={[{ label: 'UCAT', href: '/ucat' }, { label: 'Question Tags' }]}
        actions={<Button onClick={() => setCreateOpen(true)}>Add Tag</Button>}
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
        columnDefinitions={columnDefinitions}
        searchPlaceholder="Search tags"
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
        title="Create Tag"
        subtitle="Add a new question tag"
        onSave={create}
        saveLabel="Create"
        saveDisabled={createTag.isPending}
        isSaving={createTag.isPending}
      >
        <TagForm draft={draft} setDraft={setDraft} rows={rows} editingId={null} />
      </UcatDialogShell>

      <UcatDialogShell
        open={!!editing}
        onClose={() => {
          setEditing(null)
          setDraft(emptyDraft)
        }}
        title="Edit Tag"
        subtitle="Update tag metadata"
        onSave={saveEdit}
        saveDisabled={updateTag.isPending}
        isSaving={updateTag.isPending}
      >
        <TagForm draft={draft} setDraft={setDraft} rows={rows} editingId={editing?.id ?? null} />
      </UcatDialogShell>
    </div>
  )
}

function TagForm({
  draft,
  setDraft,
  rows,
  editingId,
}: {
  draft: TagDraft
  setDraft: React.Dispatch<React.SetStateAction<TagDraft>>
  rows: TagRow[]
  editingId: string | null
}) {
  return (
    <div className="space-y-4">
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Name</span>
        <Input value={draft.name} onChange={(e) => setDraft((prev) => ({ ...prev, name: e.target.value }))} />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Parent Tag</span>
        <Select value={draft.parentTagId} onValueChange={(value) => setDraft((prev) => ({ ...prev, parentTagId: value }))}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No parent</SelectItem>
            {rows
              .filter((row) => row.id !== editingId)
              .map((row) => (
                <SelectItem key={row.id} value={row.id}>
                  {row.name}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      </label>
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Description</span>
        <Textarea className="min-h-24" value={draft.description} onChange={(e) => setDraft((prev) => ({ ...prev, description: e.target.value }))} />
      </label>
    </div>
  )
}
