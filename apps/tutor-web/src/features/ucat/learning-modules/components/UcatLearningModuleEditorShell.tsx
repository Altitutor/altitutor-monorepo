'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Editor } from '@tiptap/react'
import { SearchableSelect } from '@altitutor/ui'
import {
  useUcatQuestionCatalog,
  useUcatSections,
  useUcatStemCatalog,
} from '@/features/ucat/questions/hooks/useUcatQuestions'
import { useUcatSkillTrainersCatalog } from '@/features/ucat/skill-trainer/hooks/useUcatSkillTrainerItems'
import type { useLearningModuleEditor } from '@/features/ucat/learning-modules/hooks/useLearningModuleEditor'
import { UcatLearningModuleBlockCard } from '@/features/ucat/learning-modules/components/UcatLearningModuleBlockCard'
import { UcatLearningModuleLessonPreview } from '@/features/ucat/learning-modules/components/UcatLearningModuleLessonPreview'
import { UcatLearningModuleSettingsPanel } from '@/features/ucat/learning-modules/components/UcatLearningModuleSettingsPanel'
import type { LearningModuleEditorMode } from '@/features/ucat/learning-modules/components/UcatLearningModuleSettingsPanel'
import { UcatAuthoringAgentChat } from '@/features/ucat/authoring-agent/UcatAuthoringAgentChat'
import type { UcatAuthoringToolCall, UcatAuthoringToolResult } from '@/features/ucat/authoring-agent/types'
import {
  BLOCK_TYPE_LABELS,
  newDraftBlock,
} from '@/features/ucat/learning-modules/lib/learning-module-editor-types'
import type { UcatLearningModuleBlockType } from '@/features/ucat/learning-modules/types'
import { aiTextToProseMirror } from '@/features/ucat/shared/lib/rich-text'
import type { Json } from '@altitutor/shared'
import { appendImageNode, appendImageNodeToDoc, replaceFirstImageNode, replaceFirstImageNodeInDoc } from '@/features/ucat/authoring-agent/rich-text-image'
import { generatedVisualBlockToImageNode, getGeneratedVisualSpecIssue } from '@/features/ucat/questions/lib/ai-generation/content-blocks'
import type { GeneratedContentBlock } from '@/features/ucat/questions/lib/ai-generation/schema'
import {
  UcatAuthoringWorkspaceTabs,
  type UcatAuthoringWorkspaceTab,
} from '@/features/ucat/shared/components/UcatAuthoringWorkspaceTabs'
import { cn } from '@/shared/utils'

type LearningModuleEditor = ReturnType<typeof useLearningModuleEditor>

type UcatLearningModuleEditorShellProps = {
  editor: LearningModuleEditor
  hasUcatAccess: boolean
  onActiveTextEditorChange?: (editor: Editor | null) => void
}

const BLOCK_TYPE_OPTIONS = (Object.keys(BLOCK_TYPE_LABELS) as UcatLearningModuleBlockType[]).map(
  (type) => ({
    value: type,
    label: BLOCK_TYPE_LABELS[type],
  }),
)

function scoreCatalogMatch(query: string, haystack: string) {
  const terms = query
    .toLowerCase()
    .split(/[^a-z0-9]+/u)
    .filter((term) => term.length > 2)
  const target = haystack.toLowerCase()
  if (terms.length === 0) return 0
  return terms.reduce((score, term) => score + (target.includes(term) ? 1 : 0), 0)
}

