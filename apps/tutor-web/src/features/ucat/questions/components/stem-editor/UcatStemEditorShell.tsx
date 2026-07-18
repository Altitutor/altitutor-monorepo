'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Editor } from '@tiptap/react'
import type { Json } from '@altitutor/shared'
import type { UseFormReturn } from 'react-hook-form'
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
}: UcatStemEditorShellProps) {
  const [localEditorMode, setLocalEditorMode] = useState<StemEditorMode>(initialEditorMode)
  const [localShowAnswer, setLocalShowAnswer] = useState(false)
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(initialQuestionIndex ?? 0)
  const [activeWorkspace, setActiveWorkspace] = useState<UcatAuthoringWorkspaceTab>('editor')
  const editorMode = controlledEditorMode ?? localEditorMode
  const showAnswer = controlledShowAnswer ?? localShowAnswer

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

  return (
    <div className={cn('flex min-h-0 flex-1 flex-col overflow-hidden', className)}>
      <UcatAuthoringWorkspaceTabs
        value={activeWorkspace}
        onValueChange={setActiveWorkspace}
        editorLabel="Question stem"
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
        onActiveTabChange={setActiveWorkspace}
        className={cn(activeWorkspace === 'editor' && 'hidden', 'lg:flex')}
      />
      </div>
    </div>
  )
}
