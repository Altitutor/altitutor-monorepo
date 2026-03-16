'use client'

import { useMemo, useState } from 'react'
import type { DataTableSortOption } from '@altitutor/shared'
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
  useToast,
} from '@altitutor/ui'
import { ChevronDown, ChevronRight, Pencil, Trash2 } from 'lucide-react'
import { useUcatAccess } from '@/features/ucat/shared/hooks/useUcatAccess'
import { UcatAccessDenied, UcatPageHeader, UcatPageSkeleton } from '@/features/ucat/shared/components'
import { applySort, useUcatTableState } from '@/features/ucat/shared/hooks/useUcatTableState'
import {
  useCreateUcatQuestionTag,
  useDeleteUcatQuestionTag,
  useUcatQuestionTags,
  useUpdateUcatQuestionTag,
} from '@/features/ucat/question-tags/hooks/useUcatQuestionTags'
import { UcatDeleteConfirmDialog } from '@/features/ucat/shared/delete-confirm-dialog'
import { UcatRowActions } from '@/features/ucat/shared/row-actions'
import { UcatDialogShell } from '@/features/ucat/shared/dialog-shell'
import { proseMirrorToPlainText } from '@/features/ucat/shared/lib/rich-text'

type TagRow = {
  id: string
  name: string
  parent_id: string | null
  description: string
  question_count: number
}

type TagDraft = {
  name: string
  parentTagId: string
  description: string
}

const emptyDraft: TagDraft = {
  name: '',
  parentTagId: 'none',
  description: '',
}

const tagSortOptions: DataTableSortOption[] = [
  { key: 'name', label: 'Name' },
  { key: 'question_count', label: 'Number of questions' },
]

function buildTagTree(
  rows: TagRow[],
  expanded: Set<string>,
  parentId: string | null,
  level: number,
  sortBy: string | null,
  sortDirection: 'asc' | 'desc'
): Array<{ row: TagRow; level: number }> {
  const out: Array<{ row: TagRow; level: number }> = []
  let children = rows.filter((r) => (parentId === null ? !r.parent_id : r.parent_id === parentId))
  children = applySort(children, sortBy, sortDirection, {
    name: (r) => r.name,
    question_count: (r) => r.question_count,
  })
  for (const row of children) {
    out.push({ row, level })
    if (expanded.has(row.id)) {
      out.push(...buildTagTree(rows, expanded, row.id, level + 1, sortBy, sortDirection))
    }
  }
  return out
}