export function UcatLearningModuleEditorShell({
  editor,
  hasUcatAccess,
  onActiveTextEditorChange,
}: UcatLearningModuleEditorShellProps) {
  const [editorMode, setEditorMode] = useState<LearningModuleEditorMode>('edit')
  const [activeWorkspace, setActiveWorkspace] = useState<UcatAuthoringWorkspaceTab>('editor')
  const blockCardRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  const handleTextEditorActive = useCallback(
    (textEditor: Editor | null) => {
      onActiveTextEditorChange?.(textEditor)
    },
    [onActiveTextEditorChange],
  )

  const { data: sections } = useUcatSections()
  const stemCatalog = useUcatStemCatalog(hasUcatAccess, { publishedOnly: true })
  const questionCatalog = useUcatQuestionCatalog(hasUcatAccess)
  const { data: skillTrainers } = useUcatSkillTrainersCatalog()

  const stemOptions = useMemo(() => stemCatalog.data ?? [], [stemCatalog.data])
  const questionOptions = useMemo(() => questionCatalog.data ?? [], [questionCatalog.data])
  const skillTrainerOptions = useMemo(
    () =>
      (skillTrainers ?? [])
        .filter((trainer): trainer is { id: string; key: string | null; name: string | null } => Boolean(trainer.id))
        .map((trainer) => ({
          id: trainer.id,
          key: trainer.key,
          name: trainer.name,
        })),
    [skillTrainers],
  )

  const sectionOptions = useMemo(
    () =>
      (sections ?? []).map((s) => ({
        id: s.id,
        name: s.name,
        display_columns: s.display_columns,
      })),
    [sections],
  )

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

  const executeLessonAgentTool = useCallback(
    async (toolCall: UcatAuthoringToolCall): Promise<UcatAuthoringToolResult> => {
      const input = toolCall.input
      const blockId = typeof input.blockId === 'string' ? input.blockId : null
      const index = typeof input.index === 'number' ? input.index : editor.draftBlocks.length
      const text = typeof input.text === 'string' ? input.text : ''

      switch (toolCall.name) {
        case 'updateLessonMetadata':
          if (typeof input.title === 'string') editor.setTitle(input.title)
          if (typeof input.description === 'string') editor.setDescription(input.description)
          if (typeof input.sectionId === 'string' || input.sectionId === null) editor.setSectionId(input.sectionId ?? null)
          if (typeof input.isPrivate === 'boolean') editor.setIsPrivate(input.isPrivate)
          return { toolCallId: toolCall.id, ok: true, message: 'Updated draft lesson metadata.' }

        case 'insertTextBlock': {
          const block = newDraftBlock('text')
          editor.insertBlock(
            {
              ...block,
              content: {
                ...block.content,
                body: aiTextToProseMirror(text),
              },
            },
            index,
          )
          return {
            toolCallId: toolCall.id,
            ok: true,
            message: `Inserted draft text block at position ${index + 1}.`,
            output: {
              blockId: block.clientId,
              blockType: 'text',
              index,
              text,
            },
          }
        }

        case 'updateTextBlock': {
          if (!blockId) return { toolCallId: toolCall.id, ok: false, message: 'No block selected.' }
          editor.updateBlock(blockId, {
            content: {
              ...(editor.draftBlocks.find((block) => block.clientId === blockId)?.content ?? {}),
              body: aiTextToProseMirror(text),
            },
          })
          return {
            toolCallId: toolCall.id,
            ok: true,
            message: 'Updated draft text block.',
            output: {
              blockId,
              blockType: 'text',
              text,
            },
          }
        }

        case 'insertQuestionStemBlock': {
          if (typeof input.questionStemId !== 'string') {
            return { toolCallId: toolCall.id, ok: false, message: 'No question stem ID provided.' }
          }
          const block = newDraftBlock('question_stem')
          editor.insertBlock({ ...block, question_stem_id: input.questionStemId }, index)
          return {
            toolCallId: toolCall.id,
            ok: true,
            message: 'Inserted draft question stem block.',
            output: {
              blockId: block.clientId,
              blockType: 'question_stem',
              index,
              questionStemId: input.questionStemId,
            },
          }
        }

        case 'insertQuestionBlock': {
          if (typeof input.questionId !== 'string') {
            return { toolCallId: toolCall.id, ok: false, message: 'No question ID provided.' }
          }
          const block = newDraftBlock('question')
          editor.insertBlock({ ...block, question_id: input.questionId }, index)
          return {
            toolCallId: toolCall.id,
            ok: true,
            message: 'Inserted draft question block.',
            output: {
              blockId: block.clientId,
              blockType: 'question',
              index,
              questionId: input.questionId,
            },
          }
        }

        case 'insertBestMatchingQuestionStem': {
          const query = typeof input.query === 'string' ? input.query : ''
          if (!query.trim()) return { toolCallId: toolCall.id, ok: false, message: 'No question stem search query provided.' }
          const match = stemOptions
            .map((stem) => ({
              stem,
              score: scoreCatalogMatch(
                query,
                [stem.text, stem.sectionName, stem.categoryName, stem.typeSummary].filter(Boolean).join(' '),
              ),
            }))
            .sort((a, b) => b.score - a.score)[0]
          if (!match || match.score <= 0) {
            return { toolCallId: toolCall.id, ok: false, message: `No matching question stem found for "${query}".` }
          }
          const block = newDraftBlock('question_stem')
          editor.insertBlock({ ...block, question_stem_id: match.stem.id }, index)
          return {
            toolCallId: toolCall.id,
            ok: true,
            message: `Inserted matching question stem: ${match.stem.text.slice(0, 80)}.`,
            output: {
              blockId: block.clientId,
              blockType: 'question_stem',
              index,
              questionStemId: match.stem.id,
              stemText: match.stem.text,
              sectionName: match.stem.sectionName,
              categoryName: match.stem.categoryName,
              typeSummary: match.stem.typeSummary,
            },
          }
        }

        case 'insertBestMatchingQuestion': {
          const query = typeof input.query === 'string' ? input.query : ''
          if (!query.trim()) return { toolCallId: toolCall.id, ok: false, message: 'No question search query provided.' }
          const match = questionOptions
            .map((question) => ({
              question,
              score: scoreCatalogMatch(query, [question.label, question.sectionName, question.questionType].join(' ')),
            }))
            .sort((a, b) => b.score - a.score)[0]
          if (!match || match.score <= 0) {
            return { toolCallId: toolCall.id, ok: false, message: `No matching question found for "${query}".` }
          }
          const block = newDraftBlock('question')
          editor.insertBlock({ ...block, question_id: match.question.id }, index)
          return {
            toolCallId: toolCall.id,
            ok: true,
            message: `Inserted matching question: ${match.question.label}.`,
            output: {
              blockId: block.clientId,
              blockType: 'question',
              index,
              questionId: match.question.id,
              label: match.question.label,
              sectionName: match.question.sectionName,
              questionType: match.question.questionType,
            },
          }
        }

        case 'insertSkillTrainerBlock': {
          if (typeof input.skillTrainerId !== 'string') {
            return { toolCallId: toolCall.id, ok: false, message: 'No skill trainer ID provided.' }
          }
          const block = newDraftBlock('skill_trainer')
          editor.insertBlock({ ...block, skill_trainer_id: input.skillTrainerId }, index)
          return {
            toolCallId: toolCall.id,
            ok: true,
            message: 'Inserted draft skill trainer block.',
            output: {
              blockId: block.clientId,
              blockType: 'skill_trainer',
              index,
              skillTrainerId: input.skillTrainerId,
            },
          }
        }

        case 'moveBlock': {
          const fromIndex = editor.draftBlocks.findIndex((block) => block.clientId === blockId)
          const toIndex = typeof input.toIndex === 'number' ? input.toIndex : -1
          if (fromIndex < 0 || toIndex < 0) return { toolCallId: toolCall.id, ok: false, message: 'Block not found.' }
          editor.moveBlock(fromIndex, toIndex)
          return { toolCallId: toolCall.id, ok: true, message: `Moved draft block to position ${toIndex + 1}.` }
        }

        case 'updateBlockGate':
          if (!blockId || typeof input.requireCompletionBeforeNext !== 'boolean') {
            return { toolCallId: toolCall.id, ok: false, message: 'Block gate update is incomplete.' }
          }
          editor.updateBlock(blockId, { require_completion_before_next: input.requireCompletionBeforeNext })
          return { toolCallId: toolCall.id, ok: true, message: 'Updated draft block completion gate.' }

        case 'deleteBlock':
          if (!blockId) return { toolCallId: toolCall.id, ok: false, message: 'No block selected.' }
          editor.removeBlock(blockId)
          return { toolCallId: toolCall.id, ok: true, message: 'Deleted draft lesson block.' }

        case 'insertImage':
        case 'replaceImageFromPrompt': {
          const prompt = typeof input.prompt === 'string' ? input.prompt : ''
          if (!prompt.trim()) return { toolCallId: toolCall.id, ok: false, message: 'No image prompt provided.' }
          const targetBlockId = blockId ?? editor.selectedBlockId
          const targetBlock = editor.draftBlocks.find((block) => block.clientId === targetBlockId)
          if (!targetBlock || targetBlock.block_type !== 'text') {
            return { toolCallId: toolCall.id, ok: false, message: 'Select a text block before inserting an image.' }
          }
          const response = await fetch('/api/ucat/authoring-agent/images/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              prompt,
              alt: typeof input.alt === 'string' ? input.alt : null,
            }),
          })
          const image = (await response.json()) as {
            fileId?: string
            signedUrl?: string
            alt?: string | null
            error?: string
          }
          if (!response.ok || !image.fileId || !image.signedUrl) {
            return { toolCallId: toolCall.id, ok: false, message: image.error ?? 'Image generation failed.' }
          }
          const nextImage = {
            src: image.signedUrl,
            fileId: image.fileId,
            alt: image.alt ?? null,
          }
          editor.updateBlock(targetBlock.clientId, {
            content: {
              ...targetBlock.content,
              body: toolCall.name === 'replaceImageFromPrompt'
                ? replaceFirstImageNodeInDoc(targetBlock.content.body as Json | null, nextImage)
                : appendImageNodeToDoc(targetBlock.content.body as Json | null, nextImage),
            },
          })
          return {
            toolCallId: toolCall.id,
            ok: true,
            message: toolCall.name === 'replaceImageFromPrompt'
              ? 'Replaced generated image in the selected text block.'
              : 'Inserted generated image into the selected text block.',
          }
        }

        case 'replaceVisualSpec': {
          const targetBlockId = blockId ?? editor.selectedBlockId
          const targetBlock = editor.draftBlocks.find((block) => block.clientId === targetBlockId)
          if (!targetBlock || targetBlock.block_type !== 'text') {
            return { toolCallId: toolCall.id, ok: false, message: 'Select a text block before inserting a visual.' }
          }
          const spec = input.spec && typeof input.spec === 'object' && !Array.isArray(input.spec)
            ? input.spec as Record<string, unknown>
            : null
          if (!spec) return { toolCallId: toolCall.id, ok: false, message: 'No visual spec provided.' }
          const visualBlock = {
            type: 'visual',
            visualType: typeof input.visualType === 'string' ? input.visualType : 'venn_diagram',
            title: typeof input.title === 'string' ? input.title : null,
            altText: typeof input.altText === 'string' ? input.altText : '',
            spec,
          } as Extract<GeneratedContentBlock, { type: 'visual' }>
          const specIssue = getGeneratedVisualSpecIssue(visualBlock)
          if (specIssue) return { toolCallId: toolCall.id, ok: false, message: specIssue }
          const imageNode = generatedVisualBlockToImageNode(visualBlock)
          editor.updateBlock(targetBlock.clientId, {
            content: {
              ...targetBlock.content,
              body: input.mode === 'append'
                ? appendImageNode(targetBlock.content.body as Json | null, imageNode)
                : replaceFirstImageNode(targetBlock.content.body as Json | null, imageNode),
            },
          })
          return { toolCallId: toolCall.id, ok: true, message: 'Inserted deterministic visual in the selected text block.' }
        }

        default:
          return { toolCallId: toolCall.id, ok: false, message: `${toolCall.name} is not available in the lesson editor yet.` }
      }
    },
    [editor, questionOptions, stemOptions],
  )

  useEffect(() => {
    if (editorMode !== 'edit') {
      onActiveTextEditorChange?.(null)
    }
  }, [editorMode, onActiveTextEditorChange])

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <UcatAuthoringWorkspaceTabs
        value={activeWorkspace}
        onValueChange={setActiveWorkspace}
        editorLabel="Lesson"
        aiAvailable={editor.kind === 'lesson'}
        className="shrink-0 border-b bg-background p-2 lg:hidden"
      />
      <div className="flex min-h-0 flex-1 overflow-hidden lg:flex-row">
        <div className={cn('flex min-h-0 flex-1 flex-col overflow-hidden', activeWorkspace !== 'editor' && 'hidden', 'lg:flex')}>
        {editorMode === 'view' && editor.kind === 'lesson' ? (
          <UcatLearningModuleLessonPreview
            title={editor.title}
            description={editor.description}
            blocks={editor.draftBlocks}
            stemOptions={stemOptions}
            questionOptions={questionOptions}
            skillTrainers={skillTrainerOptions}
          />
        ) : null}

        {editorMode === 'view' && editor.kind === 'folder' ? (
          <div className="flex min-h-0 flex-1 items-center justify-center p-8 text-center text-sm text-muted-foreground">
            Folder preview is not available. Switch to Edit to configure child lessons.
          </div>
        ) : null}

        {editorMode === 'edit' && editor.kind === 'lesson' ? (
          <aside className="flex min-h-0 min-w-0 flex-1 flex-col bg-muted/20">
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
                      skillTrainers={skillTrainerOptions}
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

        </div>

        <UcatLearningModuleSettingsPanel
          moduleId={editor.moduleId}
          kind={editor.kind}
          title={editor.title}
          description={editor.description}
          iconKey={editor.iconKey}
          estimatedMinutes={editor.estimatedMinutes}
          sectionId={editor.sectionId}
          parentId={editor.parentId}
          isPrivate={editor.isPrivate}
          studyPlanPriority={editor.studyPlanPriority}
          studyPlanCategoryIds={editor.studyPlanCategoryIds}
          studyPlanTagIds={editor.studyPlanTagIds}
          onTitleChange={editor.setTitle}
          onDescriptionChange={editor.setDescription}
          onIconKeyChange={editor.setIconKey}
          onEstimatedMinutesChange={editor.setEstimatedMinutes}
          onSectionIdChange={editor.setSectionId}
          onParentIdChange={editor.setParentId}
          onIsPrivateChange={editor.setIsPrivate}
          onStudyPlanPriorityChange={editor.setStudyPlanPriority}
          onStudyPlanCategoryIdsChange={editor.setStudyPlanCategoryIds}
          onStudyPlanTagIdsChange={editor.setStudyPlanTagIds}
          sections={sectionOptions}
          modules={editor.allModules}
          folderOptions={editor.folderOptions}
          onSaveSectionOrder={editor.saveModuleOrder}
          editorMode={editorMode}
          onEditorModeChange={setEditorMode}
          aiActions={
            editor.kind === 'lesson' ? (
              <UcatAuthoringAgentChat
                contextType="learning_module_lesson"
                scope="lesson"
                scopeLabel={editor.selectedBlock ? `Selected block: ${BLOCK_TYPE_LABELS[editor.selectedBlock.block_type]}` : 'Lesson'}
                snapshot={{
                  moduleId: editor.moduleId,
                  title: editor.title,
                  description: editor.description,
                  sectionId: editor.sectionId,
                  isPrivate: editor.isPrivate,
                  selectedBlockId: editor.selectedBlockId,
                  blocks: editor.draftBlocks,
                  searchableCatalog: {
                    questionStemCount: stemOptions.length,
                    questionCount: questionOptions.length,
                    sampleQuestionStems: stemOptions.slice(0, 20).map((stem) => ({
                      id: stem.id,
                      text: stem.text.slice(0, 180),
                      sectionName: stem.sectionName,
                      categoryName: stem.categoryName,
                      typeSummary: stem.typeSummary,
                    })),
                    sampleQuestions: questionOptions.slice(0, 20).map((question) => ({
                      id: question.id,
                      label: question.label,
                      sectionName: question.sectionName,
                      questionType: question.questionType,
                    })),
                  },
                } as Json}
                placeholder="Ask AI to edit this lesson..."
                onExecuteTool={executeLessonAgentTool}
              />
            ) : null
          }
          activeTab={activeWorkspace === 'editor' ? 'properties' : activeWorkspace}
          onActiveTabChange={setActiveWorkspace}
          className={cn(activeWorkspace === 'editor' && 'hidden', 'lg:flex')}
        />
      </div>

    </div>
  )
}
