'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { X } from 'lucide-react'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Input,
  SearchableSelect,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
} from '@altitutor/ui'
import { SegmentedControl } from '@/shared/components/segmented-control'
import { tutorCardCn } from '@/shared/lib/tutor-visual'
import { cn } from '@/shared/utils'
import type { UcatAccessScope } from '@/features/ucat/shared/types'
import type { UcatSectionOption } from '@/features/ucat/questions/components/UcatQuestionStemDialog'
import type { UcatLearningModuleRow } from '@/features/ucat/learning-modules/types'
import type { UcatLearningModuleKind, UcatLearningModuleStudyPlanPriority } from '@/features/ucat/learning-modules/types'
import { useUcatQuestionStemCategories } from '@/features/ucat/question-stem-categories/hooks/useUcatQuestionStemCategories'
import { useUcatQuestionTags } from '@/features/ucat/question-tags/hooks/useUcatQuestionTags'
import { UcatLearningModuleOrderEditor } from '@/features/ucat/learning-modules/components/UcatLearningModuleOrderEditor'
import {
  isDescendantOf,
  resolveRootSectionId,
} from '@/features/ucat/shared/lib/taxonomy-reparent'
import type { UcatAuthoringWorkspaceTab } from '@/features/ucat/shared/components/UcatAuthoringWorkspaceTabs'
import {
  LEARNING_MODULE_ICON_OPTIONS,
  type LearningModuleIconKey,
} from '@/features/ucat/learning-modules/lib/learning-module-icons'
export type LearningModuleEditorMode = 'edit' | 'view'

type UcatLearningModuleSettingsPanelProps = {
  moduleId: string | null
  kind: UcatLearningModuleKind
  title: string
  description: string
  iconKey: LearningModuleIconKey
  estimatedMinutes: number | null
  sectionId: string | null
  parentId: string | null
  accessScope: UcatAccessScope
  studyPlanPriority: UcatLearningModuleStudyPlanPriority
  studyPlanCategoryIds: string[]
  studyPlanTagIds: string[]
  onTitleChange: (title: string) => void
  onDescriptionChange: (description: string) => void
  onIconKeyChange: (iconKey: LearningModuleIconKey) => void
  onEstimatedMinutesChange: (minutes: number | null) => void
  onSectionIdChange: (sectionId: string | null) => void
  onParentIdChange: (parentId: string | null) => void
  onAccessScopeChange: (accessScope: UcatAccessScope) => void
  onStudyPlanPriorityChange: (priority: UcatLearningModuleStudyPlanPriority) => void
  onStudyPlanCategoryIdsChange: (ids: string[]) => void
  onStudyPlanTagIdsChange: (ids: string[]) => void
  sections: UcatSectionOption[]
  modules: UcatLearningModuleRow[]
  folderOptions: UcatLearningModuleRow[]
  onSaveSectionOrder: (items: Array<{ id: string; index: number }>) => Promise<void>
  editorMode: LearningModuleEditorMode
  onEditorModeChange: (mode: LearningModuleEditorMode) => void
  showModeControls?: boolean
  aiActions?: ReactNode
  activeTab?: Exclude<UcatAuthoringWorkspaceTab, 'editor'>
  onActiveTabChange?: (value: UcatAuthoringWorkspaceTab) => void
  className?: string
}

function PropertyRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="shrink-0 text-sm text-muted-foreground">{label}</span>
      <div className="min-w-0 w-[58%]">{children}</div>
    </div>
  )
}

