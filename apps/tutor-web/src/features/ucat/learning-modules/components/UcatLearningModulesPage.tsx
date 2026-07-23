'use client'

import { useCallback, useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Input,
  SearchableSelect,
  Table,
  TableActions,
  useToast,
} from '@altitutor/ui'
import {
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ExternalLink,
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
import { useUcatCopyId } from '@/features/ucat/shared/hooks/useUcatCopyId'
import { useUcatRowSelection } from '@/features/ucat/shared/hooks/useUcatRowSelection'
import { buildCopyIdRowAction, withCopyIdDescription } from '@/features/ucat/shared/lib/copy-id-actions'
import { UcatRowActions, type UcatRowAction } from '@/features/ucat/shared/row-actions'
import { UcatCreateLearningModuleDialog } from '@/features/ucat/learning-modules/components/UcatCreateLearningModuleDialog'
import { UcatLearningModuleDialog } from '@/features/ucat/learning-modules/components/UcatLearningModuleDialog'
import {
  useDeleteUcatLearningModule,
  useRestoreUcatLearningModule,
  useUcatLearningModules,
  useReorderUcatLearningModules,
  useUpsertUcatLearningModule,
} from '@/features/ucat/learning-modules/hooks/useUcatLearningModules'
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
import { UcatVisibilityBadge } from '@/features/ucat/shared/components/UcatVisibilityBadge'
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
import { tutorBtnOutline, tutorCardCn } from '@/shared/lib/tutor-visual'
import { NEW_MODULE_PLACEHOLDER_ID } from '@/features/ucat/learning-modules/components/UcatCreateLearningModuleDialog'
import { useQueryClient } from '@tanstack/react-query'
import { ucatKeys } from '@/features/ucat/shared/lib/query-keys'
import { cn } from '@/shared/utils'

function parseStatusTab(value: string | null): UcatContentStatus {
  return value === 'in_review' || value === 'published' ? value : 'draft'
}

const STATUS_TAB_OPTIONS = [
  { value: 'draft' as const, label: 'Draft' },
  { value: 'in_review' as const, label: 'In review' },
  { value: 'published' as const, label: 'Published' },
]

export function UcatLearningModulesPage() {
  const { toast } = useToast()
  const { copyId } = useUcatCopyId()
  const access = useUcatAccess()
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const queryClient = useQueryClient()
  const activeTab = parseStatusTab(searchParams.get('tab'))
  const [showDeleted, setShowDeleted] = useState(false)
  const modulesQuery = useUcatLearningModules({ includeDeleted: showDeleted })
  const sectionsQuery = useUcatSections()
  const upsert = useUpsertUcatLearningModule()
  const deleteModule = useDeleteUcatLearningModule()
  const restoreModule = useRestoreUcatLearningModule()
  const reorderModules = useReorderUcatLearningModules()

  const [searchQuery, setSearchQuery] = useState('')
  const [editMode, setEditMode] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [editModuleId, setEditModuleId] = useState<string | null>(null)
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
  const rowById = useMemo(() => new Map(rows.map((row) => [row.id, row])), [rows])
  const lessonRows = useMemo(
    () =>
      rows.filter((row) => {
        if (row.kind !== 'lesson') return false
        if (showDeleted) return row.deleted_at != null
        if (row.deleted_at != null) return false
        if (row.status !== activeTab) return false
        if (!searchQuery.trim()) return true
        return row.title.toLowerCase().includes(searchQuery.trim().toLowerCase())
      }),
    [activeTab, rows, searchQuery, showDeleted],
  )

  const {
    selectedIds: selectedLessonIds,
    selectedIdsArray,
    selectionMode,
    allVisibleSelected,
    someVisibleSelected,
    toggleSelection,
    toggleSelectAllVisible,
    clearSelection,
  } = useUcatRowSelection(lessonRows)

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

  const openModule = useCallback((moduleId: string) => {
    setEditModuleId(moduleId)
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
        if (editModuleId === moduleId) setEditModuleId(null)
        toast({ title: 'Deleted', description: `${row.title} was deleted.` })
      } catch (error) {
        toast(lifecycleErrorToast(error, 'Delete failed', router.push))
      }
    },
    [deleteModule, editModuleId, rowById, router.push, toast],
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
      const copyIdAction = buildCopyIdRowAction(
        [
          {
            label: node.kind === 'folder' ? 'Folder' : 'Module',
            id: node.id,
            description: withCopyIdDescription(node.title),
          },
        ],
        copyId,
      )

      return [
        ...(copyIdAction ? [copyIdAction] : []),
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
    [copyId, handleDeleteModule],
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
      }

      try {
        if (target.type === 'root') {
          const isSameRoot =
            row.parent_ucat_learning_module_id == null && row.ucat_section_id === target.sectionId
          await upsert.mutateAsync({
            moduleId: itemId,
            kind: row.kind,
            title: row.title,
            description: row.description,
            ucatSectionId: target.sectionId,
            parentId: null,
            index: isSameRoot ? row.index : getNextLearningModuleIndex(activeRows, null),
            accessScope: row.access_scope,
          })
        } else {
          const parentSectionId = resolveRootSectionId(taxonomyRows, target.parentId)
          const isSameParent = row.parent_ucat_learning_module_id === target.parentId
          await upsert.mutateAsync({
            moduleId: itemId,
            kind: row.kind,
            title: row.title,
            description: row.description,
            ucatSectionId: parentSectionId,
            parentId: target.parentId,
            index: isSameParent ? row.index : getNextLearningModuleIndex(activeRows, target.parentId),
            accessScope: row.access_scope,
          })
        }
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
      if (newKind === 'lesson') setEditModuleId(id)
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
        if (kind === 'lesson') setEditModuleId(id)
      } catch (error) {
        toast({
          title: 'Failed to create module',
          description: error instanceof Error ? error.message : String(error),
          variant: 'destructive',
        })
        throw error
      }
    },
    [activeRows, toast, upsert],
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
          editMode={editMode}
        >
          <LearningModuleHierarchyTree
            nodes={unsectionedTrees}
            onItemClick={openModule}
            sectionId={null}
            searchQuery={searchQuery}
            editMode={editMode}
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
          editMode={editMode}
        >
          <LearningModuleHierarchyTree
            nodes={section.nodes}
            onItemClick={openModule}
            sectionId={section.sectionId}
            searchQuery={searchQuery}
            editMode={editMode}
            getRowActions={getRowActions}
            onInlineCreate={handleInlineCreate}
          />
        </TaxonomySectionDropZone>
      ))}
    </>
  )

  return (
    <div className="space-y-6 py-8 md:py-10">
      <UcatPageHeader
        title="Learning modules"
        backHref="/ucat"
        breadcrumbs={[{ label: 'UCAT', href: '/ucat' }, { label: 'Learning modules' }]}
        actions={
          <>
            <div className="hidden items-center gap-2 sm:flex">
              <Button
                type="button"
                variant={editMode ? 'default' : 'outline'}
                className={editMode ? undefined : tutorBtnOutline}
                disabled={showDeleted}
                onClick={() => {
                  setEditMode((prev) => !prev)
                  clearSelection()
                }}
              >
                <Pencil className="mr-2 h-4 w-4" />
                {editMode ? 'Done reordering' : 'Edit hierarchy'}
              </Button>
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
                  id: 'toggle-hierarchy',
                  label: editMode ? 'Done reordering' : 'Edit hierarchy',
                  onSelect: () => {
                    setEditMode((prev) => !prev)
                    clearSelection()
                  },
                },
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
          </>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder={editMode ? 'Search modules…' : 'Search lessons…'}
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="pl-8"
          />
        </div>
        {!editMode ? (
          <Button
            type="button"
            variant="outline"
            className={tutorBtnOutline}
            onClick={() => {
              setShowDeleted((prev) => {
                const next = !prev
                if (next) setEditMode(false)
                clearSelection()
                return next
              })
            }}
          >
            {showDeleted ? 'Show active only' : 'Show deleted'}
          </Button>
        ) : null}
      </div>

      {editMode ? (
        <div className="space-y-6">
          {!hasVisibleTrees ? (
            <div className={tutorCardCn('p-6 text-center text-sm text-muted-foreground')}>
              No modules match your search
            </div>
          ) : (
            <TaxonomyHierarchyDndProvider allNodes={allHierarchyNodes} onReparent={handleReparent}>
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
          <div className={tutorCardCn('overflow-hidden')}>
            <Table>
              <thead>
                <tr>
                  <th className="w-12">
                    <Checkbox
                      checked={allVisibleSelected ? true : someVisibleSelected ? 'indeterminate' : false}
                      onCheckedChange={toggleSelectAllVisible}
                      aria-label="Select all visible lessons"
                    />
                  </th>
                  <th>Title</th>
                  <th>Section</th>
                  <th>Blocks</th>
                  <th>Access</th>
                  {showDeleted ? <th>Status</th> : null}
                  <th className="w-28">Actions</th>
                </tr>
              </thead>
              <tbody>
                {lessonRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={showDeleted ? 7 : 6}
                      className="py-10 text-center text-sm text-muted-foreground"
                    >
                      {showDeleted ? 'No deleted lessons.' : 'No lessons in this tab.'}
                    </td>
                  </tr>
                ) : (
                  lessonRows.map((row) => {
                    const copyAction = buildCopyIdRowAction(
                      [
                        {
                          label: 'Lesson',
                          id: row.id,
                          description: withCopyIdDescription(row.title),
                        },
                      ],
                      copyId,
                    )
                    const actions: UcatRowAction[] = [
                      ...(copyAction ? [copyAction] : []),
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
                    return (
                      <tr
                        key={row.id}
                        className={cn(
                          row.deleted_at && 'bg-destructive/10',
                          selectedLessonIds.has(row.id) && 'bg-muted/50',
                        )}
                      >
                        <td>
                          <Checkbox
                            checked={selectedLessonIds.has(row.id)}
                            onCheckedChange={() => toggleSelection(row.id)}
                            aria-label={`Select lesson ${row.title}`}
                          />
                        </td>
                        <td>
                          {showDeleted ? (
                            <span className="font-medium">{row.title || 'Untitled lesson'}</span>
                          ) : (
                            <button
                              type="button"
                              className="text-left font-medium hover:underline"
                              onClick={() => openModule(row.id)}
                            >
                              {row.title || 'Untitled lesson'}
                            </button>
                          )}
                        </td>
                        <td className="text-sm text-muted-foreground">{row.section_name ?? '—'}</td>
                        <td className="text-sm text-muted-foreground">{row.block_count}</td>
                        <td>
                          <UcatVisibilityBadge isPrivate={row.access_scope === 'private'} />
                        </td>
                        {showDeleted ? (
                          <td className="capitalize text-sm text-muted-foreground">{row.status}</td>
                        ) : null}
                        <td>
                          <UcatRowActions actions={actions} />
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </Table>
          </div>
        </div>
      )}

      {!editMode && !showDeleted ? (
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
        onClose={() => setEditModuleId(null)}
        onDeleted={() => setEditModuleId(null)}
      />
    </div>
  )
}
