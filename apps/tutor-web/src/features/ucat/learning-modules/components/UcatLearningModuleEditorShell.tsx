'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Editor } from '@tiptap/react'
import { RichTextEditorBottomToolbar, SearchableSelect } from '@altitutor/ui'
import {
  useUcatQuestionCatalog,
  useUcatSections,
  useUcatStemCatalog,
} from '@/features/ucat/questions/hooks/useUcatQuestions'
import { useUcatSkillTrainerSets } from '@/features/ucat/skill-trainer-sets/hooks/useUcatSkillTrainerSets'
import type { useLearningModuleEditor } from '@/features/ucat/learning-modules/hooks/useLearningModuleEditor'
import { UcatLearningModuleBlockCard } from '@/features/ucat/learning-modules/components/UcatLearningModuleBlockCard'
import { UcatLearningModuleLessonPreview } from '@/features/ucat/learning-modules/components/UcatLearningModuleLessonPreview'
import { UcatLearningModuleSettingsPanel } from '@/features/ucat/learning-modules/components/UcatLearningModuleSettingsPanel'
import type { LearningModuleEditorMode } from '@/features/ucat/learning-modules/components/UcatLearningModuleSettingsPanel'
import {
  BLOCK_TYPE_LABELS,
  newDraftBlock,
} from '@/features/ucat/learning-modules/lib/learning-module-editor-types'
import type { UcatLearningModuleBlockType } from '@/features/ucat/learning-modules/types'

type LearningModuleEditor = ReturnType<typeof useLearningModuleEditor>

type UcatLearningModuleEditorShellProps = {
  editor: LearningModuleEditor
  hasUcatAccess: boolean
}

const BLOCK_TYPE_OPTIONS = (Object.keys(BLOCK_TYPE_LABELS) as UcatLearningModuleBlockType[]).map(
  (type) => ({
    value: type,
    label: BLOCK_TYPE_LABELS[type],
  }),
)

