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
import {
  useCreateUcatQuestionStemCategory,
  useDeleteUcatQuestionStemCategory,
  useUcatQuestionStemCategories,
  useUpdateUcatQuestionStemCategory,
} from '@/features/ucat/question-stem-categories/hooks/useUcatQuestionStemCategories'
import { UcatRowActions } from '@/features/ucat/shared/row-actions'
import { UcatDialogShell } from '@/features/ucat/shared/dialog-shell'
import { useUcatSections } from '@/features/ucat/questions/hooks/useUcatQuestions'
import { proseMirrorToPlainText } from '@/features/ucat/shared/lib/rich-text'

type CategoryRow = {
  id: string
  name: string
  section_id: string | null
  section_name: string
  parent_id: string | null
  parent_name: string
  description: string
  updated_at: string | null
}

type CategoryDraft = {
  name: string
  sectionId: string
  parentCategoryId: string
  description: string
}

const columnDefinitions: DataTableColumnDefinition[] = [
  { key: 'name', label: 'Name', visibleByDefault: true },
  { key: 'section_name', label: 'Section', visibleByDefault: true },
  { key: 'parent_name', label: 'Parent', visibleByDefault: true },
  { key: 'updated_at', label: 'Updated', visibleByDefault: true },
  { key: 'actions', label: 'Actions', visibleByDefault: true },
]

const emptyDraft: CategoryDraft = {
  name: '',
  sectionId: 'none',
  parentCategoryId: 'none',
  description: '',
}

export function UcatQuestionStemCategoriesPage() {
  const access = useUcatAccess()
  const categories = useUcatQuestionStemCategories()
  const sections = useUcatSections()
  const createCategory = useCreateUcatQuestionStemCategory()
  const updateCategory = useUpdateUcatQuestionStemCategory()
  const deleteCategory = useDeleteUcatQuestionStemCategory()
  const tableState = useUcatTableState(columnDefinitions.filter((c) => c.visibleByDefault).map((c) => c.key))

  const [createOpen, setCreateOpen] = useState(false)
  const [editing, setEditing] = useState<CategoryRow | null>(null)
  const [draft, setDraft] = useState<CategoryDraft>(emptyDraft)

  const categoryNameMap = new Map(
    (categories.data ?? []).map((category) => [category.id ?? '', category.name ?? '-'])
  )

  const sectionNameMap = new Map(
    (sections.data ?? []).map((section) => [section.id ?? '', section.name ?? '-'])
  )

  const rows: CategoryRow[] = (categories.data ?? []).map((category) => ({
    id: category.id ?? '',
    name: category.name ?? '-',
    section_id: category.ucat_section_id,
    section_name: sectionNameMap.get(category.ucat_section_id ?? '') ?? '-',
    parent_id: category.parent_question_stem_category_id,
    parent_name: categoryNameMap.get(category.parent_question_stem_category_id ?? '') ?? '-',
    description: proseMirrorToPlainText(category.description),
    updated_at: category.updated_at,
  }))

  const filterDefinitions: DataTableFilterDefinition[] = [
    {
      key: 'section_id',
      label: 'Section',
      options: (sections.data ?? []).map((section) => ({
        label: section.name ?? 'Unknown',
        value: section.id ?? '',
      })),
    },
  ]

  const filteredRows = useMemo(() => {
    const search = tableState.state.search.trim().toLowerCase()

    return rows.filter((row) => {
      const searchHit =
        search.length === 0 ||
        row.name.toLowerCase().includes(search) ||
        row.section_name.toLowerCase().includes(search) ||
        row.parent_name.toLowerCase().includes(search)
      const sectionHit = applySingleSelectFilter(tableState.state, 'section_id', row.section_id)
      return searchHit && sectionHit
    })
  }, [rows, tableState.state])

  const allColumns: Array<{ key: string; column: ColumnDef<CategoryRow> }> = [
    { key: 'name', column: { accessorKey: 'name', header: 'Name' } },
    { key: 'section_name', column: { accessorKey: 'section_name', header: 'Section' } },
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
                      sectionId: row.original.section_id ?? 'none',
                      parentCategoryId: row.original.parent_id ?? 'none',
                      description: row.original.description,
                    })
                  },
                },
                {
                  label: 'Delete',
                  icon: <Trash2 className="h-4 w-4" />,
                  onClick: () => deleteCategory.mutate(row.original.id),
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

  if (access.isLoading || categories.isLoading || sections.isLoading) return <UcatPageSkeleton rows={8} />
  if (!access.data) return <UcatAccessDenied />

  async function create() {
    await createCategory.mutateAsync({
      name: draft.name,
      description: draft.description,
      sectionId: draft.sectionId === 'none' ? null : draft.sectionId,
      parentCategoryId: draft.parentCategoryId === 'none' ? null : draft.parentCategoryId,
    })
    setCreateOpen(false)
    setDraft(emptyDraft)
  }

  async function saveEdit() {
    if (!editing) return

    await updateCategory.mutateAsync({
      id: editing.id,
      payload: {
        name: draft.name,
        description: draft.description,
        sectionId: draft.sectionId === 'none' ? null : draft.sectionId,
        parentCategoryId: draft.parentCategoryId === 'none' ? null : draft.parentCategoryId,
      },
    })

    setEditing(null)
    setDraft(emptyDraft)
  }

  return (
    <div className="p-6">
      <UcatPageHeader
        title="Question Stem Categories"
        description="Create and manage question stem categories"
        backHref="/ucat"
        breadcrumbs={[{ label: 'UCAT', href: '/ucat' }, { label: 'Question Stem Categories' }]}
        actions={<Button onClick={() => setCreateOpen(true)}>Add Category</Button>}
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
        searchPlaceholder="Search categories"
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
        title="Create Category"
        subtitle="Add a new question stem category"
        onSave={create}
        saveLabel="Create"
        saveDisabled={createCategory.isPending}
        isSaving={createCategory.isPending}
      >
        <CategoryForm draft={draft} setDraft={setDraft} rows={rows} sections={sections.data ?? []} editingId={null} />
      </UcatDialogShell>

      <UcatDialogShell
        open={!!editing}
        onClose={() => {
          setEditing(null)
          setDraft(emptyDraft)
        }}
        title="Edit Category"
        subtitle="Update category metadata"
        onSave={saveEdit}
        saveDisabled={updateCategory.isPending}
        isSaving={updateCategory.isPending}
      >
        <CategoryForm draft={draft} setDraft={setDraft} rows={rows} sections={sections.data ?? []} editingId={editing?.id ?? null} />
      </UcatDialogShell>
    </div>
  )
}

function CategoryForm({
  draft,
  setDraft,
  rows,
  sections,
  editingId,
}: {
  draft: CategoryDraft
  setDraft: React.Dispatch<React.SetStateAction<CategoryDraft>>
  rows: CategoryRow[]
  sections: Array<{ id: string | null; name: string | null }>
  editingId: string | null
}) {
  return (
    <div className="space-y-4">
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Name</span>
        <Input value={draft.name} onChange={(e) => setDraft((prev) => ({ ...prev, name: e.target.value }))} />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Section</span>
        <Select value={draft.sectionId} onValueChange={(value) => setDraft((prev) => ({ ...prev, sectionId: value }))}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No section</SelectItem>
            {sections.map((section) => (
              <SelectItem key={section.id ?? 'none'} value={section.id ?? ''}>
                {section.name ?? 'Unknown'}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </label>
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Parent Category</span>
        <Select value={draft.parentCategoryId} onValueChange={(value) => setDraft((prev) => ({ ...prev, parentCategoryId: value }))}>
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
