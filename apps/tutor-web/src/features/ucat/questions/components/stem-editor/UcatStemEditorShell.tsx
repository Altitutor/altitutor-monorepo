'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Editor } from '@tiptap/react'
import type { Json } from '@altitutor/shared'
import type { UseFormReturn } from 'react-hook-form'
import { useToast } from '@altitutor/ui'
import type { UcatQuestionStemFormValues } from '@/features/ucat/questions/types/schema'
import type { UcatQuestionSourceChannel } from '@/features/ucat/questions/api/questions'
import { UcatQuestionEnginePreview } from '@/features/ucat/question-engine-preview/UcatQuestionEnginePreview'
import { UcatTutorStemPreviewExamChrome } from '@/features/ucat/question-engine-preview/UcatTutorStemPreviewExamChrome'
import {
  resolveSectionDisplayColumns,
  stemFormValuesToEnginePreviewQuestion,
} from '@/features/ucat/question-engine-preview/mapStemFormToEnginePreview'
import {
  UcatStemEditorPropertiesPanel,
  type StemEditorFocusTarget,
  type StemEditorMode,
} from '@/features/ucat/questions/components/stem-editor/UcatStemEditorPropertiesPanel'
import { UcatStemEngineInlineEditor } from '@/features/ucat/questions/components/stem-editor/UcatStemEngineInlineEditor'
import type {
  CategoryOption,
  TagOption,
  UcatSectionOption,
} from '@/features/ucat/questions/components/UcatQuestionStemDialog'
import {
  UcatAuthoringWorkspaceTabs,
  type UcatAuthoringWorkspaceTab,
} from '@/features/ucat/shared/components/UcatAuthoringWorkspaceTabs'
import { cn } from '@/shared/utils'
import type { SelectedVisualImage } from '@/features/ucat/shared/lib/selected-visual-image'
import { replaceSelectedImageAttrs } from '@/features/ucat/shared/lib/selected-visual-image'
import { UcatSelectedImageMenu } from '@/features/ucat/shared/components/UcatSelectedImageMenu'
import { UcatVisualEditorDialog } from '@/features/ucat/questions/components/stem-editor/UcatVisualEditorDialog'
import { useExplanationFeedback } from '@/features/ucat/reconciliation/hooks/useExplanationFeedback'

type UcatStemEditorShellProps = {
  form: UseFormReturn<UcatQuestionStemFormValues>
  sections: UcatSectionOption[]
  categories: CategoryOption[]
  tags: TagOption[]
  stemId?: string | null
  enableImages?: boolean
  onNewImageFileIds?: (fileIds: string[]) => void
  /** Optional section title override (e.g. from saved stem row). */
  sectionTitleOverride?: string
  /** Saved stem display_columns when section list omits it. */
  displayColumnsFallback?: number | null
  className?: string
  /** Drop inner border/radius so the engine fills the dialog body edge-to-edge. */
  flush?: boolean
  /** Open the engine on this question (0-based). */
  initialQuestionIndex?: number
  /** Show prev/next question controls in exam chrome when the stem has multiple questions. */
  showQuestionNavigator?: boolean
  /** Initial edit vs preview mode (resets when stemId changes). */
  initialEditorMode?: StemEditorMode
  editorMode?: StemEditorMode
  onEditorModeChange?: (mode: StemEditorMode) => void
  showAnswer?: boolean
  onShowAnswerChange?: (show: boolean) => void
  showModeControls?: boolean
  /** Reports the focused TipTap editor for dialog footer or floating toolbar placement. */
  onActiveTextEditorChange?: (editor: Editor | null) => void
  onCurrentQuestionIndexChange?: (index: number) => void
  focusTarget?: StemEditorFocusTarget | null
  focusMessage?: string | null
  sourceChannel?: UcatQuestionSourceChannel | null
  aiGenerationMetadata?: Json | null
  createdByFirstName?: string | null
  createdByLastName?: string | null
  statusChangedByFirstName?: string | null
  statusChangedByLastName?: string | null
  statusChangedAt?: string | null
  selectedImage?: SelectedVisualImage | null
  onAcceptSelectedImage?: (imageNode: Json) => Promise<{ ok: boolean; message: string }> | { ok: boolean; message: string }
  workspaceTab?: UcatAuthoringWorkspaceTab
  onWorkspaceTabChange?: (tab: UcatAuthoringWorkspaceTab) => void
  aiReviewAvailable?: boolean
  onUseSelectedImageWithAi?: (image: SelectedVisualImage, editor: Editor) => void
}

function imageNodeAttrs(imageNode: Json): Record<string, Json | undefined> | null {
  if (!imageNode || typeof imageNode !== 'object' || Array.isArray(imageNode)) return null
  const attrs = (imageNode as Record<string, Json>).attrs
  if (!attrs || typeof attrs !== 'object' || Array.isArray(attrs)) return null
  return attrs as Record<string, Json | undefined>
}

