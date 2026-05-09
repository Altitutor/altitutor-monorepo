'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import type { DataTableColumnDefinition, DataTableFilterDefinition, DataTableSortOption } from '@altitutor/shared'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Badge,
  Button,
  Checkbox,
  DataTable,
  DataTableToolbar,
  Input,
  SearchableSelect,
  Switch,
  TablePagination,
  Textarea,
  useToast,
} from '@altitutor/ui'
import { Pencil, RotateCcw, Trash2 } from 'lucide-react'
import { useUcatSections } from '@/features/ucat/sections/hooks/useUcatSections'
import { useCreateUcatSet, useDeleteUcatSet, useRestoreUcatSet, useUcatSets, useUpdateUcatSet } from '@/features/ucat/sets/hooks/useUcatSets'
import { useUcatMocks } from '@/features/ucat/mocks/hooks/useUcatMocks'
import { UcatAccessDenied, UcatPageHeader, UcatPageSkeleton } from '@/features/ucat/shared/components'
import { useUcatAccess } from '@/features/ucat/shared/hooks/useUcatAccess'
import type { UcatQuestionSetPayload } from '@/features/ucat/shared/types'
import { UcatRowActions } from '@/features/ucat/shared/row-actions'
import { minutesSecondsToTotal } from '@/features/ucat/shared/lib/time-utils'
import { UcatSetEditorDialog } from '@/features/ucat/sets/components/UcatSetEditorDialog'
import { UcatDeleteConfirmDialog } from '@/features/ucat/shared/delete-confirm-dialog'
import { UcatDialogShell } from '@/features/ucat/shared/dialog-shell'
import { plainTextToProseMirror, proseMirrorToPlainText } from '@/features/ucat/shared/lib/rich-text'
import { UCAT_FILTER_NOT_IN_ANY_MOCK } from '@/features/ucat/shared/lib/table-filter-sentinel'
import { UcatSelectionToolbar } from '@/features/ucat/shared/selection-toolbar'
import { useUcatSetsTable, type SetRow } from '@/features/ucat/sets/hooks/useUcatSetsTable'
import { ucatSetsApi } from '@/features/ucat/sets/api/sets'
import { ucatKeys } from '@/features/ucat/shared/lib/query-keys'
import { cn } from '@/shared/utils'
import { tutorDataTableProps } from '@/shared/lib/tutor-visual'

const columnDefinitions: DataTableColumnDefinition[] = [
  { key: 'name', label: 'Name', visibleByDefault: true },
  { key: 'sections', label: 'Sections', visibleByDefault: true },
  { key: 'time_limit_seconds', label: 'Time Limit', visibleByDefault: true },
  { key: 'stem_count', label: 'Question stems', visibleByDefault: true },
  { key: 'question_count', label: 'Questions', visibleByDefault: true },
  { key: 'visibility', label: 'Visibility', visibleByDefault: true },
  { key: 'created_by', label: 'Created by', visibleByDefault: true },
  { key: 'actions', label: 'Actions', visibleByDefault: true },
]

const sortOptions: DataTableSortOption[] = [
  { key: 'name', label: 'Name' },
  { key: 'sections', label: 'Sections' },
  { key: 'time_limit_seconds', label: 'Time Limit' },
  { key: 'stem_count', label: 'Question stems' },
  { key: 'question_count', label: 'Questions' },
  { key: 'visibility', label: 'Visibility' },
  { key: 'created_by', label: 'Created by' },
]

