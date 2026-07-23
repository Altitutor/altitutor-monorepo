'use client'

import { useCallback, useMemo, useState } from 'react'
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Input,
  TableActions,
  useToast,
} from '@altitutor/ui'
import { BookOpen, ChevronDown, ExternalLink, Folder, Globe, Lock, Pencil, Search, Trash2 } from 'lucide-react'
import { UcatAccessDenied, UcatPageHeader, UcatPageSkeleton } from '@/features/ucat/shared/components'
import { useUcatAccess } from '@/features/ucat/shared/hooks/useUcatAccess'
import { useUcatCopyId } from '@/features/ucat/shared/hooks/useUcatCopyId'
import { buildCopyIdRowAction, withCopyIdDescription } from '@/features/ucat/shared/lib/copy-id-actions'
import type { UcatRowAction } from '@/features/ucat/shared/row-actions'
import { UcatCreateLearningModuleDialog } from '@/features/ucat/learning-modules/components/UcatCreateLearningModuleDialog'
import { UcatLearningModuleDialog } from '@/features/ucat/learning-modules/components/UcatLearningModuleDialog'
import {
  useDeleteUcatLearningModule,
  useUcatLearningModules,
  useReorderUcatLearningModules,
  useUpsertUcatLearningModule,
} from '@/features/ucat/learning-modules/hooks/useUcatLearningModules'
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
import { tutorBtnOutline, tutorCardCn } from '@/shared/lib/tutor-visual'
import { NEW_MODULE_PLACEHOLDER_ID } from '@/features/ucat/learning-modules/components/UcatCreateLearningModuleDialog'

export function UcatLearningModulesPage() {
  const { toast } = useToast()
  const { copyId } = useUcatCopyId()
  const access = useUcatAccess()
  const modulesQuery = useUcatLearningModules()
  const sectionsQuery = useUcatSections()
  const upsert = useUpsertUcatLearningModule()
  const deleteModule = useDeleteUcatLearningModule()
  const reorderModules = useReorderUcatLearningModules()

  const [searchQuery, setSearchQuery] = useState('')
  const [editMode, setEditMode] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [editModuleId, setEditModuleId] = useState<string | null>(null)
  const [newKind, setNewKind] = useState<UcatLearningModuleKind>('lesson')
  const [newTitle, setNewTitle] = useState('')
  const [newSectionId, setNewSectionId] = useState<string | null>(null)
  const [newParentId, setNewParentId] = useState<string | null>(null)

  const rows: UcatLearningModuleRow[] = useMemo(() => modulesQuery.data ?? [], [modulesQuery.data])
  const rowById = useMemo(() => new Map(rows.map((row) => [row.id, row])), [rows])

  const sectionTrees = useMemo(() => {
    const sectionList = [...(sectionsQuery.data ?? [])].sort(
      (a, b) => (a.section_number ?? 0) - (b.section_number ?? 0),
    )
    return sectionList.map((section) => {
      const rootNodes = buildModuleSectionTreeNodes(rows, section.id ?? '')
      const filtered = filterModuleTreeNodes(rootNodes, searchQuery)
      return {
        sectionId: section.id ?? '',
        sectionName: section.name ?? 'Unknown section',
        nodes: filtered,
      }
    })
  }, [rows, searchQuery, sectionsQuery.data])

  const unsectionedTrees = useMemo(() => {
    const rootNodes = buildModuleSectionTreeNodes(rows, null)
    return filterModuleTreeNodes(rootNodes, searchQuery)
  }, [rows, searchQuery])

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

  const handleTogglePrivate = useCallback(
    async (moduleId: string) => {
      const row = rowById.get(moduleId)
      if (!row) return
      const nextPrivate = !row.is_private
      try {
        await upsert.mutateAsync({
          moduleId: row.id,
          kind: row.kind,
          title: row.title,
          description: row.description,
          iconKey: row.icon_key,
          estimatedMinutes: row.estimated_minutes,
          ucatSectionId: row.ucat_section_id,
          parentId: row.parent_ucat_learning_module_id,
          index: row.index,
          isPrivate: nextPrivate,
          studyPlanPriority: row.study_plan_priority,
          studyPlanCategoryIds: row.study_plan_category_ids,
          studyPlanTagIds: row.study_plan_tag_ids,
        })
        toast({
          title: nextPrivate ? 'Made private' : 'Made public',
          description: nextPrivate
            ? 'Visible only to assigned students.'
            : 'Visible in the student library.',
        })
      } catch (error) {
        toast({
          title: 'Could not update visibility',
          description: error instanceof Error ? error.message : 'Unknown error',
          variant: 'destructive',
        })
      }
    },
    [rowById, toast, upsert],
  )

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
        toast({
          title: 'Delete failed',
          description: error instanceof Error ? error.message : String(error),
          variant: 'destructive',
        })
      }
    },
    [deleteModule, editModuleId, rowById, toast],
  )

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
          label: node.is_private ? 'Make public' : 'Make private',
          icon: node.is_private ? <Globe className="h-4 w-4" /> : <Lock className="h-4 w-4" />,
          onClick: () => {
            void handleTogglePrivate(node.id)
          },
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
    [copyId, handleDeleteModule, handleTogglePrivate],
  )

  const handleReparent = useCallback(
    async (itemId: string, target: TaxonomyReparentTarget) => {
      const row = rowById.get(itemId)
      if (!row) return

      const taxonomyRows = rows.map((module) => ({
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
            index: isSameRoot ? row.index : getNextLearningModuleIndex(rows, null),
            isPrivate: row.is_private,
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
            index: isSameParent ? row.index : getNextLearningModuleIndex(rows, target.parentId),
            isPrivate: row.is_private,
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
    [rowById, rows, toast, upsert],
  )

  const handleCreate = async (orderItems: Array<{ id: string; index: number }>) => {
    if (!newTitle.trim()) return
    try {
      const id = await upsert.mutateAsync({
        kind: newKind,
        title: newTitle.trim(),
        ucatSectionId: newSectionId,
        parentId: newParentId,
        index: getNextLearningModuleIndex(rows, newParentId),
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
          index: getNextLearningModuleIndex(rows, parentId),
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
    [rows, toast, upsert],
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
                onClick={() => setEditMode((prev) => !prev)}
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
                  onSelect: () => setEditMode((prev) => !prev),
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

      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Search modules..."
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          className="pl-8"
        />
      </div>

      <div className="space-y-6">
        {!hasVisibleTrees ? (
          <div className={tutorCardCn('p-6 text-center text-sm text-muted-foreground')}>
            No modules match your search
          </div>
        ) : editMode ? (
          <TaxonomyHierarchyDndProvider allNodes={allHierarchyNodes} onReparent={handleReparent}>
            <div className="space-y-6">{sectionContent}</div>
          </TaxonomyHierarchyDndProvider>
        ) : (
          <div className="space-y-6">{sectionContent}</div>
        )}
      </div>

      <UcatCreateLearningModuleDialog
        open={createOpen}
        kind={newKind}
        title={newTitle}
        sectionId={newSectionId}
        parentId={newParentId}
        isSaving={upsert.isPending || reorderModules.isPending}
        sections={sectionsQuery.data ?? []}
        modules={rows}
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