export function UcatLearningModuleEditorShell({
  editor,
  hasUcatAccess,
}: UcatLearningModuleEditorShellProps) {
  const [editorMode, setEditorMode] = useState<LearningModuleEditorMode>('edit')
  const [activeTextEditor, setActiveTextEditor] = useState<Editor | null>(null)
  const [popoverContainer, setPopoverContainer] = useState<HTMLElement | null>(null)
  const shellRef = useRef<HTMLDivElement>(null)
  const blockCardRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  const { data: sections } = useUcatSections()
  const stemCatalog = useUcatStemCatalog(hasUcatAccess)
  const questionCatalog = useUcatQuestionCatalog(hasUcatAccess)
  const { data: skillTrainerSets } = useUcatSkillTrainerSets()

  const stemOptions = useMemo(() => stemCatalog.data ?? [], [stemCatalog.data])
  const questionOptions = useMemo(() => questionCatalog.data ?? [], [questionCatalog.data])

  const sectionOptions = useMemo(
    () =>
      (sections ?? []).map((s) => ({
        id: s.id,
        name: s.name,
        display_columns: s.display_columns,
      })),
    [sections],
  )

  useEffect(() => {
    const node = shellRef.current
    if (!node) return
    const dialog = node.closest('[role="dialog"]')
    setPopoverContainer(dialog instanceof HTMLElement ? dialog : node)
  }, [])

  const handleAddBlock = useCallback(
    (type: UcatLearningModuleBlockType) => {
      const block = newDraftBlock(type)
      editor.addBlock(block)
      requestAnimationFrame(() => {
        blockCardRefs.current.get(block.clientId)?.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
        })
      })
    },
    [editor],
  )

  const handleTextEditorActive = useCallback((textEditor: Editor | null) => {
    setActiveTextEditor(textEditor)
  }, [])

  return (
    <div ref={shellRef} className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {editorMode === 'view' && editor.kind === 'lesson' ? (
          <UcatLearningModuleLessonPreview
            title={editor.title}
            description={editor.description}
            displayMode={editor.displayMode}
            blocks={editor.draftBlocks}
            stemOptions={stemOptions}
            questionOptions={questionOptions}
            skillTrainerSets={skillTrainerSets ?? []}
          />
        ) : null}

        {editorMode === 'view' && editor.kind === 'folder' ? (
          <div className="flex min-h-0 flex-1 items-center justify-center p-8 text-center text-sm text-muted-foreground">
            Folder preview is not available. Switch to Edit to configure child lessons.
          </div>
        ) : null}

        {editorMode === 'edit' && editor.kind === 'lesson' ? (
          <aside className="flex min-h-0 min-w-0 flex-1 flex-col bg-muted/20">
            <div className="border-b bg-background px-4 py-2.5">
              <p className="text-sm font-semibold">Lesson blocks</p>
              <p className="text-xs text-muted-foreground">
                Scroll through blocks and edit inline
              </p>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              <div className="mx-auto flex max-w-xl flex-col gap-3">
                {editor.draftBlocks.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No blocks yet. Add one below.</p>
                ) : (
                  editor.draftBlocks.map((block, index) => (
                    <UcatLearningModuleBlockCard
                      key={block.clientId}
                      ref={(node) => {
                        if (node) {
                          blockCardRefs.current.set(block.clientId, node)
                        } else {
                          blockCardRefs.current.delete(block.clientId)
                        }
                      }}
                      block={block}
                      index={index}
                      totalBlocks={editor.draftBlocks.length}
                      moduleId={editor.moduleId}
                      stemOptions={stemOptions}
                      questionOptions={questionOptions}
                      skillTrainerSets={skillTrainerSets ?? []}
                      popoverContainer={popoverContainer}
                      isHighlighted={editor.selectedBlockId === block.clientId}
                      onUpdate={(patch) => editor.updateBlock(block.clientId, patch)}
                      onMoveUp={() => editor.moveBlock(index, index - 1)}
                      onMoveDown={() => editor.moveBlock(index, index + 1)}
                      onRemove={() => editor.removeBlock(block.clientId)}
                      onTextEditorActive={handleTextEditorActive}
                    />
                  ))
                )}
                <div className="pt-1">
                  <SearchableSelect<{ value: UcatLearningModuleBlockType; label: string }>
                    items={BLOCK_TYPE_OPTIONS}
                    value={null}
                    onValueChange={(item) => {
                      if (item) handleAddBlock(item.value)
                    }}
                    getItemLabel={(item) => item.label}
                    getItemId={(item) => item.value}
                    placeholder="Add block…"
                    searchPlaceholder="Search block types…"
                    emptyMessage="No block types"
                    popoverContainer={popoverContainer}
                  />
                </div>
              </div>
            </div>
          </aside>
        ) : null}

        {editorMode === 'edit' && editor.kind === 'folder' ? (
          <div className="flex min-h-0 flex-1 items-center justify-center p-8 text-center text-sm text-muted-foreground">
            This folder organises child modules. Use module properties on the right to configure it.
          </div>
        ) : null}

        <UcatLearningModuleSettingsPanel
          kind={editor.kind}
          title={editor.title}
          description={editor.description}
          sectionId={editor.sectionId}
          parentId={editor.parentId}
          index={editor.index}
          isPrivate={editor.isPrivate}
          displayMode={editor.displayMode}
          onTitleChange={editor.setTitle}
          onDescriptionChange={editor.setDescription}
          onSectionIdChange={editor.setSectionId}
          onParentIdChange={editor.setParentId}
          onIndexChange={editor.setIndex}
          onIsPrivateChange={editor.setIsPrivate}
          onDisplayModeChange={editor.setDisplayMode}
          sections={sectionOptions}
          folderOptions={editor.folderOptions}
          editorMode={editorMode}
          onEditorModeChange={setEditorMode}
        />
      </div>

      {activeTextEditor && editorMode === 'edit' ? (
        <div
          className="pointer-events-none flex-shrink-0 border-t bg-background/90 px-4 py-3 backdrop-blur-sm"
          data-rich-text-toolbar
        >
          <div className="pointer-events-auto mx-auto max-w-3xl">
            <RichTextEditorBottomToolbar editor={activeTextEditor} />
          </div>
        </div>
      ) : null}
    </div>
  )
}
