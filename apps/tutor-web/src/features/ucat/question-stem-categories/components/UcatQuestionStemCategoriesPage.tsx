'use client'

import { useMemo, useState } from 'react'
import type { DataTableFilterDefinition, DataTableSortOption } from '@altitutor/shared'
import {
  Button,
  DataTableToolbar,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Textarea,
} from '@altitutor/ui'
import { ChevronDown, ChevronRight, Pencil, Trash2 } from 'lucide-react'
import { useUcatAccess } from '@/features/ucat/shared/hooks/useUcatAccess'
import { UcatAccessDenied, UcatPageHeader, UcatPageSkeleton } from '@/features/ucat/shared/components'
import { applySingleSelectFilter, applySort, useUcatTableState } from '@/features/ucat/shared/hooks/useUcatTableState'
import {
  useCreateUcatQuestionStemCategory,
  useDeleteUcatQuestionStemCategory,
  useUcatQuestionStemCategories,
  useUpdateUcatQuestionStemCategory,
} from '@/features/ucat/question-stem-categories/hooks/useUcatQuestionStemCategories'
import { UcatDeleteConfirmDialog } from '@/features/ucat/shared/delete-confirm-dialog'
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
  description: string
  question_stem_count: number
}

type CategoryDraft = {
  name: string
  sectionId: string
  parentCategoryId: string
  description: string
}

const emptyDraft: CategoryDraft = {
  name: '',
  sectionId: 'none',
  parentCategoryId: 'none',
  description: '',
}

const categorySortOptions: DataTableSortOption[] = [
  { key: 'section_name', label: 'Section' },
  { key: 'name', label: 'Name' },
  { key: 'question_stem_count', label: 'Number of stems' },
]

function buildCategoryTree(
  rows: CategoryRow[],
  expanded: Set<string>,
  parentId: string | null,
  level: number,
  sortBy: string | null,
  sortDirection: 'asc' | 'desc'
): Array<{ row: CategoryRow; level: number }> {
  const out: Array<{ row: CategoryRow; level: number }> = []
  let children = rows.filter((r) => (parentId === null ? !r.parent_id : r.parent_id === parentId))
  children = applySort(children, sortBy, sortDirection, {
    section_name: (r) => r.section_name,
    name: (r) => r.name,
    question_stem_count: (r) => r.question_stem_count,
  })
  for (const row of children) {
    out.push({ row, level })
    if (expanded.has(row.id)) {
      out.push(...buildCategoryTree(rows, expanded, row.id, level + 1, sortBy, sortDirection))
    }
  }
  return out
}

