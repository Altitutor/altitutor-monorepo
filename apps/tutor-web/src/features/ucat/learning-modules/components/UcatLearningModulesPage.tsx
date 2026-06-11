'use client'

import { useCallback, useMemo, useState } from 'react'
import { Button, Input, useToast } from '@altitutor/ui'
import { Pencil, Search } from 'lucide-react'
import { UcatAccessDenied, UcatPageHeader, UcatPageSkeleton } from '@/features/ucat/shared/components'
import { useUcatAccess } from '@/features/ucat/shared/hooks/useUcatAccess'
import { UcatCreateLearningModuleDialog } from '@/features/ucat/learning-modules/components/UcatCreateLearningModuleDialog'
import { UcatLearningModuleDialog } from '@/features/ucat/learning-modules/components/UcatLearningModuleDialog'
import {
  useUcatLearningModules,
  useUpsertUcatLearningModule,
} from '@/features/ucat/learning-modules/hooks/useUcatLearningModules'
import type { UcatLearningModuleKind, UcatLearningModuleRow } from '@/features/ucat/learning-modules/types'
import { useUcatSections } from '@/features/ucat/questions/hooks/useUcatQuestions'
import { TaxonomySectionDropZone } from '@/features/ucat/shared/components/taxonomy-hierarchy-tree'
import type { TaxonomyReparentTarget } from '@/features/ucat/shared/components/taxonomy-hierarchy-tree'
import { TaxonomyHierarchyDndProvider } from '@/features/ucat/shared/components/taxonomy-hierarchy-dnd'
import { isDescendantOf } from '@/features/ucat/shared/lib/taxonomy-reparent'
import {
  buildModuleSectionTreeNodes,
  filterModuleTreeNodes,
} from '@/features/ucat/learning-modules/lib/build-learning-module-tree'
import { getNextLearningModuleIndex } from '@/features/ucat/learning-modules/lib/get-next-learning-module-index'
import { mapLearningModuleTreeToTaxonomyNodes } from '@/features/ucat/learning-modules/lib/map-learning-module-tree'
import { LearningModuleHierarchyTree } from '@/features/ucat/learning-modules/components/LearningModuleHierarchyTree'
import { tutorCardCn } from '@/shared/lib/tutor-visual'

export function UcatLearningModulesPage() {
  const { toast } = useToast()
  const access = useUcatAccess()
  const modulesQuery = useUcatLearningModules()
  const sectionsQuery = useUcatSections()
  const upsert = useUpsertUcatLearningModule()

  const [searchQuery, setSearchQuery] = useState('')
  const [editMode, setEditMode] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [editModuleId, setEditModuleId] = useState<string | null>(null)
  const [newKind, setNewKind] = useState<UcatLearningModuleKind>('lesson')
  const [newTitle, setNewTitle] = useState('')

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
      ...sectionTrees.flatMap((section) => mapLearningModuleTreeToTaxonomyNodes(section.nodes)),
      ...mapLearningModuleTreeToTaxonomyNodes(unsectionedTrees),
    ],
    [sectionTrees, unsectionedTrees],
  )

  const openModule = useCallback((moduleId: string) => {
    setEditModuleId(moduleId)
  }, [])

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
          await upsert.mutateAsync({
            moduleId: itemId,
            kind: row.kind,
            title: row.title,
            description: row.description,
            ucatSectionId: target.sectionId,
            parentId: null,
            index: row.index,
            isPrivate: row.is_private,
            displayMode: row.display_mode ?? (row.kind === 'lesson' ? 'stepped' : undefined),
          })
        } else {
          await upsert.mutateAsync({
            moduleId: itemId,
            kind: row.kind,
            title: row.title,
            description: row.description,
            parentId: target.parentId,
            index: row.index,
            isPrivate: row.is_private,
            displayMode: row.display_mode ?? (row.kind === 'lesson' ? 'stepped' : undefined),
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

  const handleCreate = async () => {
    if (!newTitle.trim()) return
    try {
      const id = await upsert.mutateAsync({
        kind: newKind,
        title: newTitle.trim(),
        index: getNextLearningModuleIndex(rows, null),
        displayMode: newKind === 'lesson' ? 'stepped' : undefined,
      })
      setCreateOpen(false)
      setNewTitle('')
      setEditModuleId(id)
    } catch (e) {
      toast({ title: 'Failed to create module', description: String(e), variant: 'destructive' })
    }
  }

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
            searchQuery={searchQuery}
            editMode={editMode}
          />
        </TaxonomySectionDropZone>
      ))}

      {showUnsectioned ? (
        <TaxonomySectionDropZone
          sectionId={null}
          sectionName="Unsectioned modules"
          editMode={editMode}
        >
          <LearningModuleHierarchyTree
            nodes={unsectionedTrees}
            onItemClick={openModule}
            searchQuery={searchQuery}
            editMode={editMode}
          />
        </TaxonomySectionDropZone>
      ) : null}
    </>
  )

  return (
    <div className="space-y-6 py-8 md:py-10">
      <UcatPageHeader
        title="Learning modules"
        description="Organise UCAT lessons and folders. Lessons contain blocks students complete in class or online."
        backHref="/ucat"
        breadcrumbs={[{ label: 'UCAT', href: '/ucat' }, { label: 'Learning modules' }]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant={editMode ? 'default' : 'outline'}
              onClick={() => setEditMode((prev) => !prev)}
            >
              <Pencil className="mr-2 h-4 w-4" />
              {editMode ? 'Done reordering' : 'Edit hierarchy'}
            </Button>
            <Button type="button" onClick={() => setCreateOpen(true)}>
              New module
            </Button>
          </div>
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
        isSaving={upsert.isPending}
        onClose={() => setCreateOpen(false)}
        onSave={handleCreate}
        onKindChange={setNewKind}
        onTitleChange={setNewTitle}
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
