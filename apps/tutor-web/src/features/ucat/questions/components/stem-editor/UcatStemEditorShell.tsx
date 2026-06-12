'use client'

import { useEffect, useMemo, useState } from 'react'
import type { UseFormReturn } from 'react-hook-form'
import type { UcatQuestionStemFormValues } from '@/features/ucat/questions/types/schema'
import { UcatQuestionEnginePreview } from '@/features/ucat/question-engine-preview/UcatQuestionEnginePreview'
import { UcatTutorStemPreviewExamChrome } from '@/features/ucat/question-engine-preview/UcatTutorStemPreviewExamChrome'
import {
  resolveSectionDisplayColumns,
  stemFormValuesToEnginePreviewQuestion,
} from '@/features/ucat/question-engine-preview/mapStemFormToEnginePreview'
import {
  UcatStemEditorPropertiesPanel,
  type StemEditorMode,
} from '@/features/ucat/questions/components/stem-editor/UcatStemEditorPropertiesPanel'
import { UcatStemEngineInlineEditor } from '@/features/ucat/questions/components/stem-editor/UcatStemEngineInlineEditor'
import type {
  CategoryOption,
  TagOption,
  UcatSectionOption,
} from '@/features/ucat/questions/components/UcatQuestionStemDialog'

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
}: UcatStemEditorShellProps) {
  const [editorMode, setEditorMode] = useState<StemEditorMode>(initialEditorMode)
  const [showAnswer, setShowAnswer] = useState(false)
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(initialQuestionIndex ?? 0)

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
    setCurrentQuestionIndex((idx) => Math.min(idx, questionCount - 1))
  }, [questionCount])

  useEffect(() => {
    if (initialQuestionIndex == null) return
    setCurrentQuestionIndex(Math.min(initialQuestionIndex, Math.max(questionCount - 1, 0)))
  }, [initialQuestionIndex, questionCount])

  useEffect(() => {
    setEditorMode(initialEditorMode)
  }, [initialEditorMode, stemId])

  return (
    <div className={className ?? 'flex min-h-0 flex-1 overflow-hidden'}>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
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
            onQuestionIndexChange={setCurrentQuestionIndex}
            showNavigator={showQuestionNavigator}
          >
            {editorMode === 'edit' ? (
              <UcatStemEngineInlineEditor
                form={form}
                questionIndex={safeQuestionIndex}
                sectionDisplayColumns={sectionDisplayColumns}
                stemId={stemId}
                enableImages={enableImages}
                onNewImageFileIds={onNewImageFileIds}
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
        currentQuestionIndex={safeQuestionIndex}
        onQuestionIndexChange={setCurrentQuestionIndex}
        editorMode={editorMode}
        onEditorModeChange={setEditorMode}
        showAnswer={showAnswer}
        onShowAnswerChange={setShowAnswer}
      />
    </div>
  )
}