export function UcatLearningModuleSettingsPanel({
  moduleId,
  kind,
  title,
  description,
  iconKey,
  estimatedMinutes,
  sectionId,
  parentId,
  accessScope,
  studyPlanPriority,
  studyPlanCategoryIds,
  studyPlanTagIds,
  onTitleChange,
  onDescriptionChange,
  onIconKeyChange,
  onEstimatedMinutesChange,
  onSectionIdChange,
  onParentIdChange,
  onAccessScopeChange,
  onStudyPlanPriorityChange,
  onStudyPlanCategoryIdsChange,
  onStudyPlanTagIdsChange,
  sections,
  modules,
  folderOptions,
  onSaveSectionOrder,
  editorMode,
  onEditorModeChange,
  showModeControls = true,
  aiActions,
  activeTab: controlledActiveTab,
  onActiveTabChange,
  className,
}: UcatLearningModuleSettingsPanelProps) {
  const categoriesQuery = useUcatQuestionStemCategories()
  const tagsQuery = useUcatQuestionTags()
  const [uncontrolledActiveTab, setUncontrolledActiveTab] = useState<'properties' | 'ai'>('properties')
  const activeTab = controlledActiveTab ?? uncontrolledActiveTab

  function handleActiveTabChange(value: string) {
    const next = value as 'properties' | 'ai'
    setUncontrolledActiveTab(next)
    onActiveTabChange?.(next)
  }
  const draftModules = useMemo(
    () =>
      modules.map((row) =>
        row.id === moduleId
          ? {
              ...row,
              ucat_section_id: sectionId,
              parent_ucat_learning_module_id: parentId,
            }
          : row,
      ),
    [modules, moduleId, sectionId, parentId],
  )
  const sectionItems = [
    { id: 'none', name: 'None' },
    ...sections.filter((s): s is typeof s & { id: string } => s.id != null),
  ]
  const selectedSection = sectionItems.find((s) => s.id === (sectionId ?? 'none')) ?? sectionItems[0]

  const taxonomyRows = useMemo(
    () =>
      draftModules.map((row) => ({
        id: row.id,
        parent_id: row.parent_ucat_learning_module_id,
        section_id: row.ucat_section_id,
      })),
    [draftModules],
  )
  const eligibleFolderOptions = useMemo(
    () =>
      folderOptions.filter((folder) => {
        if (resolveRootSectionId(taxonomyRows, folder.id) !== sectionId) return false
        if (!moduleId) return true
        return !isDescendantOf(taxonomyRows, folder.id, moduleId)
      }),
    [folderOptions, moduleId, sectionId, taxonomyRows],
  )
  const parentItems = [
    { id: 'none', name: 'Root' },
    ...eligibleFolderOptions.map((f) => ({ id: f.id, name: f.title })),
  ]
  const selectedParent = parentItems.find((p) => p.id === (parentId ?? 'none')) ?? parentItems[0]

  useEffect(() => {
    if (!parentId) return
    if (eligibleFolderOptions.some((folder) => folder.id === parentId)) return
    if (!modules.some((row) => row.id === parentId)) return
    onParentIdChange(null)
  }, [eligibleFolderOptions, modules, onParentIdChange, parentId])

  const visibilityItems = [
    { value: 'public' as const, label: 'Public' },
    { value: 'private' as const, label: 'Private' },
  ]
  const priorityItems: Array<{ value: UcatLearningModuleStudyPlanPriority; label: string }> = [
    { value: 'essential', label: 'Essential' },
    { value: 'recommended', label: 'Recommended' },
    { value: 'optional', label: 'Optional' },
    { value: 'excluded', label: 'Excluded' },
  ]
  const selectedPriority = priorityItems.find((item) => item.value === studyPlanPriority) ?? priorityItems[1]
  const categoryOptions = (categoriesQuery.data ?? [])
    .filter((category) => category.id && (!sectionId || category.ucat_section_id === sectionId))
    .map((category) => ({ id: category.id as string, name: category.name ?? 'Untitled category' }))
  // Child tags store ucat_section_id = null and inherit section from their root ancestor.
  const tagRows = tagsQuery.data ?? []
  const tagTaxonomyRows = tagRows
    .filter((tag): tag is typeof tag & { id: string } => Boolean(tag.id))
    .map((tag) => ({
      id: tag.id,
      parent_id: tag.parent_question_tag_id ?? null,
      section_id: tag.ucat_section_id ?? null,
    }))
  const tagOptions = tagRows
    .filter((tag) => {
      if (!tag.id) return false
      if (!sectionId) return true
      return resolveRootSectionId(tagTaxonomyRows, tag.id) === sectionId
    })
    .map((tag) => ({ id: tag.id as string, name: tag.name ?? 'Untitled tag' }))

  return (
    <aside className={cn('flex h-full w-full shrink-0 flex-col overflow-hidden bg-background p-3 lg:w-72 lg:border-l lg:p-4', className)}>
      <Tabs value={activeTab} onValueChange={handleActiveTabChange} className="flex h-full min-h-0 flex-1 flex-col">
        <TabsList className="hidden w-full grid-cols-2 lg:grid">
          <TabsTrigger value="properties">Properties</TabsTrigger>
          <TabsTrigger value="ai" disabled={!aiActions}>AI Tools</TabsTrigger>
        </TabsList>
        <TabsContent value="properties" className="min-h-0 flex-1 overflow-y-auto">
      <div className="space-y-4">
        {showModeControls ? (
          <div className={tutorCardCn('space-y-4 p-3')}>
            <PropertyRow label="Mode">
              <SegmentedControl
                fullWidth
                value={editorMode}
                onValueChange={onEditorModeChange}
                options={[
                  { value: 'edit', label: 'Edit' },
                  { value: 'view', label: 'View' },
                ]}
              />
            </PropertyRow>
          </div>
        ) : null}

        <Accordion type="multiple" defaultValue={['module']} className="space-y-4">
          <AccordionItem value="module" className="border-0">
            <div className={tutorCardCn('overflow-hidden')}>
              <AccordionTrigger className="px-3 py-2.5 hover:no-underline [&>svg]:text-muted-foreground">
                <span className="text-sm font-semibold">Module properties</span>
              </AccordionTrigger>
              <AccordionContent className="space-y-1 border-t border-black/[0.06] px-3 pb-4 pt-2 dark:border-white/10">
                <PropertyRow label="Title">
                  <Input
                    className="h-9"
                    value={title}
                    onChange={(e) => onTitleChange(e.target.value)}
                    readOnly={editorMode === 'view'}
                  />
                </PropertyRow>
                <div className="space-y-1.5 py-1.5">
                  <span className="text-sm text-muted-foreground">Description</span>
                  <Textarea
                    value={description}
                    onChange={(e) => onDescriptionChange(e.target.value)}
                    rows={3}
                    className="min-h-20"
                    readOnly={editorMode === 'view'}
                  />
                </div>
                {kind === 'lesson' ? (
                  <>
                    <PropertyRow label="Card icon">
                      <SearchableSelect<{ value: LearningModuleIconKey; label: string }>
                        items={[...LEARNING_MODULE_ICON_OPTIONS]}
                        value={LEARNING_MODULE_ICON_OPTIONS.find((option) => option.value === iconKey) ?? LEARNING_MODULE_ICON_OPTIONS[0]}
                        onValueChange={(item) => item && onIconKeyChange(item.value)}
                        getItemLabel={(item) => item.label}
                        getItemId={(item) => item.value}
                        disabled={editorMode === 'view'}
                      />
                    </PropertyRow>
                    <PropertyRow label="Est. minutes">
                      <Input
                        type="number"
                        min={1}
                        max={600}
                        value={estimatedMinutes ?? ''}
                        onChange={(event) => {
                          const value = event.target.valueAsNumber
                          onEstimatedMinutesChange(Number.isFinite(value) ? value : null)
                        }}
                        placeholder="e.g. 15"
                        readOnly={editorMode === 'view'}
                      />
                    </PropertyRow>
                  </>
                ) : null}
                <PropertyRow label="Section">
                  <SearchableSelect<{ id: string; name: string | null }>
                    items={sectionItems}
                    value={selectedSection}
                    onValueChange={(item) => {
                      const nextSectionId = item?.id === 'none' ? null : item?.id ?? null
                      if (nextSectionId !== sectionId) onParentIdChange(null)
                      onSectionIdChange(nextSectionId)
                    }}
                    getItemLabel={(s) => s.name ?? 'None'}
                    getItemId={(s) => s.id}
                    placeholder="Select section"
                    disabled={editorMode === 'view'}
                  />
                </PropertyRow>
                <PropertyRow label="Parent folder">
                  <SearchableSelect<{ id: string; name: string }>
                    items={parentItems}
                    value={selectedParent}
                    onValueChange={(item) =>
                      onParentIdChange(item?.id === 'none' ? null : item?.id ?? null)
                    }
                    getItemLabel={(p) => p.name}
                    getItemId={(p) => p.id}
                    placeholder="Root"
                    disabled={editorMode === 'view'}
                  />
                </PropertyRow>
                {kind === 'lesson' ? (
                  <PropertyRow label="Access">
                    <SearchableSelect<{ value: UcatAccessScope; label: string }>
                      items={visibilityItems}
                      value={accessScope === 'private' ? visibilityItems[1] : visibilityItems[0]}
                      onValueChange={(item) => onAccessScopeChange(item?.value === 'private' ? 'private' : 'public')}
                      getItemLabel={(v) => v.label}
                      getItemId={(v) => v.value}
                      disabled={editorMode === 'view'}
                    />
                  </PropertyRow>
                ) : null}
              </AccordionContent>
            </div>
          </AccordionItem>

          {kind === 'folder' ? (
            <p className="px-1 text-xs text-muted-foreground">
              Folders organise lessons. Add child lessons by setting their parent folder.
            </p>
          ) : null}

          {kind === 'lesson' ? (
            <AccordionItem value="study-plan" className="border-0">
              <div className={tutorCardCn('overflow-hidden')}>
                <AccordionTrigger className="px-3 py-2.5 hover:no-underline [&>svg]:text-muted-foreground">
                  <span className="text-sm font-semibold">Study plan</span>
                </AccordionTrigger>
                <AccordionContent className="space-y-3 border-t border-black/[0.06] px-3 pb-4 pt-3 dark:border-white/10">
                  <PropertyRow label="Priority">
                    <SearchableSelect<{ value: UcatLearningModuleStudyPlanPriority; label: string }>
                      items={priorityItems}
                      value={selectedPriority}
                      onValueChange={(item) => item && onStudyPlanPriorityChange(item.value)}
                      getItemLabel={(item) => item.label}
                      getItemId={(item) => item.value}
                      disabled={editorMode === 'view'}
                    />
                  </PropertyRow>
                  <p className="text-xs text-muted-foreground">
                    Essential and recommended lessons are placed near the start. Excluded lessons are never prescribed.
                  </p>
                  <div className="space-y-2">
                    <span className="text-sm text-muted-foreground">Question categories</span>
                    <SearchableSelect<{ id: string; name: string }>
                      items={categoryOptions.filter((item) => !studyPlanCategoryIds.includes(item.id))}
                      value={null}
                      onValueChange={(item) => item && onStudyPlanCategoryIdsChange([...studyPlanCategoryIds, item.id])}
                      getItemLabel={(item) => item.name}
                      getItemId={(item) => item.id}
                      placeholder="Add category"
                      disabled={editorMode === 'view'}
                    />
                    <div className="flex flex-wrap gap-1.5">
                      {studyPlanCategoryIds.map((id) => (
                        <button key={id} type="button" disabled={editorMode === 'view'} onClick={() => onStudyPlanCategoryIdsChange(studyPlanCategoryIds.filter((value) => value !== id))} className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-xs">
                          {categoryOptions.find((item) => item.id === id)?.name ?? 'Unknown category'}
                          {editorMode === 'edit' ? <X className="h-3 w-3" /> : null}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <span className="text-sm text-muted-foreground">Question tags</span>
                    <SearchableSelect<{ id: string; name: string }>
                      items={tagOptions.filter((item) => !studyPlanTagIds.includes(item.id))}
                      value={null}
                      onValueChange={(item) => item && onStudyPlanTagIdsChange([...studyPlanTagIds, item.id])}
                      getItemLabel={(item) => item.name}
                      getItemId={(item) => item.id}
                      placeholder="Add tag"
                      disabled={editorMode === 'view'}
                    />
                    <div className="flex flex-wrap gap-1.5">
                      {studyPlanTagIds.map((id) => (
                        <button key={id} type="button" disabled={editorMode === 'view'} onClick={() => onStudyPlanTagIdsChange(studyPlanTagIds.filter((value) => value !== id))} className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-xs">
                          {tagOptions.find((item) => item.id === id)?.name ?? 'Unknown tag'}
                          {editorMode === 'edit' ? <X className="h-3 w-3" /> : null}
                        </button>
                      ))}
                    </div>
                  </div>
                </AccordionContent>
              </div>
            </AccordionItem>
          ) : null}

          <AccordionItem value="section-order" className="border-0">
            <div className={tutorCardCn('overflow-hidden')}>
              <AccordionTrigger className="px-3 py-2.5 hover:no-underline [&>svg]:text-muted-foreground">
                <span className="text-sm font-semibold">Section order</span>
              </AccordionTrigger>
              <AccordionContent className="border-t border-black/[0.06] px-3 pb-4 pt-3 dark:border-white/10">
                <UcatLearningModuleOrderEditor
                  moduleId={moduleId}
                  sectionId={sectionId}
                  modules={draftModules}
                  editorMode={editorMode}
                  onSaveSectionOrder={onSaveSectionOrder}
                />
              </AccordionContent>
            </div>
          </AccordionItem>
        </Accordion>
      </div>
        </TabsContent>
        <TabsContent
          forceMount
          value="ai"
          className={cn('h-full min-h-0 flex-1 overflow-hidden', activeTab !== 'ai' && 'hidden')}
        >
          {aiActions}
        </TabsContent>
      </Tabs>
    </aside>
  )
}
