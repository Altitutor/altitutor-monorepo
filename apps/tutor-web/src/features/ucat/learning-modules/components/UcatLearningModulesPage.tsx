'use client'

import { useCallback, useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import type { ColumnDef } from '@tanstack/react-table'
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
  Button,
  Checkbox,
  DataTable,
  DataTableToolbar,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Input,
  SearchableSelect,
  TablePagination,
  TableActions,
  useToast,
} from '@altitutor/ui'
import {
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ExternalLink,
  Eye,
  FilePenLine,
  Folder,
  ListChecks,
  Pencil,
  RotateCcw,
  Search,
  Send,
  Trash2,
} from 'lucide-react'
import { UcatAccessDenied, UcatPageHeader, UcatPageSkeleton } from '@/features/ucat/shared/components'
import { useUcatAccess } from '@/features/ucat/shared/hooks/useUcatAccess'
import { useUcatRowSelection } from '@/features/ucat/shared/hooks/useUcatRowSelection'
import { UcatRowActions, type UcatRowAction } from '@/features/ucat/shared/row-actions'
import { UcatCreateLearningModuleDialog } from '@/features/ucat/learning-modules/components/UcatCreateLearningModuleDialog'
import { UcatLearningModuleDialog } from '@/features/ucat/learning-modules/components/UcatLearningModuleDialog'
import { UcatLearningModuleFolderDialog } from '@/features/ucat/learning-modules/components/UcatLearningModuleFolderDialog'
import type { LearningModuleEditorMode } from '@/features/ucat/learning-modules/components/UcatLearningModuleSettingsPanel'
import {
  useDeleteUcatLearningModule,
  useRestoreUcatLearningModule,
  useUcatLearningModules,
  useReorderUcatLearningModules,
  useUpsertUcatLearningModule,
} from '@/features/ucat/learning-modules/hooks/useUcatLearningModules'
import {
  UCAT_LEARNING_MODULE_SECTION_NONE,
  useUcatLearningModulesTable,
  type LearningModuleLessonRow,
} from '@/features/ucat/learning-modules/hooks/useUcatLearningModulesTable'
import { ucatLearningModulesApi } from '@/features/ucat/learning-modules/api/modules'
import type { UcatLearningModuleKind, UcatLearningModuleRow } from '@/features/ucat/learning-modules/types'
import type { UcatLearningModuleTreeNode } from '@/features/ucat/learning-modules/types/tree'
import { useUcatSections } from '@/features/ucat/questions/hooks/useUcatQuestions'
import { TaxonomySectionDropZone } from '@/features/ucat/shared/components/taxonomy-hierarchy-tree'
import type { TaxonomyReparentTarget } from '@/features/ucat/shared/components/taxonomy-hierarchy-tree'
import { TaxonomyHierarchyDndProvider } from '@/features/ucat/shared/components/taxonomy-hierarchy-dnd'
import { isDescendantOf, resolveRootSectionId } from '@/features/ucat/shared/lib/taxonomy-reparent'
import {
  buildModuleSectionTreeNodes,
  filterModuleTreeNodes,
} from '@/features/ucat/learning-modules/lib/build-learning-module-tree'
import { getNextLearningModuleIndex } from '@/features/ucat/learning-modules/lib/get-next-learning-module-index'
import { mapLearningModuleTreeToTaxonomyNodes } from '@/features/ucat/learning-modules/lib/map-learning-module-tree'
import { LearningModuleHierarchyTree } from '@/features/ucat/learning-modules/components/LearningModuleHierarchyTree'
import { UcatDeleteConfirmDialog } from '@/features/ucat/shared/delete-confirm-dialog'
import { UcatSelectionToolbar } from '@/features/ucat/shared/selection-toolbar'
import {
  firstUcatBulkStatusFailureError,
  lifecycleErrorToast,
  lifecycleStatusSuccessToast,
} from '@/features/ucat/shared/lifecycle-errors'
import {
  getUcatContentStatusTransitionOptions,
  type UcatContentStatus,
} from '@/features/ucat/shared/types'
import { SegmentedControl } from '@/shared/components/segmented-control'
import { tutorBtnOutline, tutorCardCn, tutorDataTableProps, tutorToolbarProps } from '@/shared/lib/tutor-visual'
import { NEW_MODULE_PLACEHOLDER_ID } from '@/features/ucat/learning-modules/components/UcatCreateLearningModuleDialog'
import { useQueryClient } from '@tanstack/react-query'
import { ucatKeys } from '@/features/ucat/shared/lib/query-keys'
import { cn } from '@/shared/utils'

function parseStatusTab(value: string | null): UcatContentStatus {
  return value === 'in_review' || value === 'published' ? value : 'draft'
}

function parseViewMode(value: string | null): 'table' | 'hierarchy' {
  return value === 'hierarchy' ? 'hierarchy' : 'table'
}

