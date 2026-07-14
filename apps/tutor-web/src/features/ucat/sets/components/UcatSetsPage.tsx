'use client'

import { useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
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
import { CheckCircle2, FilePenLine, ListChecks, Pencil, RotateCcw, Send, Trash2 } from 'lucide-react'
import { useUcatSections } from '@/features/ucat/sections/hooks/useUcatSections'
import { useCreateUcatSet, useDeleteUcatSet, useRestoreUcatSet, useSetUcatSetStatus, useUcatSets, useUpdateUcatSet } from '@/features/ucat/sets/hooks/useUcatSets'
import { useUcatMocks } from '@/features/ucat/mocks/hooks/useUcatMocks'
import {
  useUcatCategories,
  useUcatStemCatalog,
} from '@/features/ucat/questions/hooks/useUcatQuestions'
import { UcatAccessDenied, UcatPageHeader, UcatPageSkeleton } from '@/features/ucat/shared/components'
import { useUcatAccess } from '@/features/ucat/shared/hooks/useUcatAccess'
import { UCAT_CONTENT_STATUS_OPTIONS, type UcatContentStatus, type UcatQuestionSetPayload } from '@/features/ucat/shared/types'
import { UcatRowActions } from '@/features/ucat/shared/row-actions'
import { minutesSecondsToTotal } from '@/features/ucat/shared/lib/time-utils'
import { UcatSetEditorDialog } from '@/features/ucat/sets/components/UcatSetEditorDialog'
import { UcatDeleteConfirmDialog } from '@/features/ucat/shared/delete-confirm-dialog'
import { UcatDialogShell } from '@/features/ucat/shared/dialog-shell'
import { plainTextToProseMirror } from '@/features/ucat/shared/lib/rich-text'
import { UCAT_FILTER_NOT_IN_ANY_MOCK } from '@/features/ucat/shared/lib/table-filter-sentinel'
import { UcatSelectionToolbar } from '@/features/ucat/shared/selection-toolbar'
import { useUcatSetsTable, type SetRow } from '@/features/ucat/sets/hooks/useUcatSetsTable'
import { ucatSetsApi } from '@/features/ucat/sets/api/sets'
import {
  buildAutoSetPreview,
  positiveIntFromInput,
  type AutoCategoryRow,
  type AutoSetMode,
  type AutoStemVisibility,
} from '@/features/ucat/sets/lib/auto-set-builder'
import { setDetailToUpdatePayload } from '@/features/ucat/sets/lib/set-payload-mappers'
import { useUcatRowSelection } from '@/features/ucat/shared/hooks/useUcatRowSelection'
import { ucatKeys } from '@/features/ucat/shared/lib/query-keys'
import { cn } from '@/shared/utils'
import { tutorBtnOutline, tutorBtnPrimary, tutorDataTableProps, tutorToolbarProps } from '@/shared/lib/tutor-visual'
import { SegmentedControl } from '@/shared/components/segmented-control'
import { lifecycleErrorToast } from '@/features/ucat/shared/lifecycle-errors'

function parseStatusTab(value: string | null): UcatContentStatus {
  return value === 'in_review' || value === 'published' ? value : 'draft'
}

const columnDefinitions: DataTableColumnDefinition[] = [
  { key: 'name', label: 'Name', visibleByDefault: true },
  { key: 'sections', label: 'Sections', visibleByDefault: true },
  { key: 'time_limit_seconds', label: 'Time Limit', visibleByDefault: true },
  { key: 'stem_count', label: 'Question stems', visibleByDefault: true },
  { key: 'question_count', label: 'Questions', visibleByDefault: true },
  { key: 'mocks', label: 'Mocks', visibleByDefault: true },
  { key: 'visibility', label: 'Visibility', visibleByDefault: false },
  { key: 'created_by', label: 'Created by', visibleByDefault: true },
  { key: 'actions', label: 'Actions', visibleByDefault: true },
]

const sortOptions: DataTableSortOption[] = [
  { key: 'name', label: 'Name' },
  { key: 'sections', label: 'Sections' },
  { key: 'time_limit_seconds', label: 'Time Limit' },
  { key: 'stem_count', label: 'Question stems' },
  { key: 'question_count', label: 'Questions' },
  { key: 'mocks', label: 'Mocks' },
  { key: 'visibility', label: 'Visibility' },
  { key: 'created_by', label: 'Created by' },
]

function countSetsInMocks(setIds: string[], rows: SetRow[]): number {
  return setIds.filter((id) => (rows.find((r) => r.id === id)?.ucat_mock_ids.length ?? 0) > 0).length
}

export function UcatSetsPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const activeStatus = parseStatusTab(searchParams.get('tab'))
  const queryClient = useQueryClient()
  const access = useUcatAccess()
  const sets = useUcatSets()
  const sectionsQuery = useUcatSections()
  const sections = useMemo(() => sectionsQuery.data ?? [], [sectionsQuery.data])
  const categoriesQuery = useUcatCategories()
  const createSet = useCreateUcatSet()
  const deleteSet = useDeleteUcatSet()
  const restoreSet = useRestoreUcatSet()
  const setStatus = useSetUcatSetStatus()
  const [openCreate, setOpenCreate] = useState(false)
  const [editingSetId, setEditingSetId] = useState<string | null>(null)
  const [deletingSetId, setDeletingSetId] = useState<string | null>(null)
  const [form, setForm] = useState({
    name: '',
    description: '',
    isTimed: false,
    timeLimitMinutes: '',
    timeLimitSeconds: '',
    isPrivate: false,
  })
  const [autoCriteriaEnabled, setAutoCriteriaEnabled] = useState(false)
  const [autoSectionId, setAutoSectionId] = useState<string | null>(null)
  const [autoMode, setAutoMode] = useState<AutoSetMode>('total')
  const [autoTargetTotal, setAutoTargetTotal] = useState('')
  const [autoCategoryTargets, setAutoCategoryTargets] = useState<Record<string, string>>({})
  const [autoStemVisibility, setAutoStemVisibility] = useState<AutoStemVisibility>('either')
  const [autoOnlyNotInAnotherSet, setAutoOnlyNotInAnotherSet] = useState(true)
  const [autoSeed, setAutoSeed] = useState(1)
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [bulkVisibilityOpen, setBulkVisibilityOpen] = useState(false)
  const [bulkVisibilityPrivate, setBulkVisibilityPrivate] = useState<boolean | null>(null)
  const [bulkStatusOpen, setBulkStatusOpen] = useState(false)
  const [bulkStatus, setBulkStatus] = useState<UcatContentStatus | null>(null)
  const [bulkStatusPending, setBulkStatusPending] = useState(false)
  const [bulkDeletePending, setBulkDeletePending] = useState(false)
  const [singleDeletePending, setSingleDeletePending] = useState(false)
  const [mockFilterSearch, setMockFilterSearch] = useState('')
  const updateSetMutation = useUpdateUcatSet()
  const mocksQuery = useUcatMocks()
  const stemCatalogQuery = useUcatStemCatalog(openCreate && autoCriteriaEnabled)
  const stemCatalog = useMemo(() => stemCatalogQuery.data ?? [], [stemCatalogQuery.data])

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
        nullOptionLabel: 'Untimed',
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

  const { rows, visibleColumns, tableState, showDeleted, setShowDeleted } = useUcatSetsTable({
    data: sets.data,
    defaultFilters: {},
    sections,
    mocks: mocksQuery.data ?? [],
    initialVisibleColumns: columnDefinitions.filter((c) => c.visibleByDefault).map((c) => c.key),
    status: activeStatus,
  })

  function changeStatusTab(status: UcatContentStatus) {
    const params = new URLSearchParams(searchParams.toString())
    if (status === 'draft') params.delete('tab')
    else params.set('tab', status)
    const query = params.toString()
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
    clearSelection()
  }

  const { page, pageSize } = tableState.state
  const totalRows = rows.length
  const pageCount = Math.max(1, Math.ceil(totalRows / pageSize))
  const effectivePage = Math.min(page, pageCount)
  const paginatedRows = rows.slice((effectivePage - 1) * pageSize, effectivePage * pageSize)

  const {
    selectedIds: selectedSetIds,
    selectedIdsArray: selectedSetIdsArray,
    selectionMode,
    allVisibleSelected,
    someVisibleSelected,
    toggleSelection: toggleSetSelection,
    toggleSelectAllVisible,
    clearSelection,
  } = useUcatRowSelection(paginatedRows)

  async function handleBulkVisibilityConfirm() {
    if (bulkVisibilityPrivate == null) return
    const ids = Array.from(selectedSetIds)
    for (const setId of ids) {
      const detail = await ucatSetsApi.detail(setId)
      if (!detail) continue
      await updateSetMutation.mutateAsync({
        setId,
        payload: setDetailToUpdatePayload(detail, {
          accessScope: bulkVisibilityPrivate ? 'private' : 'public',
        }),
      })
    }
    setBulkVisibilityOpen(false)
    setBulkVisibilityPrivate(null)
    clearSelection()
  }

  const { toast } = useToast()

  const bulkDeleteInMocksCount = countSetsInMocks(selectedSetIdsArray, rows)
  const singleDeleteInMocksCount = deletingSetId
    ? (rows.find((r) => r.id === deletingSetId)?.ucat_mock_ids.length ?? 0)
    : 0
  const autoSectionCategories = useMemo(
    () =>
      ((categoriesQuery.data ?? []) as AutoCategoryRow[])
        .filter((category) => category.id && category.ucat_section_id === autoSectionId)
        .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '')),
    [autoSectionId, categoriesQuery.data],
  )
  const autoTargetQuestions = autoMode === 'total'
    ? positiveIntFromInput(autoTargetTotal)
    : Object.values(autoCategoryTargets).reduce((sum, value) => sum + positiveIntFromInput(value), 0)
  const autoCriteriaReady = !autoCriteriaEnabled || (!!autoSectionId && autoTargetQuestions > 0)
  const autoPreview = useMemo(
    () =>
      autoCriteriaEnabled
        ? buildAutoSetPreview({
            mode: autoMode,
            targetTotal: positiveIntFromInput(autoTargetTotal),
            categoryTargets: autoCategoryTargets,
            sectionId: autoSectionId,
            stemVisibility: autoStemVisibility,
            onlyNotInAnotherSet: autoOnlyNotInAnotherSet,
            categories: (categoriesQuery.data ?? []) as AutoCategoryRow[],
            stems: stemCatalog,
            seed: autoSeed,
          })
        : null,
    [
      autoCategoryTargets,
      autoCriteriaEnabled,
      autoMode,
      autoOnlyNotInAnotherSet,
      autoSectionId,
      autoSeed,
      autoStemVisibility,
      autoTargetTotal,
      categoriesQuery.data,
      stemCatalog,
    ],
  )
  const autoPrivateStemCount =
    autoPreview?.selectedStems.filter((stem) => stem.accessScope === 'private').length ?? 0
  const autoCreateDisabled =
    autoCriteriaEnabled &&
    (!autoCriteriaReady ||
      stemCatalogQuery.isLoading ||
      !autoPreview ||
      autoPreview.selectedStems.length === 0 ||
      autoPreview.totalQuestions <= 0)

  async function invalidateSetsListQueries(setIds: string[] = []) {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ucatKeys.sets() }),
      queryClient.invalidateQueries({ queryKey: ucatKeys.mocks() }),
      ...setIds.map((setId) => queryClient.invalidateQueries({ queryKey: ucatKeys.set(setId) })),
      ...setIds.flatMap((setId) => {
        const row = rows.find((r) => r.id === setId)
        return (row?.ucat_mock_ids ?? []).map((mockId) =>
          queryClient.invalidateQueries({ queryKey: ucatKeys.mock(mockId) }),
        )
      }),
    ])
  }

  function changeSetStatus(setId: string, status: UcatContentStatus, title: string) {
    void setStatus.mutateAsync({ setId, status }).catch((error) => {
      toast(lifecycleErrorToast(error, title, router.push))
    })
  }

  async function handleBulkStatusConfirm() {
    if (!bulkStatus) return
    const ids = Array.from(selectedSetIds)
    setBulkStatusPending(true)
    try {
      await ucatSetsApi.bulkSetStatus(ids, bulkStatus)
      await invalidateSetsListQueries(ids)
      setBulkStatusOpen(false)
      setBulkStatus(null)
      clearSelection()
    } catch (error) {
      toast(lifecycleErrorToast(error, 'Cannot move selected sets', router.push))
    } finally {
      setBulkStatusPending(false)
    }
  }

  function resetCreateForm() {
    setForm({
      name: '',
      description: '',
      isTimed: false,
      timeLimitMinutes: '',
      timeLimitSeconds: '',
      isPrivate: false,
    })
    setAutoCriteriaEnabled(false)
    setAutoSectionId(null)
    setAutoMode('total')
    setAutoTargetTotal('')
    setAutoCategoryTargets({})
    setAutoStemVisibility('either')
    setAutoOnlyNotInAnotherSet(true)
    setAutoSeed((prev) => prev + 1)
  }

  function showSetDeleteSuccessToast(setIds: string[]) {
    const count = setIds.length
    toast({
      title: count === 1 ? 'Set deleted' : `${count} sets deleted`,
      description: 'Tap Undo to restore.',
      duration: 10_000,
      action: {
        label: 'Undo',
        onClick: () => {
          void (async () => {
            try {
              await Promise.all(setIds.map((id) => restoreSet.mutateAsync(id)))
              await invalidateSetsListQueries(setIds)
              toast({
                title: count === 1 ? 'Set restored' : `${count} sets restored`,
              })
            } catch (err) {
              toast({
                title: 'Could not undo',
                description: err instanceof Error ? err.message : 'Failed to restore sets.',
                variant: 'destructive',
              })
            }
          })()
        },
      },
    })
  }

  async function deleteSetsWithMockRemoval(setIds: string[]) {
    if (setIds.length === 1) {
      await deleteSet.mutateAsync(setIds[0])
    } else {
      await ucatSetsApi.bulkRemove(setIds)
    }
    await invalidateSetsListQueries(setIds)
    showSetDeleteSuccessToast(setIds)
  }

  async function handleBulkDeleteConfirm() {
    const ids = Array.from(selectedSetIds)
    setBulkDeletePending(true)
    try {
      await deleteSetsWithMockRemoval(ids)
      setBulkDeleteOpen(false)
      clearSelection()
    } catch (err) {
      toast({
        title: 'Cannot delete',
        description: err instanceof Error ? err.message : 'Failed to delete sets.',
        variant: 'destructive',
      })
      throw err
    } finally {
      setBulkDeletePending(false)
    }
  }

  async function onCreate() {
    const timeLimitSeconds = form.isTimed
      ? minutesSecondsToTotal(form.timeLimitMinutes, form.timeLimitSeconds)
      : null
    const stemIds = autoCriteriaEnabled ? (autoPreview?.selectedStems.map((stem) => stem.id) ?? []) : []
    const payload: UcatQuestionSetPayload = {
      name: plainTextToProseMirror(form.name),
      description: form.description,
      timeLimitSeconds,
      accessScope: form.isPrivate ? 'private' : 'public',
      stemIds,
    }
    const result = await createSet.mutateAsync(payload)
    const setName = form.name.trim() || 'Untitled'
    setOpenCreate(false)
    resetCreateForm()
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
        description="Draft, review, and publish UCAT question sets"
        backHref="/ucat"
        breadcrumbs={[{ label: 'UCAT', href: '/ucat' }, { label: 'Sets' }]}
        actions={
          <Button className={tutorBtnPrimary} onClick={() => setOpenCreate(true)}>
            Add Set
          </Button>
        }
      />

      <SegmentedControl
        className="w-fit max-w-full"
        value={activeStatus}
        onValueChange={(value) => changeStatusTab(parseStatusTab(value))}
        options={[
          { value: 'draft', label: 'Draft' },
          { value: 'in_review', label: 'In review' },
          { value: 'published', label: 'Published' },
        ]}
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
        {...tutorToolbarProps}
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
              className={cn(tutorBtnOutline, 'w-full justify-center')}
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
                const name = [r.created_by_first_name, r.created_by_last_name].filter(Boolean).join(' ') || '—'
                return <span>{name}</span>
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
                        ...(!showDeleted && r.status === 'draft'
                          ? [{ label: 'Send for review', icon: <Send className="h-4 w-4" />, onClick: () => changeSetStatus(r.id, 'in_review', 'Cannot send for review') }]
                          : []),
                        ...(!showDeleted && r.status === 'in_review'
                          ? [
                              { label: 'Publish', icon: <CheckCircle2 className="h-4 w-4" />, onClick: () => changeSetStatus(r.id, 'published', 'Cannot publish') },
                              { label: 'Return to draft', icon: <FilePenLine className="h-4 w-4" />, onClick: () => changeSetStatus(r.id, 'draft', 'Cannot return to draft') },
                            ]
                          : []),
                        ...(!showDeleted && r.status === 'published'
                          ? [
                              { label: 'Move to review', icon: <ListChecks className="h-4 w-4" />, onClick: () => changeSetStatus(r.id, 'in_review', 'Cannot move set') },
                              { label: 'Move to draft', icon: <FilePenLine className="h-4 w-4" />, onClick: () => changeSetStatus(r.id, 'draft', 'Cannot move set') },
                            ]
                          : []),
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
        onCancel={clearSelection}
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
            <Button variant="outline" size="sm" className={tutorBtnOutline}>
              Visibility
            </Button>
          }
          contentWidth="160px"
          align="start"
          side="top"
        />
        <SearchableSelect<{ value: UcatContentStatus; label: string }>
          items={UCAT_CONTENT_STATUS_OPTIONS}
          value={null}
          onValueChange={(item) => {
            if (!item) return
            setBulkStatus(item.value)
            setBulkStatusOpen(true)
          }}
          getItemId={(item) => item.value}
          getItemLabel={(item) => item.label}
          placeholder="Status"
          searchPlaceholder="Search statuses..."
          emptyMessage="No status found"
          trigger={
            <Button variant="outline" size="sm" className={tutorBtnOutline}>
              Status
            </Button>
          }
          contentWidth="180px"
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
      <AlertDialog open={bulkStatusOpen} onOpenChange={setBulkStatusOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Move {selectedSetIds.size} set(s) to {bulkStatus?.replace('_', ' ')}?</AlertDialogTitle>
            <AlertDialogDescription>
              The whole selection will be validated first. If any set is blocked, none of the statuses will change.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkStatusPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleBulkStatusConfirm()} disabled={bulkStatusPending}>
              {bulkStatusPending ? 'Moving...' : 'Move sets'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <UcatDeleteConfirmDialog
        open={bulkDeleteOpen}
        onOpenChange={(open) => !open && setBulkDeleteOpen(false)}
        title={`Delete ${selectedSetIds.size} set(s)?`}
        description={
          bulkDeleteInMocksCount > 0
            ? `${bulkDeleteInMocksCount} of the selected set(s) are in one or more mocks. Remove them from those mocks before deleting. No mock membership will be changed automatically.`
            : 'The selected sets will be hidden from students. You can restore them later from the deleted list.'
        }
        onConfirm={handleBulkDeleteConfirm}
        isPending={bulkDeletePending}
      />

      <UcatDialogShell
        open={openCreate}
        onClose={() => {
          setOpenCreate(false)
          resetCreateForm()
        }}
        title="Create Set"
        subtitle="Create a new UCAT set"
        onSave={onCreate}
        saveLabel="Create"
        saveDisabled={
          createSet.isPending ||
          autoCreateDisabled ||
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
          <div className="block text-sm">
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
          </div>
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
          <div className="space-y-4 rounded-md border p-4">
            <label className="flex items-start gap-3 text-sm">
              <Checkbox
                checked={autoCriteriaEnabled}
                onCheckedChange={(checked) => {
                  setAutoCriteriaEnabled(checked === true)
                  setAutoSeed((prev) => prev + 1)
                }}
                className="mt-0.5"
              />
              <span>
                <span className="block font-medium">Automatically add questions based on criteria</span>
                <span className="block text-xs text-muted-foreground">
                  Selects whole approved stems. Exact question totals may not be possible.
                </span>
              </span>
            </label>

            {autoCriteriaEnabled ? (
              <div className="space-y-4 border-t pt-4">
                <label className="block text-sm">
                  <span className="mb-1 block font-medium">Section</span>
                  <SearchableSelect<(typeof sections)[number]>
                    items={sections}
                    value={sections.find((section) => (section.id ?? '') === (autoSectionId ?? '')) ?? null}
                    onValueChange={(section) => {
                      setAutoSectionId(section?.id ?? null)
                      setAutoCategoryTargets({})
                      setAutoSeed((prev) => prev + 1)
                    }}
                    getItemLabel={(section) => section.name ?? 'Untitled'}
                    getItemId={(section) => section.id ?? ''}
                    placeholder="Select section"
                  />
                </label>

                {autoSectionId ? (
                  <>
                    <label className="block text-sm">
                      <span className="mb-1 block font-medium">Question targets</span>
                      <SearchableSelect<{ value: AutoSetMode; label: string }>
                        items={[
                          { value: 'total', label: 'Total only' },
                          { value: 'category', label: 'By category' },
                        ]}
                        value={
                          autoMode === 'category'
                            ? { value: 'category', label: 'By category' }
                            : { value: 'total', label: 'Total only' }
                        }
                        onValueChange={(item) => {
                          if (!item) return
                          setAutoMode(item.value)
                          setAutoSeed((prev) => prev + 1)
                        }}
                        getItemLabel={(item) => item.label}
                        getItemId={(item) => item.value}
                      />
                    </label>

                    {autoMode === 'total' ? (
                      <label className="block text-sm">
                        <span className="mb-1 block font-medium">Total questions</span>
                        <Input
                          type="number"
                          min={1}
                          value={autoTargetTotal}
                          onChange={(event) => {
                            setAutoTargetTotal(event.target.value)
                            setAutoSeed((prev) => prev + 1)
                          }}
                          placeholder="e.g. 20"
                        />
                      </label>
                    ) : (
                      <div className="space-y-2">
                        <div className="text-sm font-medium">Questions by category</div>
                        {autoSectionCategories.length === 0 ? (
                          <p className="text-xs text-muted-foreground">No categories are configured for this section.</p>
                        ) : (
                          autoSectionCategories.map((category) => {
                            const id = category.id ?? ''
                            const previewRow = autoPreview?.byCategory.find((row) => row.categoryId === id)
                            const eligibleCount =
                              previewRow?.eligibleStemCount ??
                              stemCatalog.filter(
                                (stem) =>
                                  stem.sectionId === autoSectionId &&
                                  stem.categoryId === id &&
                                  stem.questionsCount > 0 &&
                                  (autoStemVisibility === 'either' ||
                                    (autoStemVisibility === 'public'
                                      ? stem.accessScope === 'public'
                                      : stem.accessScope === 'private')) &&
                                  (!autoOnlyNotInAnotherSet || stem.setIds.length === 0),
                              ).length
                            return (
                              <label key={id} className="grid grid-cols-[1fr_5rem] items-center gap-3 text-sm">
                                <span className="min-w-0">
                                  <span className="block truncate">{category.name ?? 'Untitled category'}</span>
                                  <span className="block text-xs text-muted-foreground">
                                    {eligibleCount} eligible {eligibleCount === 1 ? 'stem' : 'stems'}
                                  </span>
                                </span>
                                <Input
                                  type="number"
                                  min={0}
                                  value={autoCategoryTargets[id] ?? ''}
                                  onChange={(event) => {
                                    setAutoCategoryTargets((prev) => ({
                                      ...prev,
                                      [id]: event.target.value,
                                    }))
                                    setAutoSeed((prev) => prev + 1)
                                  }}
                                  placeholder="0"
                                />
                              </label>
                            )
                          })
                        )}
                      </div>
                    )}

                    <label className="block text-sm">
                      <span className="mb-1 block font-medium">Stem visibility</span>
                      <SearchableSelect<{ value: AutoStemVisibility; label: string }>
                        items={[
                          { value: 'either', label: 'Either' },
                          { value: 'public', label: 'Public' },
                          { value: 'private', label: 'Private' },
                        ]}
                        value={
                          autoStemVisibility === 'public'
                            ? { value: 'public', label: 'Public' }
                            : autoStemVisibility === 'private'
                              ? { value: 'private', label: 'Private' }
                              : { value: 'either', label: 'Either' }
                        }
                        onValueChange={(item) => {
                          if (!item) return
                          setAutoStemVisibility(item.value)
                          setAutoSeed((prev) => prev + 1)
                        }}
                        getItemLabel={(item) => item.label}
                        getItemId={(item) => item.value}
                      />
                    </label>

                    <label className="flex items-start gap-3 text-sm">
                      <Checkbox
                        checked={autoOnlyNotInAnotherSet}
                        onCheckedChange={(checked) => {
                          setAutoOnlyNotInAnotherSet(checked === true)
                          setAutoSeed((prev) => prev + 1)
                        }}
                        className="mt-0.5"
                      />
                      <span>
                        <span className="block font-medium">Only include stems not already in another set</span>
                        <span className="block text-xs text-muted-foreground">
                          Checks non-deleted staff-authored sets, including private sets.
                        </span>
                      </span>
                    </label>
                  </>
                ) : null}

                <div className="rounded-md border bg-muted/20 p-3 text-sm">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <span className="font-medium">Live preview</span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setAutoSeed((prev) => prev + 1)}
                    >
                      Refresh
                    </Button>
                  </div>
                  {stemCatalogQuery.isLoading ? (
                    <p className="text-xs text-muted-foreground">Loading eligible stems...</p>
                  ) : !autoSectionId ? (
                    <p className="text-xs text-muted-foreground">Select a section to preview stems.</p>
                  ) : autoTargetQuestions <= 0 ? (
                    <p className="text-xs text-muted-foreground">Enter a positive question target to preview stems.</p>
                  ) : autoPreview ? (
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="secondary">{autoPreview.selectedStems.length} stems</Badge>
                        <Badge variant="secondary">
                          {autoPreview.totalQuestions} / {autoPreview.targetQuestions} questions
                        </Badge>
                      </div>
                      {autoMode === 'category' && autoPreview.byCategory.length > 0 ? (
                        <div className="space-y-1 text-xs text-muted-foreground">
                          {autoPreview.byCategory.map((row) => (
                            <div key={row.categoryId} className="flex justify-between gap-3">
                              <span className="truncate">{row.categoryName}</span>
                              <span className="shrink-0">
                                {row.actualQuestions} / {row.targetQuestions} questions
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : null}
                      {autoPreview.selectedStems.length > 0 ? (
                        <div className="max-h-36 space-y-1 overflow-y-auto border-t pt-2 text-xs">
                          {autoPreview.selectedStems.map((stem, index) => (
                            <div key={stem.id} className="flex gap-2">
                              <span className="w-5 shrink-0 text-muted-foreground">{index + 1}.</span>
                              <span className="min-w-0 flex-1 truncate">{stem.text || 'Untitled stem'}</span>
                              <span className="shrink-0 text-muted-foreground">{stem.questionsCount} q</span>
                            </div>
                          ))}
                        </div>
                      ) : null}
                      {!form.isPrivate && autoPrivateStemCount > 0 ? (
                        <p className="text-xs text-amber-700 dark:text-amber-400">
                          {autoPrivateStemCount} private {autoPrivateStemCount === 1 ? 'stem' : 'stems'} will be available through this public set.
                        </p>
                      ) : null}
                      {autoPreview.warnings.map((warning) => (
                        <p key={warning} className="text-xs text-amber-700 dark:text-amber-400">
                          {warning}
                        </p>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
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
        description={
          singleDeleteInMocksCount > 0
            ? `This set is in ${singleDeleteInMocksCount} mock(s). Remove it from those mocks before deleting. No mock membership will be changed automatically.`
            : 'The set will be hidden from students. You can restore it later from the deleted list.'
        }
        onConfirm={async () => {
          if (!deletingSetId) return
          setSingleDeletePending(true)
          try {
            await deleteSetsWithMockRemoval([deletingSetId])
            setEditingSetId((prev) => (prev === deletingSetId ? null : prev))
          } catch (err) {
            toast({
              title: 'Cannot delete',
              description: err instanceof Error ? err.message : 'Failed to delete set.',
              variant: 'destructive',
            })
            throw err
          } finally {
            setSingleDeletePending(false)
          }
        }}
        isPending={singleDeletePending}
      />
    </div>
  )
}