export function UcatQuestionStemCategoriesPage() {
  const access = useUcatAccess()
  const categories = useUcatQuestionStemCategories()
  const sections = useUcatSections()
  const createCategory = useCreateUcatQuestionStemCategory()
  const updateCategory = useUpdateUcatQuestionStemCategory()
  const deleteCategory = useDeleteUcatQuestionStemCategory()
  const tableState = useUcatTableState(['section_name', 'name', 'question_stem_count', 'actions'])

  const [createOpen, setCreateOpen] = useState(false)
  const [editing, setEditing] = useState<CategoryRow | null>(null)
  const [deletingCategoryId, setDeletingCategoryId] = useState<string | null>(null)
  const [draft, setDraft] = useState<CategoryDraft>(emptyDraft)
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())

  const sectionNameMap = useMemo(
    () => new Map((sections.data ?? []).map((s) => [s.id ?? '', s.name ?? '-'])),
    [sections.data]
  )

  const rows: CategoryRow[] = useMemo(() => {
    const data = categories.data ?? []
    return data.map((category) => {
      const r = category as typeof category & { question_stem_count?: number }
      return {
        id: r.id ?? '',
        name: r.name ?? '-',
        section_id: r.ucat_section_id,
        section_name: sectionNameMap.get(r.ucat_section_id ?? '') ?? '-',
        parent_id: r.parent_question_stem_category_id,
        description: proseMirrorToPlainText(r.description),
        question_stem_count: r.question_stem_count ?? 0,
      }
    })
  }, [categories.data, sectionNameMap])

  const filterDefinitions: DataTableFilterDefinition[] = useMemo(
    () => [
      {
        key: 'section_id',
        label: 'Section',
        options: (sections.data ?? []).map((section) => ({
          label: section.name ?? 'Unknown',
          value: section.id ?? '',
        })),
      },
    ],
    [sections.data]
  )

  const filteredRows = useMemo(() => {
    const search = tableState.state.search.trim().toLowerCase()
    return rows.filter((row) => {
      const searchHit =
        search.length === 0 ||
        row.name.toLowerCase().includes(search) ||
        row.section_name.toLowerCase().includes(search)
      const sectionHit = applySingleSelectFilter(tableState.state, 'section_id', row.section_id)
      return searchHit && sectionHit
    })
  }, [rows, tableState.state])

  const flatTree = useMemo(
    () =>
      buildCategoryTree(
        filteredRows,
        expandedCategories,
        null,
        0,
        tableState.state.sortBy,
        tableState.state.sortDirection
      ),
    [filteredRows, expandedCategories, tableState.state.sortBy, tableState.state.sortDirection]
  )

  const parentOptions = useMemo(() => {
    if (draft.sectionId === 'none') return []
    return rows.filter((r) => r.section_id === draft.sectionId && r.id !== editing?.id)
  }, [rows, draft.sectionId, editing?.id])

  const toggleExpanded = (id: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const hasChildren = (row: CategoryRow) => filteredRows.some((r) => r.parent_id === row.id)

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
        columnDefinitions={[
          { key: 'section_name', label: 'Section', visibleByDefault: true },
          { key: 'name', label: 'Name', visibleByDefault: true },
          { key: 'question_stem_count', label: 'Question stems', visibleByDefault: true },
          { key: 'actions', label: 'Actions', visibleByDefault: true },
        ]}
        sortOptions={categorySortOptions}
        searchPlaceholder="Search categories"
      />

      <div className="pt-3">
        <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12" />
              <TableHead>Section</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Question stems</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {flatTree.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center h-24 text-muted-foreground">
                  No categories match your filters
                </TableCell>
              </TableRow>
            ) : (
              flatTree.map(({ row, level }) => {
                const hasKids = hasChildren(row)
                const isExpanded = expandedCategories.has(row.id)
                return (
                  <TableRow key={row.id}>
                    <TableCell className="w-12" onClick={(e) => e.stopPropagation()}>
                      {hasKids ? (
                        <button
                          type="button"
                          onClick={() => toggleExpanded(row.id)}
                          className="p-1 hover:bg-muted rounded"
                        >
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </button>
                      ) : null}
                    </TableCell>
                    <TableCell>{row.section_name}</TableCell>
                    <TableCell style={{ paddingLeft: `${level * 24 + 8}px` }}>{row.name}</TableCell>
                    <TableCell>{row.question_stem_count}</TableCell>
                    <TableCell className="w-12">
                      <div className="flex justify-end">
                        <UcatRowActions
                          actions={[
                            {
                              label: 'Edit',
                              icon: <Pencil className="h-4 w-4" />,
                              onClick: () => {
                                setEditing(row)
                                setDraft({
                                  name: row.name,
                                  sectionId: row.section_id ?? 'none',
                                  parentCategoryId: row.parent_id ?? 'none',
                                  description: row.description,
                                })
                              },
                            },
                            {
                              label: 'Delete',
                              icon: <Trash2 className="h-4 w-4" />,
                              onClick: () => setDeletingCategoryId(row.id),
                              destructive: true,
                            },
                          ]}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
        </div>
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
        <div className="p-6 overflow-y-auto h-full">
          <CategoryForm
            draft={draft}
            setDraft={setDraft}
            sections={sections.data ?? []}
            parentOptions={parentOptions}
            onSectionChange={() => setDraft((p) => ({ ...p, parentCategoryId: 'none' }))}
          />
        </div>
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
        <div className="p-6 overflow-y-auto h-full">
          <CategoryForm
            draft={draft}
            setDraft={setDraft}
            sections={sections.data ?? []}
            parentOptions={parentOptions}
            onSectionChange={() => setDraft((p) => ({ ...p, parentCategoryId: 'none' }))}
          />
        </div>
      </UcatDialogShell>
      <UcatDeleteConfirmDialog
        open={!!deletingCategoryId}
        onOpenChange={(open) => !open && setDeletingCategoryId(null)}
        title="Delete category?"
        description="This action cannot be undone."
        onConfirm={async () => { if (deletingCategoryId) await deleteCategory.mutateAsync(deletingCategoryId) }}
        isPending={deleteCategory.isPending}
      />
    </div>
  )
}

function CategoryForm({
  draft,
  setDraft,
  sections,
  parentOptions,
  onSectionChange,
}: {
  draft: CategoryDraft
  setDraft: React.Dispatch<React.SetStateAction<CategoryDraft>>
  sections: Array<{ id: string | null; name: string | null }>
  parentOptions: CategoryRow[]
  onSectionChange: () => void
}) {
  const sectionSelected = draft.sectionId !== 'none'

  return (
    <div className="space-y-4">
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Section</span>
        <Select
          value={draft.sectionId}
          onValueChange={(value) => {
            setDraft((prev) => ({ ...prev, sectionId: value }))
            onSectionChange()
          }}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Select section</SelectItem>
            {sections.map((section) => (
              <SelectItem key={section.id ?? 'none'} value={section.id ?? ''}>
                {section.name ?? 'Unknown'}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </label>
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Name</span>
        <Input value={draft.name} onChange={(e) => setDraft((prev) => ({ ...prev, name: e.target.value }))} />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Parent Category</span>
        <Select
          value={draft.parentCategoryId}
          onValueChange={(value) => setDraft((prev) => ({ ...prev, parentCategoryId: value }))}
          disabled={!sectionSelected}
        >
          <SelectTrigger>
            <SelectValue placeholder={sectionSelected ? undefined : 'Select section first'} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No parent</SelectItem>
            {parentOptions.map((row) => (
              <SelectItem key={row.id} value={row.id}>
                {row.name}
              </SelectItem>
            ))}
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