export function UcatQuestionTagsPage() {
  const access = useUcatAccess()
  const tags = useUcatQuestionTags()
  const { toast } = useToast()
  const createTag = useCreateUcatQuestionTag()
  const updateTag = useUpdateUcatQuestionTag()
  const deleteTag = useDeleteUcatQuestionTag()
  const tableState = useUcatTableState(['name', 'question_count', 'actions'])

  const [createOpen, setCreateOpen] = useState(false)
  const [editing, setEditing] = useState<TagRow | null>(null)
  const [deletingTagId, setDeletingTagId] = useState<string | null>(null)
  const [draft, setDraft] = useState<TagDraft>(emptyDraft)
  const [expandedTags, setExpandedTags] = useState<Set<string>>(new Set())

  const rows: TagRow[] = useMemo(() => {
    const data = tags.data ?? []
    return data.map((tag) => {
      const t = tag as typeof tag & { question_count?: number }
      return {
        id: t.id ?? '',
        name: t.name ?? '-',
        parent_id: t.parent_question_tag_id,
        description: proseMirrorToPlainText(t.description),
        question_count: t.question_count ?? 0,
      }
    })
  }, [tags.data])

  const filteredRows = useMemo(() => {
    const search = tableState.state.search.trim().toLowerCase()
    return rows.filter(
      (row) =>
        search.length === 0 || row.name.toLowerCase().includes(search)
    )
  }, [rows, tableState.state.search])

  const flatTree = useMemo(
    () =>
      buildTagTree(
        filteredRows,
        expandedTags,
        null,
        0,
        tableState.state.sortBy,
        tableState.state.sortDirection
      ),
    [filteredRows, expandedTags, tableState.state.sortBy, tableState.state.sortDirection]
  )

  const parentOptions = useMemo(
    () => rows.filter((r) => r.id !== editing?.id),
    [rows, editing?.id]
  )

  const toggleExpanded = (id: string) => {
    setExpandedTags((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const hasChildren = (row: TagRow) => filteredRows.some((r) => r.parent_id === row.id)

  if (access.isLoading || tags.isLoading) return <UcatPageSkeleton rows={8} />
  if (!access.data) return <UcatAccessDenied />

  async function create() {
    const result = await createTag.mutateAsync({
      name: draft.name,
      description: draft.description,
      parentTagId: draft.parentTagId === 'none' ? null : draft.parentTagId,
    })
    const tagName = draft.name.trim() || 'Untitled'
    const createdRow: TagRow = {
      id: result.id,
      name: draft.name,
      parent_id: draft.parentTagId === 'none' ? null : draft.parentTagId,
      description: draft.description,
      question_count: 0,
    }
    setCreateOpen(false)
    setDraft(emptyDraft)
    toast({
      title: `Tag ${tagName} created`,
      description: (
        <button
          type="button"
          onClick={() => {
            setEditing(createdRow)
            setDraft({
              name: createdRow.name,
              parentTagId: createdRow.parent_id ?? 'none',
              description: createdRow.description,
            })
          }}
          className="underline font-medium hover:no-underline text-left"
        >
          View tag
        </button>
      ),
    })
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
        columnDefinitions={[
          { key: 'name', label: 'Name', visibleByDefault: true },
          { key: 'question_count', label: 'Number of questions', visibleByDefault: true },
          { key: 'actions', label: 'Actions', visibleByDefault: true },
        ]}
        sortOptions={tagSortOptions}
        searchPlaceholder="Search tags"
      />

      <div className="pt-3">
        <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12" />
              <TableHead>Name</TableHead>
              <TableHead>Number of questions</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {flatTree.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center h-24 text-muted-foreground">
                  No tags match your filters
                </TableCell>
              </TableRow>
            ) : (
              flatTree.map(({ row, level }) => {
                const hasKids = hasChildren(row)
                const isExpanded = expandedTags.has(row.id)
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
                    <TableCell style={{ paddingLeft: `${level * 24 + 8}px` }}>{row.name}</TableCell>
                    <TableCell>{row.question_count}</TableCell>
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
                                  parentTagId: row.parent_id ?? 'none',
                                  description: row.description,
                                })
                              },
                            },
                            {
                              label: 'Delete',
                              icon: <Trash2 className="h-4 w-4" />,
                              onClick: () => setDeletingTagId(row.id),
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
        title="Create Tag"
        subtitle="Add a new question tag"
        onSave={create}
        saveLabel="Create"
        saveDisabled={createTag.isPending}
        isSaving={createTag.isPending}
      >
        <div className="p-6 overflow-y-auto h-full">
          <TagForm draft={draft} setDraft={setDraft} parentOptions={parentOptions} />
        </div>
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
        <div className="p-6 overflow-y-auto h-full">
          <TagForm draft={draft} setDraft={setDraft} parentOptions={parentOptions} />
        </div>
      </UcatDialogShell>
      <UcatDeleteConfirmDialog
        open={!!deletingTagId}
        onOpenChange={(open) => !open && setDeletingTagId(null)}
        title="Delete tag?"
        description="This action cannot be undone."
        onConfirm={async () => { if (deletingTagId) await deleteTag.mutateAsync(deletingTagId) }}
        isPending={deleteTag.isPending}
      />
    </div>
  )
}

function TagForm({
  draft,
  setDraft,
  parentOptions,
}: {
  draft: TagDraft
  setDraft: React.Dispatch<React.SetStateAction<TagDraft>>
  parentOptions: TagRow[]
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
