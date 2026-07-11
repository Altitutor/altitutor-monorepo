'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
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
import type { UcatSectionOption } from '@/features/ucat/questions/components/UcatQuestionStemDialog'
import type { UcatLearningModuleRow } from '@/features/ucat/learning-modules/types'
import type { UcatLearningModuleKind } from '@/features/ucat/learning-modules/types'
import { UcatLearningModuleOrderEditor } from '@/features/ucat/learning-modules/components/UcatLearningModuleOrderEditor'
import {
  isDescendantOf,
  resolveRootSectionId,
} from '@/features/ucat/shared/lib/taxonomy-reparent'
import type { UcatAuthoringWorkspaceTab } from '@/features/ucat/shared/components/UcatAuthoringWorkspaceTabs'
export type LearningModuleEditorMode = 'edit' | 'view'

type UcatLearningModuleSettingsPanelProps = {
  moduleId: string | null
  kind: UcatLearningModuleKind
  title: string
  description: string
  sectionId: string | null
  parentId: string | null
  isPrivate: boolean
  onTitleChange: (title: string) => void
  onDescriptionChange: (description: string) => void
  onSectionIdChange: (sectionId: string | null) => void
  onParentIdChange: (parentId: string | null) => void
  onIsPrivateChange: (isPrivate: boolean) => void
  sections: UcatSectionOption[]
  modules: UcatLearningModuleRow[]
  folderOptions: UcatLearningModuleRow[]
  onSaveSectionOrder: (items: Array<{ id: string; index: number }>) => Promise<void>
  editorMode: LearningModuleEditorMode
  onEditorModeChange: (mode: LearningModuleEditorMode) => void
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
  sectionId,
  parentId,
  isPrivate,
  onTitleChange,
  onDescriptionChange,
  onSectionIdChange,
  onParentIdChange,
  onIsPrivateChange,
  sections,
  modules,
  folderOptions,
  onSaveSectionOrder,
  editorMode,
  onEditorModeChange,
  aiActions,
  activeTab: controlledActiveTab,
  onActiveTabChange,
  className,
}: UcatLearningModuleSettingsPanelProps) {
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

  return (
    <aside className={cn('flex h-full w-full shrink-0 flex-col overflow-hidden bg-background p-3 lg:w-72 lg:border-l lg:p-4', className)}>
      <Tabs value={activeTab} onValueChange={handleActiveTabChange} className="flex h-full min-h-0 flex-1 flex-col">
        <TabsList className="hidden w-full grid-cols-2 lg:grid">
          <TabsTrigger value="properties">Properties</TabsTrigger>
          <TabsTrigger value="ai" disabled={!aiActions}>AI Tools</TabsTrigger>
        </TabsList>
        <TabsContent value="properties" className="min-h-0 flex-1 overflow-y-auto">
      <div className="space-y-4">
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
                <PropertyRow label="Visibility">
                  <SearchableSelect<{ value: 'public' | 'private'; label: string }>
                    items={visibilityItems}
                    value={isPrivate ? visibilityItems[1] : visibilityItems[0]}
                    onValueChange={(item) => onIsPrivateChange(item?.value === 'private')}
                    getItemLabel={(v) => v.label}
                    getItemId={(v) => v.value}
                    disabled={editorMode === 'view'}
                  />
                </PropertyRow>
              </AccordionContent>
            </div>
          </AccordionItem>

          {kind === 'folder' ? (
            <p className="px-1 text-xs text-muted-foreground">
              Folders organise lessons. Add child lessons by setting their parent folder.
            </p>
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