const STATUS_TAB_OPTIONS = [
  { value: 'draft' as const, label: 'Draft' },
  { value: 'in_review' as const, label: 'In review' },
  { value: 'published' as const, label: 'Published' },
]

const VIEW_MODE_OPTIONS = [
  { value: 'table' as const, label: 'Table' },
  { value: 'hierarchy' as const, label: 'Hierarchy' },
]

const columnDefinitions: DataTableColumnDefinition[] = [
  { key: 'title', label: 'Title', visibleByDefault: true },
  { key: 'section', label: 'Section', visibleByDefault: true },
  { key: 'block_count', label: 'Blocks', visibleByDefault: true },
  { key: 'visibility', label: 'Visibility', visibleByDefault: true },
  { key: 'source', label: 'Source', visibleByDefault: false },
  { key: 'created_at', label: 'Date created', visibleByDefault: false },
  { key: 'updated_at', label: 'Updated', visibleByDefault: false },
  { key: 'status', label: 'Status', visibleByDefault: false },
  { key: 'actions', label: 'Actions', visibleByDefault: true },
]

const sortOptions: DataTableSortOption[] = [
  { key: 'title', label: 'Title' },
  { key: 'section', label: 'Section' },
  { key: 'block_count', label: 'Blocks' },
  { key: 'visibility', label: 'Visibility' },
  { key: 'source', label: 'Source' },
  { key: 'created_by', label: 'Created by' },
  { key: 'created_at', label: 'Date created' },
  { key: 'updated_at', label: 'Updated' },
  { key: 'status', label: 'Status' },
]