export function UcatSetsPage() {
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()
  const access = useUcatAccess()
  const sets = useUcatSets()
  const sectionsQuery = useUcatSections()
  const sections = useMemo(() => sectionsQuery.data ?? [], [sectionsQuery.data])
  const createSet = useCreateUcatSet()
  const deleteSet = useDeleteUcatSet()
  const restoreSet = useRestoreUcatSet()
  const [showDeleted, setShowDeleted] = useState(false)

  const [openCreate, setOpenCreate] = useState(false)
  const [editingSetId, setEditingSetId] = useState<string | null>(null)
  const [deletingSetId, setDeletingSetId] = useState<string | null>(null)
  const [form, setForm] = useState({
    name: '',
    description: '',
    isTimed: true,
    timeLimitMinutes: '',
    timeLimitSeconds: '',
    isPrivate: false,
    isStudentGenerated: false,
  })
  const [selectedSetIds, setSelectedSetIds] = useState<Set<string>>(new Set())
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [bulkVisibilityOpen, setBulkVisibilityOpen] = useState(false)
  const [bulkVisibilityPrivate, setBulkVisibilityPrivate] = useState<boolean | null>(null)
  const [bulkDeletePending, setBulkDeletePending] = useState(false)
  const [mockFilterSearch, setMockFilterSearch] = useState('')
  const selectionMode = selectedSetIds.size > 0
  const updateSetMutation = useUpdateUcatSet()
  const mocksQuery = useUcatMocks()

  useEffect(() => {
    const editId = searchParams.get('edit')
    if (editId) setEditingSetId(editId)
  }, [searchParams])

  const mockFilterOptions = useMemo(() => {
    const list = (mocksQuery.data ?? []) as Array<{
      id: string | null
      name: string | null
      deleted_at?: string | null
    }>
    const active = list.filter((m) => m.deleted_at == null && m.id)
    const q = mockFilterSearch.trim().toLowerCase()
    const filtered = q ? active.filter((m) => (m.name ?? '').toLowerCase().includes(q)) : active
    const fromMocks = filtered
      .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''))
      .map((m) => ({ label: m.name ?? 'Untitled', value: m.id as string }))
    const noneOption = { label: 'Not in any mock', value: UCAT_FILTER_NOT_IN_ANY_MOCK }
    const combined = [noneOption, ...fromMocks]
    if (!q) return combined
    return combined.filter((o) => o.label.toLowerCase().includes(q))
  }, [mocksQuery.data, mockFilterSearch])

  const filterDefinitions = useMemo((): DataTableFilterDefinition[] => {
    return [
      {
        key: 'visibility',
        label: 'Visibility',
        options: [
          { label: 'Public', value: 'public' },
          { label: 'Private', value: 'private' },
        ],
      },
      {
        key: 'section',
        label: 'Section',
        options: [
          { label: 'All sections', value: 'all' },
          ...sections
            .filter((s) => s.section_number != null)
            .sort((a, b) => (a.section_number ?? 0) - (b.section_number ?? 0))
            .map((s) => ({
              label: `${s.name ?? `Section ${s.section_number}`}`,
              value: String(s.section_number),
            })),
        ],
      },
      {
        key: 'ucat_mock_id',
        label: 'Mock',
        options: mockFilterOptions,
        searchable: true,
        searchPlaceholder: 'Search mocks...',
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
  }, [sections, mockFilterOptions])

  const { rows, visibleColumns, tableState } = useUcatSetsTable({
    data: sets.data,
    showDeleted,
    defaultFilters: {},
    sections,
    initialVisibleColumns: columnDefinitions.filter((c) => c.visibleByDefault).map((c) => c.key),
  })

  const { page, pageSize } = tableState.state
  const totalRows = rows.length
  const pageCount = Math.max(1, Math.ceil(totalRows / pageSize))
  const effectivePage = Math.min(page, pageCount)
  const paginatedRows = rows.slice((effectivePage - 1) * pageSize, effectivePage * pageSize)

  function toggleSetSelection(id: string) {
    setSelectedSetIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const allVisibleSelected = paginatedRows.length > 0 && paginatedRows.every((r) => selectedSetIds.has(r.id))
  const someVisibleSelected = paginatedRows.some((r) => selectedSetIds.has(r.id))
  function toggleSelectAllVisible() {
    if (allVisibleSelected) {
      setSelectedSetIds((prev) => {
        const next = new Set(prev)
        paginatedRows.forEach((r) => next.delete(r.id))
        return next
      })
    } else {
      setSelectedSetIds((prev) => new Set([...prev, ...paginatedRows.map((r) => r.id)]))
    }
  }

  async function handleBulkVisibilityConfirm() {
    if (bulkVisibilityPrivate == null) return
    const ids = Array.from(selectedSetIds)
    for (const setId of ids) {
      const detail = await ucatSetsApi.detail(setId)
      if (!detail) continue
      const stems = (detail.stems as Array<{ stem_id: string }> | null) ?? []
      const stemIds = stems.map((s) => s.stem_id)
      await updateSetMutation.mutateAsync({
        setId,
        payload: {
          name: detail.name ?? plainTextToProseMirror(''),
          description: proseMirrorToPlainText(detail.description ?? null) ?? '',
          timeLimitSeconds: detail.time_limit_seconds ?? null,
          isPrivate: bulkVisibilityPrivate,
          isStudentGenerated: !!(detail as { is_student_generated?: boolean }).is_student_generated,
          stemIds,
        },
      })
    }
    setBulkVisibilityOpen(false)
    setBulkVisibilityPrivate(null)
    setSelectedSetIds(new Set())
  }

  const { toast } = useToast()
  async function handleBulkDeleteConfirm() {
    const ids = Array.from(selectedSetIds)
    setBulkDeletePending(true)
    try {
      await ucatSetsApi.bulkRemove(ids)
      await queryClient.invalidateQueries({ queryKey: ucatKeys.sets() })
      setBulkDeleteOpen(false)
      setSelectedSetIds(new Set())
    } catch (err) {
      toast({
        title: 'Cannot delete',
        description: err instanceof Error ? err.message : 'Failed to delete sets.',
        variant: 'destructive',
      })
    } finally {
      setBulkDeletePending(false)
    }
  }

  async function onCreate() {
    const timeLimitSeconds = form.isTimed
      ? minutesSecondsToTotal(form.timeLimitMinutes, form.timeLimitSeconds)
      : null
    const payload: UcatQuestionSetPayload = {
      name: plainTextToProseMirror(form.name),
      description: form.description,
      timeLimitSeconds,
      isPrivate: form.isPrivate,
      isStudentGenerated: false,
      stemIds: [],
    }
    const result = await createSet.mutateAsync(payload)
    const setName = form.name.trim() || 'Untitled'
    setOpenCreate(false)
    setForm({
      name: '',
      description: '',
      isTimed: true,
      timeLimitMinutes: '',
      timeLimitSeconds: '',
      isPrivate: false,
      isStudentGenerated: false,
    })
    if (result.id) setEditingSetId(result.id)
    toast({
      title: `Set ${setName} created`,
      description: (
        <button
          type="button"
          onClick={() => setEditingSetId(result.id)}
          className="underline font-medium hover:no-underline text-left"
        >
          View set
        </button>
      ),
    })
  }

  if (access.isLoading || sets.isLoading) return <UcatPageSkeleton rows={8} />
  if (!access.data) return <UcatAccessDenied />

  return (
    <div className="space-y-6 py-8 md:py-10">
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
        filterSearchValues={{ ucat_mock_id: mockFilterSearch }}
        onFilterSearchChange={(filterKey, value) => {
          if (filterKey === 'ucat_mock_id') setMockFilterSearch(value)
        }}
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

      <div className={cn('pt-3', selectionMode && 'pb-24')}>
        <DataTable
          {...tutorDataTableProps}
          columns={[
            {
              id: 'select',
              header: () => (
                <Checkbox
                  checked={allVisibleSelected ? true : someVisibleSelected ? 'indeterminate' : false}
                  onCheckedChange={toggleSelectAllVisible}
                  aria-label="Select all visible rows"
                />
              ),
              cell: ({ row }) => {
                const r = row.original as SetRow
                return (
                  <div onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selectedSetIds.has(r.id)}
                      onCheckedChange={() => toggleSetSelection(r.id)}
                      aria-label={`Select set ${r.id}`}
                    />
                  </div>
                )
              },
            },
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
                  <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
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
          data={paginatedRows}
          pagination="external"
          pageSizeOptions={[10, 20, 50]}
          getRowClassName={(row) => cn(row.deleted_at ? 'bg-destructive/10' : '', selectedSetIds.has(row.id) && 'bg-muted/50')}
          onRowClick={selectionMode ? (row) => toggleSetSelection(row.id) : undefined}
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

      <UcatSelectionToolbar
        selectedCount={selectedSetIds.size}
        onCancel={() => setSelectedSetIds(new Set())}
        onDelete={() => setBulkDeleteOpen(true)}
        deletePending={bulkDeletePending}
      >
        <SearchableSelect<{ value: boolean; label: string }>
          items={[
            { value: false, label: 'Public' },
            { value: true, label: 'Private' },
          ]}
          value={null}
          onValueChange={(item) => {
            if (item) {
              setBulkVisibilityPrivate(item.value);
              setBulkVisibilityOpen(true);
            }
          }}
          getItemId={(i) => (i.value ? 'private' : 'public')}
          getItemLabel={(i) => i.label}
          placeholder="Visibility"
          searchPlaceholder="Search..."
          emptyMessage="No options"
          trigger={
            <Button variant="outline" size="sm">
              Visibility
            </Button>
          }
          contentWidth="160px"
          align="start"
          side="top"
        />
      </UcatSelectionToolbar>

      <AlertDialog open={bulkVisibilityOpen} onOpenChange={setBulkVisibilityOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Set visibility for {selectedSetIds.size} set(s)?</AlertDialogTitle>
            <AlertDialogDescription>
              Visibility will be set to {bulkVisibilityPrivate ? 'Private' : 'Public'} for all selected sets.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleBulkVisibilityConfirm()}>
              Yes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <UcatDeleteConfirmDialog
        open={bulkDeleteOpen}
        onOpenChange={(open) => !open && setBulkDeleteOpen(false)}
        title={`Delete ${selectedSetIds.size} set(s)?`}
        description="The selected sets will be hidden from students. You can restore them later from the deleted list."
        onConfirm={handleBulkDeleteConfirm}
        isPending={bulkDeletePending}
      />

      <UcatDialogShell
        open={openCreate}
        onClose={() => setOpenCreate(false)}
        title="Create Set"
        subtitle="Create a new UCAT set"
        onSave={onCreate}
        saveLabel="Create"
        saveDisabled={
          createSet.isPending ||
          (form.isTimed &&
            ((t) => t == null || t <= 0)(minutesSecondsToTotal(form.timeLimitMinutes, form.timeLimitSeconds)))
        }
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
            <div className="mb-2 flex items-center justify-between">
              <span className="font-medium">Time limit</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Untimed</span>
                <Switch
                  checked={form.isTimed}
                  onCheckedChange={(v) =>
                    setForm((prev) => ({
                      ...prev,
                      isTimed: v,
                      ...(v ? {} : { timeLimitMinutes: '', timeLimitSeconds: '' }),
                    }))
                  }
                />
                <span className="text-xs text-muted-foreground">Timed</span>
              </div>
            </div>
            {form.isTimed && (
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={0}
                  placeholder="0"
                  className="w-20"
                  value={form.timeLimitMinutes}
                  onChange={(e) => setForm((prev) => ({ ...prev, timeLimitMinutes: e.target.value }))}
                />
                <span className="text-muted-foreground font-medium">:</span>
                <Input
                  type="number"
                  min={0}
                  max={59}
                  placeholder="0"
                  className="w-20"
                  value={form.timeLimitSeconds}
                  onChange={(e) => setForm((prev) => ({ ...prev, timeLimitSeconds: e.target.value }))}
                />
                <span className="text-muted-foreground text-xs">min : sec</span>
              </div>
            )}
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Visibility</span>
            <SearchableSelect<{ value: 'public' | 'private'; label: string }>
              items={[
                { value: 'public', label: 'Public' },
                { value: 'private', label: 'Private' },
              ]}
              value={form.isPrivate ? { value: 'private', label: 'Private' } : { value: 'public', label: 'Public' }}
              onValueChange={(item) => setForm((prev) => ({ ...prev, isPrivate: item?.value === 'private' }))}
              getItemLabel={(i) => i.label}
              getItemId={(i) => i.value}
            />
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