export function UcatStemEditorShell({
  form,
  sections,
  categories,
  tags,
  stemId = null,
  enableImages = true,
  onNewImageFileIds,
  sectionTitleOverride,
  displayColumnsFallback,
  className,
  flush = false,
  initialQuestionIndex,
  showQuestionNavigator = false,
  initialEditorMode = 'edit',
  editorMode: controlledEditorMode,
  onEditorModeChange,
  showAnswer: controlledShowAnswer,
  onShowAnswerChange,
  showModeControls = true,
  onActiveTextEditorChange,
  onCurrentQuestionIndexChange,
  focusTarget = null,
  focusMessage = null,
  sourceChannel = null,
  aiGenerationMetadata = null,
  createdByFirstName = null,
  createdByLastName = null,
  statusChangedByFirstName = null,
  statusChangedByLastName = null,
  statusChangedAt = null,
  selectedImage = null,
  onAcceptSelectedImage,
  workspaceTab: controlledWorkspaceTab,
  onWorkspaceTabChange,
  aiReviewAvailable = Boolean(stemId),
  onUseSelectedImageWithAi,
}: UcatStemEditorShellProps) {
  const { toast } = useToast()
  const explanationFeedbackQuery = useExplanationFeedback(stemId)
  const [localEditorMode, setLocalEditorMode] = useState<StemEditorMode>(initialEditorMode)
  const [localShowAnswer, setLocalShowAnswer] = useState(false)
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(initialQuestionIndex ?? 0)
  const [localActiveWorkspace, setLocalActiveWorkspace] = useState<UcatAuthoringWorkspaceTab>('editor')
  const [activeTextEditor, setActiveTextEditor] = useState<Editor | null>(null)
  const [visualEditorContext, setVisualEditorContext] = useState<{
    image: SelectedVisualImage
    editor: Editor
  } | null>(null)
  const activeWorkspace = controlledWorkspaceTab ?? localActiveWorkspace
  const editorMode = controlledEditorMode ?? localEditorMode
  const showAnswer = controlledShowAnswer ?? localShowAnswer

  const handleWorkspaceChange = useCallback((tab: UcatAuthoringWorkspaceTab) => {
    setLocalActiveWorkspace(tab)
    onWorkspaceTabChange?.(tab)
  }, [onWorkspaceTabChange])

  const handleEditorModeChange = useCallback((mode: StemEditorMode) => {
    setLocalEditorMode(mode)
    onEditorModeChange?.(mode)
  }, [onEditorModeChange])

  const handleShowAnswerChange = useCallback((show: boolean) => {
    setLocalShowAnswer(show)
    onShowAnswerChange?.(show)
  }, [onShowAnswerChange])

  const handleTextEditorActive = useCallback(
    (textEditor: Editor | null) => {
      setActiveTextEditor(textEditor)
      onActiveTextEditorChange?.(textEditor)
    },
    [onActiveTextEditorChange],
  )

  const handleQuestionIndexChange = useCallback(
    (nextIndex: number) => {
      setCurrentQuestionIndex(nextIndex)
      onCurrentQuestionIndexChange?.(nextIndex)
    },
    [onCurrentQuestionIndexChange],
  )

  const watchedValues = form.watch()
  const watchedSectionId = form.watch('sectionId')
  const watchedQuestions = form.watch('questions')

  const sectionDisplayColumns = resolveSectionDisplayColumns(
    sections.find((s) => s.id === watchedSectionId)?.display_columns ?? undefined,
    displayColumnsFallback != null ? { display_columns: displayColumnsFallback } : undefined
  )

  const previewSectionTitle =
    sectionTitleOverride?.trim() ||
    sections.find((s) => s.id === watchedSectionId)?.name?.trim() ||
    'UCAT'

  const questionCount = watchedQuestions?.length ?? 0
  const safeQuestionIndex =
    questionCount > 0 ? Math.min(currentQuestionIndex, questionCount - 1) : 0
  const currentQuestionId = watchedQuestions?.[safeQuestionIndex]?.id
  const currentExplanationFeedback = explanationFeedbackQuery.data?.find(
    (feedback) => feedback.questionId === currentQuestionId,
  )

  const previewQuestion = useMemo(
    () =>
      questionCount > 0
        ? stemFormValuesToEnginePreviewQuestion(
            watchedValues as UcatQuestionStemFormValues,
            safeQuestionIndex,
            sectionDisplayColumns
          )
        : null,
    [watchedValues, safeQuestionIndex, sectionDisplayColumns, questionCount]
  )

  useEffect(() => {
    if (questionCount === 0) return
    setCurrentQuestionIndex((idx) => {
      const next = Math.min(idx, questionCount - 1)
      if (next !== idx) onCurrentQuestionIndexChange?.(next)
      return next
    })
  }, [questionCount, onCurrentQuestionIndexChange])

  useEffect(() => {
    if (initialQuestionIndex == null) return
    const next = Math.min(initialQuestionIndex, Math.max(questionCount - 1, 0))
    setCurrentQuestionIndex(next)
    onCurrentQuestionIndexChange?.(next)
  }, [initialQuestionIndex, questionCount, onCurrentQuestionIndexChange])

  useEffect(() => {
    setLocalEditorMode(initialEditorMode)
  }, [initialEditorMode, stemId])

  useEffect(() => {
    if (editorMode !== 'edit') {
      onActiveTextEditorChange?.(null)
    }
  }, [editorMode, onActiveTextEditorChange])

  useEffect(() => {
    if (selectedImage) handleWorkspaceChange('ai')
  }, [handleWorkspaceChange, selectedImage])

  useEffect(() => {
    if (
      aiReviewAvailable
      && typeof window !== 'undefined'
      && new URLSearchParams(window.location.search).get('aiReview') === '1'
    ) {
      handleWorkspaceChange('review')
    }
  }, [aiReviewAvailable, handleWorkspaceChange])

  return (
    <>
    <div
      className={cn('relative flex min-h-0 flex-1 flex-col overflow-hidden', className)}
      data-ucat-editor-shell
    >
      <UcatSelectedImageMenu
        editor={activeTextEditor}
        onEditVisual={(image, editor) => setVisualEditorContext({ image, editor })}
        onUseImageWithAi={onUseSelectedImageWithAi}
      />
      <UcatAuthoringWorkspaceTabs
        value={activeWorkspace}
        onValueChange={handleWorkspaceChange}
        editorLabel="Question stem"
        reviewAvailable={aiReviewAvailable}
        className="shrink-0 border-b bg-background p-2 lg:hidden"
      />
      <div className="flex min-h-0 flex-1 overflow-hidden lg:flex-row">
      <div className={cn('flex min-h-0 flex-1 flex-col overflow-hidden', activeWorkspace !== 'editor' && 'hidden', 'lg:flex')}>
        <div
          className={
            flush
              ? 'flex min-h-0 flex-1 flex-col overflow-hidden'
              : 'flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border border-border shadow-sm'
          }
        >
          <UcatTutorStemPreviewExamChrome
            sectionTitle={previewSectionTitle}
            questionCount={questionCount}
            currentQuestionIndex={safeQuestionIndex}
            onQuestionIndexChange={handleQuestionIndexChange}
            showNavigator={showQuestionNavigator}
          >
            {editorMode === 'edit' ? (
              <UcatStemEngineInlineEditor
                form={form}
                questionIndex={safeQuestionIndex}
                sectionDisplayColumns={sectionDisplayColumns}
                sectionName={previewSectionTitle}
                stemId={stemId}
                enableImages={enableImages}
                onNewImageFileIds={onNewImageFileIds}
                onTextEditorActive={handleTextEditorActive}
                explanationFeedback={currentExplanationFeedback}
              />
            ) : previewQuestion ? (
              <UcatQuestionEnginePreview
                question={previewQuestion}
                showAnswerExplanations={showAnswer}
                interactive={false}
              />
            ) : null}
          </UcatTutorStemPreviewExamChrome>
        </div>
      </div>
      <UcatStemEditorPropertiesPanel
        form={form}
        sections={sections}
        categories={categories}
        tags={tags}
        stemId={stemId}
        currentQuestionIndex={safeQuestionIndex}
        onQuestionIndexChange={handleQuestionIndexChange}
        editorMode={editorMode}
        onEditorModeChange={handleEditorModeChange}
        showAnswer={showAnswer}
        onShowAnswerChange={handleShowAnswerChange}
        showModeControls={showModeControls}
        focusTarget={focusTarget}
        focusMessage={focusMessage}
        sourceChannel={sourceChannel}
        aiGenerationMetadata={aiGenerationMetadata}
        createdByFirstName={createdByFirstName}
        createdByLastName={createdByLastName}
        statusChangedByFirstName={statusChangedByFirstName}
        statusChangedByLastName={statusChangedByLastName}
        statusChangedAt={statusChangedAt}
        activeTab={activeWorkspace === 'editor' ? 'properties' : activeWorkspace}
        onActiveTabChange={handleWorkspaceChange}
        selectedImage={selectedImage}
        onAcceptSelectedImage={onAcceptSelectedImage}
        onNewImageFileIds={onNewImageFileIds}
        aiReviewAvailable={aiReviewAvailable}
        className={cn(activeWorkspace === 'editor' && 'hidden', 'lg:flex')}
      />
      </div>
    </div>
    {visualEditorContext?.image.visualType && visualEditorContext.image.visualSpec ? (
      <UcatVisualEditorDialog
        open
        visualType={visualEditorContext.image.visualType}
        spec={visualEditorContext.image.visualSpec}
        title={visualEditorContext.image.visualTitle}
        altText={visualEditorContext.image.visualAltText}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setVisualEditorContext(null)
        }}
        onApply={(imageNode) => {
          const attrs = imageNodeAttrs(imageNode)
          if (!attrs) {
            toast({ title: 'Could not apply visual', description: 'The rendered visual was invalid.', variant: 'destructive' })
            return
          }
          const replaced = replaceSelectedImageAttrs(
            visualEditorContext.editor,
            visualEditorContext.image,
            attrs,
          )
          if (!replaced) {
            toast({ title: 'Could not apply visual', description: 'The original image could not be found in the draft.', variant: 'destructive' })
            return
          }
          setVisualEditorContext(null)
          toast({ title: 'Visual updated' })
        }}
      />
    ) : null}
    </>
  )
}