export function UcatLearningModulesPage() {
  const { toast } = useToast()
  const access = useUcatAccess()
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const queryClient = useQueryClient()
  const activeTab = parseStatusTab(searchParams.get('tab'))
  const viewMode = parseViewMode(searchParams.get('view'))
  const sectionsQuery = useUcatSections()
  const sections = useMemo(() => sectionsQuery.data ?? [], [sectionsQuery.data])
  const upsert = useUpsertUcatLearningModule()
  const deleteModule = useDeleteUcatLearningModule()
  const restoreModule = useRestoreUcatLearningModule()
  const reorderModules = useReorderUcatLearningModules()

  const [createOpen, setCreateOpen] = useState(false)
  const [editModuleId, setEditModuleId] = useState<string | null>(null)
  const [dialogEditorMode, setDialogEditorMode] = useState<LearningModuleEditorMode>('edit')
  const [folderDialogId, setFolderDialogId] = useState<string | null>(null)
  const [newKind, setNewKind] = useState<UcatLearningModuleKind>('lesson')
  const [newTitle, setNewTitle] = useState('')
  const [newSectionId, setNewSectionId] = useState<string | null>(null)
  const [newParentId, setNewParentId] = useState<string | null>(null)

  const [bulkVisibilityOpen, setBulkVisibilityOpen] = useState(false)
  const [bulkVisibilityPrivate, setBulkVisibilityPrivate] = useState<boolean | null>(null)
  const [bulkVisibilityPending, setBulkVisibilityPending] = useState(false)
  const [bulkStatusOpen, setBulkStatusOpen] = useState(false)
  const [bulkStatus, setBulkStatus] = useState<UcatContentStatus | null>(null)
  const [bulkStatusPending, setBulkStatusPending] = useState(false)
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [bulkDeletePending, setBulkDeletePending] = useState(false)

  const bulkStatusOptions = useMemo(
    () => getUcatContentStatusTransitionOptions(activeTab),
    [activeTab],
  )

  const modulesQuery = useUcatLearningModules()
  const deletedModulesQuery = useUcatLearningModules({ includeDeleted: true })
  const combinedModuleRows = useMemo(
    () => [...(modulesQuery.data ?? []), ...(deletedModulesQuery.data ?? [])],
    [deletedModulesQuery.data, modulesQuery.data],
  )

  const filterDefinitions = useMemo((): DataTableFilterDefinition[] => {
    const creatorsById = new Map<string, string>()
    for (const row of combinedModuleRows) {
      if (row.kind !== 'lesson' || !row.created_by) continue
      const label =
        [row.created_by_first_name, row.created_by_last_name].filter(Boolean).join(' ') ||
        'Unknown staff'
      creatorsById.set(row.created_by, label)
    }
    const createdByOptions = Array.from(creatorsById, ([value, label]) => ({ label, value })).sort(
      (a, b) => a.label.localeCompare(b.label),
    )

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
        key: 'section_id',
        label: 'Section',
        options: [
          { label: 'No section', value: UCAT_LEARNING_MODULE_SECTION_NONE },
          ...[...sections]
            .filter((section): section is typeof section & { id: string } => section.id != null)
            .sort((a, b) => (a.section_number ?? 0) - (b.section_number ?? 0))
            .map((section) => ({
              label: section.name ?? `Section ${section.section_number ?? ''}`,
              value: section.id,
            })),
        ],
      },
      {
        key: 'created_by',
        label: 'Created by',
        options: createdByOptions,
      },
    ]
  }, [combinedModuleRows, sections])

  const {
    rows: lessonRows,
    visibleColumns,
    tableState,
    showDeleted,
    setShowDeleted,
  } = useUcatLearningModulesTable({
    data: combinedModuleRows,
    initialVisibleColumns: columnDefinitions
      .filter((column) => column.visibleByDefault)
      .map((column) => column.key),
    availableColumns: columnDefinitions.map((column) => column.key),
    status: activeTab,
  })

  const searchQuery = tableState.state.search

  const setActiveTab = useCallback(
    (tab: UcatContentStatus) => {
      const params = new URLSearchParams(searchParams.toString())
      if (tab === 'draft') params.delete('tab')
      else params.set('tab', tab)
      const query = params.toString()
      router.replace(query ? `${pathname}?${query}` : pathname)
    },
    [pathname, router, searchParams],
  )

  const rows: UcatLearningModuleRow[] = useMemo(() => modulesQuery.data ?? [], [modulesQuery.data])
  const activeRows = useMemo(() => rows.filter((row) => row.deleted_at == null), [rows])
  const rowById = useMemo(
    () => new Map(combinedModuleRows.map((row) => [row.id, row])),
    [combinedModuleRows],
  )

  const { page, pageSize } = tableState.state
  const totalRows = lessonRows.length
  const pageCount = Math.max(1, Math.ceil(totalRows / pageSize))
  const effectivePage = Math.min(page, pageCount)
  const paginatedRows = lessonRows.slice((effectivePage - 1) * pageSize, effectivePage * pageSize)

  const {
    selectedIds: selectedLessonIds,
    selectedIdsArray,
    selectionMode,
    allVisibleSelected,
    someVisibleSelected,
    toggleSelection,
    toggleSelectAllVisible,
    clearSelection,
  } = useUcatRowSelection(paginatedRows)

  const setViewMode = useCallback(
    (mode: 'table' | 'hierarchy') => {
      const params = new URLSearchParams(searchParams.toString())
      if (mode === 'table') params.delete('view')
      else params.set('view', mode)
      const query = params.toString()
      router.replace(query ? `${pathname}?${query}` : pathname)
      clearSelection()
    },
    [clearSelection, pathname, router, searchParams],
  )

  const invalidateModules = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ucatKeys.learningModules() })
  }, [queryClient])

  const changeLessonStatus = useCallback(
    async (moduleId: string, status: UcatContentStatus, previousStatus: UcatContentStatus, failureTitle: string) => {
      try {
        await ucatLearningModulesApi.setStatus(moduleId, status)
        await invalidateModules()
        toast(
          lifecycleStatusSuccessToast({
            contentLabel: 'Lesson',
            count: 1,
            status,
            onUndo: () => {
              void ucatLearningModulesApi
                .bulkRestoreStatus([moduleId], status, previousStatus)
                .then(() => invalidateModules())
            },
          }),
        )
      } catch (error) {
        toast(lifecycleErrorToast(error, failureTitle, router.push))
      }
    },
    [invalidateModules, router.push, toast],
  )

  const sectionTrees = useMemo(() => {
    const sectionList = [...(sectionsQuery.data ?? [])].sort(
      (a, b) => (a.section_number ?? 0) - (b.section_number ?? 0),
    )
    return sectionList.map((section) => {
      const rootNodes = buildModuleSectionTreeNodes(activeRows, section.id ?? '')
      const filtered = filterModuleTreeNodes(rootNodes, searchQuery)
      return {
        sectionId: section.id ?? '',
        sectionName: section.name ?? 'Unknown section',
        nodes: filtered,
      }
    })
  }, [activeRows, searchQuery, sectionsQuery.data])

  const unsectionedTrees = useMemo(() => {
    const rootNodes = buildModuleSectionTreeNodes(activeRows, null)
    return filterModuleTreeNodes(rootNodes, searchQuery)
  }, [activeRows, searchQuery])

  const allHierarchyNodes = useMemo(
    () => [
      ...mapLearningModuleTreeToTaxonomyNodes(unsectionedTrees),
      ...sectionTrees.flatMap((section) => mapLearningModuleTreeToTaxonomyNodes(section.nodes)),
    ],
    [sectionTrees, unsectionedTrees],
  )

  const openModule = useCallback((moduleId: string, mode: LearningModuleEditorMode = 'edit') => {
    const row = rowById.get(moduleId)
    if (row?.kind === 'folder') {
      setFolderDialogId(moduleId)
      return
    }
    setDialogEditorMode(mode)
    setEditModuleId(moduleId)
  }, [rowById])

  const openFolder = useCallback((folderId: string) => {
    setFolderDialogId(folderId)
  }, [])

  const closeModuleDialog = useCallback(() => {
    setEditModuleId(null)
    setDialogEditorMode('edit')
  }, [])

  const closeFolderDialog = useCallback(() => {
    setFolderDialogId(null)
  }, [])

  const openCreateDialog = useCallback((kind: UcatLearningModuleKind) => {
    setNewKind(kind)
    setNewTitle('')
    setNewSectionId(null)
    setNewParentId(null)
    setCreateOpen(true)
  }, [])

  const handleDeleteModule = useCallback(
    async (moduleId: string) => {
      const row = rowById.get(moduleId)
      if (!row) return
      const label = row.kind === 'folder' ? 'folder' : 'learning module'
      if (!window.confirm(`Delete this ${label}? This cannot be undone.`)) return
      try {
        await deleteModule.mutateAsync(moduleId)
        if (editModuleId === moduleId) closeModuleDialog()
        if (folderDialogId === moduleId) closeFolderDialog()
        toast({ title: 'Deleted', description: `${row.title} was deleted.` })
      } catch (error) {
        toast(lifecycleErrorToast(error, 'Delete failed', router.push))
      }
    },
    [
      closeFolderDialog,
      closeModuleDialog,
      deleteModule,
      editModuleId,
      folderDialogId,
      rowById,
      router.push,
      toast,
    ],
  )

  const handleRestoreModule = useCallback(
    async (moduleId: string) => {
      try {
        await restoreModule.mutateAsync(moduleId)
        toast({ title: 'Restored', description: 'Lesson restored to draft.' })
      } catch (error) {
        toast({
          title: 'Restore failed',
          description: error instanceof Error ? error.message : String(error),
          variant: 'destructive',
        })
      }
    },
    [restoreModule, toast],
  )

  async function handleBulkVisibilityConfirm() {
    if (bulkVisibilityPrivate == null) return
    setBulkVisibilityPending(true)
    try {
      const accessScope = bulkVisibilityPrivate ? 'private' : 'public'
      for (const id of selectedIdsArray) {
        const row = rowById.get(id)
        if (!row || row.kind !== 'lesson') continue
        await upsert.mutateAsync({
          moduleId: id,
          kind: row.kind,
          title: row.title,
          description: row.description,
          ucatSectionId: row.ucat_section_id,
          parentId: row.parent_ucat_learning_module_id,
          index: row.index,
          accessScope,
        })
      }
      setBulkVisibilityOpen(false)
      setBulkVisibilityPrivate(null)
      clearSelection()
      toast({
        title: 'Access updated',
        description: `Set ${selectedIdsArray.length} lesson(s) to ${accessScope}.`,
      })
    } catch (error) {
      toast({
        title: 'Could not update access',
        description: error instanceof Error ? error.message : String(error),
        variant: 'destructive',
      })
    } finally {
      setBulkVisibilityPending(false)
    }
  }

  async function handleBulkStatusConfirm() {
    if (!bulkStatus) return
    setBulkStatusPending(true)
    try {
      const result = await ucatLearningModulesApi.bulkSetStatus(selectedIdsArray, bulkStatus)
      await invalidateModules()
      const movedIds = result.movedIds
      const nextStatus = bulkStatus
      setBulkStatusOpen(false)
      setBulkStatus(null)
      clearSelection()
      if (movedIds.length > 0) {
        toast(
          lifecycleStatusSuccessToast({
            contentLabel: 'Lesson',
            count: movedIds.length,
            status: nextStatus,
            onUndo: () => {
              void ucatLearningModulesApi
                .bulkRestoreStatus(movedIds, nextStatus, activeTab)
                .then(async () => {
                  await invalidateModules()
                  toast({
                    title: movedIds.length === 1 ? 'Lesson status restored' : 'Lesson statuses restored',
                  })
                })
                .catch((error) =>
                  toast(lifecycleErrorToast(error, 'Could not undo status change', router.push)),
                )
            },
          }),
        )
      }
      const failureError = firstUcatBulkStatusFailureError(result)
      if (failureError) {
        const count = result.failures.length
        toast(
          lifecycleErrorToast(
            failureError,
            count === 1 ? '1 lesson could not be moved' : `${count} lessons could not be moved`,
            router.push,
          ),
        )
      }
    } catch (error) {
      toast(lifecycleErrorToast(error, 'Cannot move selected lessons', router.push))
    } finally {
      setBulkStatusPending(false)
    }
  }

  async function handleBulkDeleteConfirm() {
    setBulkDeletePending(true)
    try {
      await ucatLearningModulesApi.bulkRemove(selectedIdsArray)
      await invalidateModules()
      setBulkDeleteOpen(false)
      clearSelection()
      toast({
        title: selectedIdsArray.length === 1 ? 'Lesson deleted' : `${selectedIdsArray.length} lessons deleted`,
        description: 'You can restore them from the deleted list.',
      })
    } catch (error) {
      toast(lifecycleErrorToast(error, 'Delete failed', router.push))
    } finally {
      setBulkDeletePending(false)
    }
  }

  const getRowActions = useCallback(
    (node: UcatLearningModuleTreeNode): UcatRowAction[] => {
      return [
        {
          label: node.kind === 'folder' ? 'Edit' : 'View',
          icon: node.kind === 'folder' ? <Pencil className="h-4 w-4" /> : <Eye className="h-4 w-4" />,
          onClick: () => {
            if (node.kind === 'folder') openFolder(node.id)
            else openModule(node.id, 'view')
          },
        },
        {
          label: 'Open in page',
          icon: <ExternalLink className="h-4 w-4" />,
          href: `/ucat/learning-modules/${node.id}`,
        },
        {
          label: 'Delete',
          icon: <Trash2 className="h-4 w-4" />,
          onClick: () => {
            void handleDeleteModule(node.id)
          },
          destructive: true,
        },
      ]
    },
    [handleDeleteModule, openFolder, openModule],
  )

  const getLessonRowActions = useCallback(
    (row: LearningModuleLessonRow): UcatRowAction[] => {
      return [
        ...(!showDeleted
          ? [
              {
                label: 'Edit',
                icon: <Pencil className="h-4 w-4" />,
                onClick: () => openModule(row.id),
              },
              {
                label: 'Open in page',
                icon: <ExternalLink className="h-4 w-4" />,
                href: `/ucat/learning-modules/${row.id}`,
              },
            ]
          : []),
        ...(!showDeleted && row.status === 'draft'
          ? [
              {
                label: 'Send for review',
                icon: <Send className="h-4 w-4" />,
                onClick: () =>
                  void changeLessonStatus(row.id, 'in_review', row.status, 'Cannot send for review'),
              },
            ]
          : []),
        ...(!showDeleted && row.status === 'in_review'
          ? [
              {
                label: 'Publish',
                icon: <CheckCircle2 className="h-4 w-4" />,
                onClick: () =>
                  void changeLessonStatus(row.id, 'published', row.status, 'Cannot publish lesson'),
              },
              {
                label: 'Move to draft',
                icon: <FilePenLine className="h-4 w-4" />,
                onClick: () =>
                  void changeLessonStatus(row.id, 'draft', row.status, 'Cannot move lesson'),
              },
            ]
          : []),
        ...(!showDeleted && row.status === 'published'
          ? [
              {
                label: 'Move to review',
                icon: <ListChecks className="h-4 w-4" />,
                onClick: () =>
                  void changeLessonStatus(row.id, 'in_review', row.status, 'Cannot move lesson'),
              },
              {
                label: 'Move to draft',
                icon: <FilePenLine className="h-4 w-4" />,
                onClick: () =>
                  void changeLessonStatus(row.id, 'draft', row.status, 'Cannot move lesson'),
              },
            ]
          : []),
        ...(showDeleted
          ? [
              {
                label: 'Restore',
                icon: <RotateCcw className="h-4 w-4" />,
                onClick: () => void handleRestoreModule(row.id),
              },
            ]
          : [
              {
                label: 'Delete',
                icon: <Trash2 className="h-4 w-4" />,
                onClick: () => void handleDeleteModule(row.id),
                destructive: true,
              },
            ]),
      ]
    },
    [changeLessonStatus, handleDeleteModule, handleRestoreModule, openModule, showDeleted],
  )

  const actionsColumn: ColumnDef<LearningModuleLessonRow> = useMemo(
    () => ({
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="flex justify-end" onClick={(event) => event.stopPropagation()}>
          <UcatRowActions actions={getLessonRowActions(row.original)} />
        </div>
      ),
    }),
    [getLessonRowActions],
  )

  const titleColumn: ColumnDef<LearningModuleLessonRow> = useMemo(
    () => ({
      accessorKey: 'title',
      header: 'Title',
      cell: ({ row }) =>
        showDeleted ? (
          <span className="font-medium">{row.original.title}</span>
        ) : (
          <button
            type="button"
            className="text-left font-medium hover:underline"
            onClick={(event) => {
              event.stopPropagation()
              openModule(row.original.id)
            }}
          >
            {row.original.title}
          </button>
        ),
    }),
    [openModule, showDeleted],
  )

  const tableColumns = useMemo(() => {
    const withTitle = visibleColumns.map((column) =>
      'accessorKey' in column && column.accessorKey === 'title' ? titleColumn : column,
    )
    if (tableState.state.visibleColumns.includes('actions')) {
      return [...withTitle, actionsColumn]
    }
    return withTitle
  }, [actionsColumn, tableState.state.visibleColumns, titleColumn, visibleColumns])

  const selectColumn: ColumnDef<LearningModuleLessonRow> = {
    id: 'select',
    header: () => (
      <Checkbox
        checked={allVisibleSelected ? true : someVisibleSelected ? 'indeterminate' : false}
        onCheckedChange={toggleSelectAllVisible}
        aria-label="Select all visible lessons"
      />
    ),
    cell: ({ row }) => (
      <div onClick={(event) => event.stopPropagation()}>
        <Checkbox
          checked={selectedLessonIds.has(row.original.id)}
          onCheckedChange={() => toggleSelection(row.original.id)}
          aria-label={`Select lesson ${row.original.title}`}
        />
      </div>
    ),
  }

  const handleSiblingReorder = useCallback(
    async (itemId: string, overId: string) => {
      const item = rowById.get(itemId)
      const over = rowById.get(overId)
      if (!item || !over || itemId === overId) return

      const taxonomyRows = activeRows.map((module) => ({
        id: module.id,
        parent_id: module.parent_ucat_learning_module_id,
        section_id: module.ucat_section_id,
      }))
      const itemSectionId = resolveRootSectionId(taxonomyRows, itemId)
      const overSectionId = resolveRootSectionId(taxonomyRows, overId)

      const sameParent =
        item.parent_ucat_learning_module_id === over.parent_ucat_learning_module_id &&
        (item.parent_ucat_learning_module_id != null || itemSectionId === overSectionId)

      // Sortable reorder is same-parent only. Cross-folder moves use folder drop targets.
      if (!sameParent) return

      const siblings = activeRows
        .filter((row) => {
          if (row.parent_ucat_learning_module_id !== item.parent_ucat_learning_module_id) {
            return false
          }
          if (item.parent_ucat_learning_module_id != null) return true
          return resolveRootSectionId(taxonomyRows, row.id) === itemSectionId
        })
        .sort((a, b) => a.index - b.index)

      const oldIndex = siblings.findIndex((row) => row.id === itemId)
      const newIndex = siblings.findIndex((row) => row.id === overId)
      if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return

      const nextOrder = [...siblings]
      const [moved] = nextOrder.splice(oldIndex, 1)
      nextOrder.splice(newIndex, 0, moved)

      try {
        await reorderModules.mutateAsync(nextOrder.map((row, index) => ({ id: row.id, index })))
      } catch (error) {
        toast({
          title: 'Could not reorder module',
          description: error instanceof Error ? error.message : 'Unknown error',
          variant: 'destructive',
        })
      }
    },
    [activeRows, reorderModules, rowById, toast],
  )

  const handleReparent = useCallback(
    async (itemId: string, target: TaxonomyReparentTarget) => {
      const row = rowById.get(itemId)
      if (!row) return

      const taxonomyRows = activeRows.map((module) => ({
        id: module.id,
        parent_id: module.parent_ucat_learning_module_id,
        section_id: module.ucat_section_id,
      }))

      if (target.type === 'node') {
        if (target.parentId === itemId) return
        const parent = rowById.get(target.parentId)
        if (!parent || parent.kind !== 'folder') {
          toast({
            title: 'Invalid move',
            description: 'Modules can only be placed inside folders.',
            variant: 'destructive',
          })
          return
        }
        if (isDescendantOf(taxonomyRows, target.parentId, itemId)) {
          toast({
            title: 'Invalid move',
            description: 'Cannot move a module under its own descendant.',
            variant: 'destructive',
          })
          return
        }
        if (row.parent_ucat_learning_module_id === target.parentId) return

        try {
          const parentSectionId = resolveRootSectionId(taxonomyRows, target.parentId)
          await upsert.mutateAsync({
            moduleId: itemId,
            kind: row.kind,
            title: row.title,
            description: row.description,
            ucatSectionId: parentSectionId,
            parentId: target.parentId,
            index: getNextLearningModuleIndex(activeRows, target.parentId),
            accessScope: row.access_scope,
          })
        } catch (error) {
          toast({
            title: 'Could not move module',
            description: error instanceof Error ? error.message : 'Unknown error',
            variant: 'destructive',
          })
        }
        return
      }

      try {
        const isSameRoot =
          row.parent_ucat_learning_module_id == null && row.ucat_section_id === target.sectionId
        if (isSameRoot) return
        await upsert.mutateAsync({
          moduleId: itemId,
          kind: row.kind,
          title: row.title,
          description: row.description,
          ucatSectionId: target.sectionId,
          parentId: null,
          index: getNextLearningModuleIndex(activeRows, null),
          accessScope: row.access_scope,
        })
      } catch (error) {
        toast({
          title: 'Could not move module',
          description: error instanceof Error ? error.message : 'Unknown error',
          variant: 'destructive',
        })
      }
    },
    [activeRows, rowById, toast, upsert],
  )

  const handleCreate = async (orderItems: Array<{ id: string; index: number }>) => {
    if (!newTitle.trim()) return
    try {
      const id = await upsert.mutateAsync({
        kind: newKind,
        title: newTitle.trim(),
        ucatSectionId: newSectionId,
        parentId: newParentId,
        index: getNextLearningModuleIndex(activeRows, newParentId),
        accessScope: 'public',
      })
      const reorderItems = orderItems.map((item) => ({
        ...item,
        id: item.id === NEW_MODULE_PLACEHOLDER_ID ? id : item.id,
      }))
      if (reorderItems.length > 0) {
        await reorderModules.mutateAsync(reorderItems)
      }
      setCreateOpen(false)
      setNewTitle('')
      setNewSectionId(null)
      setNewParentId(null)
      if (newKind === 'lesson') openModule(id, 'edit')
    } catch (e) {
      toast({ title: 'Failed to create module', description: String(e), variant: 'destructive' })
    }
  }

  const handleInlineCreate = useCallback(
    async ({
      kind,
      title,
      sectionId,
      parentId,
    }: {
      kind: UcatLearningModuleKind
      title: string
      sectionId: string | null
      parentId: string | null
    }) => {
      try {
        const id = await upsert.mutateAsync({
          kind,
          title,
          ucatSectionId: sectionId,
          parentId,
          index: getNextLearningModuleIndex(activeRows, parentId),
          accessScope: 'public',
        })
        if (kind === 'lesson') openModule(id, 'edit')
      } catch (error) {
        toast({
          title: 'Failed to create module',
          description: error instanceof Error ? error.message : String(error),
          variant: 'destructive',
        })
        throw error
      }
    },
    [activeRows, openModule, toast, upsert],
  )

  if (access.isLoading || modulesQuery.isLoading || sectionsQuery.isLoading) {
    return <UcatPageSkeleton rows={8} />
  }
  if (!access.data) return <UcatAccessDenied />

  const isSearching = searchQuery.trim().length > 0
  const visibleSectionTrees = isSearching
    ? sectionTrees.filter((section) => section.nodes.length > 0)
    : sectionTrees
  const showUnsectioned = !isSearching || unsectionedTrees.length > 0
  const hasVisibleTrees =
    !isSearching || visibleSectionTrees.length > 0 || unsectionedTrees.length > 0

  const sectionContent = (
    <>
      {showUnsectioned ? (
        <TaxonomySectionDropZone
          sectionId={null}
          sectionName="Unsectioned modules"
          editMode
        >
          <LearningModuleHierarchyTree
            nodes={unsectionedTrees}
            onItemClick={openModule}
            sectionId={null}
            searchQuery={searchQuery}
            editMode
            getRowActions={getRowActions}
            onInlineCreate={handleInlineCreate}
          />
        </TaxonomySectionDropZone>
      ) : null}

      {visibleSectionTrees.map((section) => (
        <TaxonomySectionDropZone
          key={section.sectionId}
          sectionId={section.sectionId}
          sectionName={section.sectionName}
          editMode
        >
          <LearningModuleHierarchyTree
            nodes={section.nodes}
            onItemClick={openModule}
            sectionId={section.sectionId}
            searchQuery={searchQuery}
            editMode
            getRowActions={getRowActions}
            onInlineCreate={handleInlineCreate}
          />
        </TaxonomySectionDropZone>
      ))}
    </>
  )

  const isHierarchyView = viewMode === 'hierarchy' && !showDeleted

  return (
    <div className="space-y-6 py-8 md:py-10">
      <UcatPageHeader
        title="Learning modules"
        backHref="/ucat"
        breadcrumbs={[{ label: 'UCAT', href: '/ucat' }, { label: 'Learning modules' }]}
        actions={
          <div className="flex items-center gap-2">
            <SegmentedControl
              className="w-fit max-w-full"
              options={VIEW_MODE_OPTIONS}
              value={isHierarchyView ? 'hierarchy' : 'table'}
              onValueChange={(value) => {
                if (value === 'hierarchy' && showDeleted) setShowDeleted(false)
                setViewMode(value === 'hierarchy' ? 'hierarchy' : 'table')
              }}
            />
            <div className="hidden sm:block">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button">
                    New module
                    <ChevronDown className="ml-2 h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem onClick={() => openCreateDialog('lesson')}>
                    <BookOpen className="mr-2 h-4 w-4" />
                    Learning module
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => openCreateDialog('folder')}>
                    <Folder className="mr-2 h-4 w-4" />
                    Folder
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <TableActions
              className="sm:hidden"
              triggerClassName={`${tutorBtnOutline} min-w-0`}
              actions={[
                {
                  id: 'new-learning-module',
                  label: 'New learning module',
                  onSelect: () => openCreateDialog('lesson'),
                },
                {
                  id: 'new-folder',
                  label: 'New folder',
                  onSelect: () => openCreateDialog('folder'),
                },
              ]}
            />
          </div>
        }
      />

      {isHierarchyView ? (
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search modules…"
            value={searchQuery}
            onChange={(event) => tableState.actions.onSearchChange(event.target.value)}
            className="pl-8"
          />
        </div>
      ) : null}

      {isHierarchyView ? (
        <div className="space-y-6">
          {!hasVisibleTrees ? (
            <div className={tutorCardCn('p-6 text-center text-sm text-muted-foreground')}>
              No modules match your search
            </div>
          ) : (
            <TaxonomyHierarchyDndProvider
              allNodes={allHierarchyNodes}
              onReparent={handleReparent}
              onReorder={handleSiblingReorder}
            >
              <div className="space-y-6">{sectionContent}</div>
            </TaxonomyHierarchyDndProvider>
          )}
        </div>
      ) : (
        <div className={cn('space-y-4', selectionMode && 'pb-24')}>
          {!showDeleted ? (
            <SegmentedControl
              options={STATUS_TAB_OPTIONS}
              value={activeTab}
              onValueChange={(value) => {
                setActiveTab(value)
                clearSelection()
              }}
            />
          ) : (
            <p className="text-sm text-muted-foreground">Showing deleted lessons. Restore returns them to draft.</p>
          )}

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
            searchPlaceholder="Search lessons"
            filterFooter={
              <div className="border-t px-2 py-2">
                <Button
                  variant="outline"
                  size="sm"
                  className={cn(tutorBtnOutline, 'w-full justify-center')}
                  onClick={() => {
                    setShowDeleted((prev) => {
                      const next = !prev
                      if (next) {
                        setViewMode('table')
                        tableState.actions.onFiltersChange({})
                        tableState.actions.onSearchChange('')
                      }
                      clearSelection()
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

          <div className="pt-3">
            <DataTable
              {...tutorDataTableProps}
              columns={[selectColumn, ...tableColumns]}
              data={paginatedRows}
              pagination="external"
              pageSizeOptions={[10, 20, 50]}
              getRowClassName={(row) =>
                cn(row.deleted_at ? 'bg-destructive/10' : '', selectedLessonIds.has(row.id) && 'bg-muted/50')
              }
              onRowClick={selectionMode ? (row) => toggleSelection(row.id) : undefined}
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
        </div>
      )}

      {!isHierarchyView && !showDeleted ? (
        <UcatSelectionToolbar
          selectedCount={selectedLessonIds.size}
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
                setBulkVisibilityPrivate(item.value)
                setBulkVisibilityOpen(true)
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
            items={bulkStatusOptions}
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
      ) : null}

      <AlertDialog open={bulkVisibilityOpen} onOpenChange={setBulkVisibilityOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Set visibility for {selectedLessonIds.size} lesson(s)?</AlertDialogTitle>
            <AlertDialogDescription>
              Visibility will be set to {bulkVisibilityPrivate ? 'Private' : 'Public'} for all selected lessons.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkVisibilityPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleBulkVisibilityConfirm()} disabled={bulkVisibilityPending}>
              {bulkVisibilityPending ? 'Updating...' : 'Yes'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={bulkStatusOpen} onOpenChange={setBulkStatusOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Move {selectedLessonIds.size} lesson(s) to {bulkStatus?.replace('_', ' ')}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Eligible lessons will move. Any blocked lessons will remain in their current status.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkStatusPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleBulkStatusConfirm()} disabled={bulkStatusPending}>
              {bulkStatusPending ? 'Moving...' : 'Move lessons'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <UcatDeleteConfirmDialog
        open={bulkDeleteOpen}
        onOpenChange={(open) => !open && setBulkDeleteOpen(false)}
        title={`Delete ${selectedLessonIds.size} lesson(s)?`}
        description="Selected lessons will be soft-deleted. Remove them from class sessions first if delete is blocked. You can restore them later from the deleted list."
        onConfirm={handleBulkDeleteConfirm}
        isPending={bulkDeletePending}
      />

      <UcatCreateLearningModuleDialog
        open={createOpen}
        kind={newKind}
        title={newTitle}
        sectionId={newSectionId}
        parentId={newParentId}
        isSaving={upsert.isPending || reorderModules.isPending}
        sections={sectionsQuery.data ?? []}
        modules={activeRows}
        onClose={() => setCreateOpen(false)}
        onSave={handleCreate}
        onTitleChange={setNewTitle}
        onSectionIdChange={setNewSectionId}
        onParentIdChange={setNewParentId}
      />

      <UcatLearningModuleDialog
        open={editModuleId != null}
        moduleId={editModuleId}
        initialEditorMode={dialogEditorMode}
        onClose={closeModuleDialog}
        onDeleted={closeModuleDialog}
      />

      <UcatLearningModuleFolderDialog
        open={folderDialogId != null}
        folderId={folderDialogId}
        modules={activeRows}
        sections={sections}
        onClose={closeFolderDialog}
        onDelete={handleDeleteModule}
      />
    </div>
  )
}
