'use client'

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Editor } from '@tiptap/react'
import { cn } from '@/shared/utils'
import type { Json } from '@altitutor/shared'
import {
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Switch,
  useToast,
} from '@altitutor/ui'
import { Bot, Loader2, Square } from 'lucide-react'
import type { BulkImportStemDraft } from '@/features/ucat/questions/hooks/useBulkImportWizard'
import type { UcatQuestionStemFormValues } from '@/features/ucat/questions/types/schema'
import { BulkImportRichTextPreview } from '@/features/ucat/questions/components/bulk-import/BulkImportRichTextPreview'
import { BulkImportReviewStemEditor } from '@/features/ucat/questions/components/bulk-import/BulkImportReviewStemEditor'
import type {
  CategoryOption,
  UcatSectionOption,
} from '@/features/ucat/questions/components/UcatQuestionStemDialog'
import { ucatQuestionsApi, type UcatQuestionSourceChannel } from '@/features/ucat/questions/api/questions'
import {
  applyExplanationUpdates,
  applyReviewFlagSuggestion,
  collectExplanationReviewFlags,
  findMissingExplanations,
  parseReviewFlagAcceptPlan,
  AiToolExplanationResponseSchema,
  type AiToolExplanationUpdate,
  type AiToolReviewFlag,
  type MissingExplanationTarget,
} from '@/features/ucat/questions/lib/ai-tools'
import {
  formValuesToExplanationStemPayload,
  stemNeedsExplanationGeneration,
} from '@/features/ucat/questions/lib/explanation-generation'
import { tutorBtnOutline, tutorBtnPrimary } from '@/shared/lib/tutor-visual'
import type { BulkImportReviewController } from '@/features/ucat/questions/hooks/useBulkImportReviewController'
import {
  BulkImportQuestionIssues,
  BulkImportReviewActions,
} from '@/features/ucat/questions/components/bulk-import/BulkImportReviewActions'

type ReviewCategoryOption = {
  id?: string | null
  name?: string | null
  ucat_section_id?: string | null
  label?: string | null
}
type ReviewSectionOption = { id: string | null; name?: string | null; display_columns?: number | null }
type ReviewTagOption = {
  id: string
  name: string
  label?: string | null
  parent_question_tag_id?: string | null
  ucat_section_id?: string | null
}
type ReviewStemDraft = BulkImportStemDraft & {
  aiGenerationMetadata?: Json | null
}

export type AnswerRow = {
  stemId: string
  stemNumber: number
  questionId: string | null
  questionIndex: number
  globalQuestionNumber: number
  stemTextJson: Json | null
  questionTextJson: Json | null
}

function buildAnswerRows(stems: ReviewStemDraft[]): AnswerRow[] {
  const rows: AnswerRow[] = []
  let globalNumber = 0
  stems.forEach((stem, stemIndex) => {
    const questions = stem.values.questions ?? []
    questions.forEach((q, questionIndex) => {
      globalNumber += 1
      rows.push({
        stemId: stem.id,
        stemNumber: stemIndex + 1,
        questionId: q.id ?? null,
        questionIndex,
        globalQuestionNumber: globalNumber,
        stemTextJson: (stem.values.stemText ?? null) as Json | null,
        questionTextJson: (q.questionText ?? null) as Json | null,
      })
    })
  })
  return rows
}

type Step3SetAnswersProps = {
  stems: ReviewStemDraft[]
  categories?: ReviewCategoryOption[]
  sections?: ReviewSectionOption[]
  tags?: ReviewTagOption[]
  onUpdateStem?: (stemId: string, values: UcatQuestionStemFormValues) => void
  onNewImageFileIds?: (fileIds: string[]) => void
  sourceChannel?: UcatQuestionSourceChannel | null
  onExpandedStemChange?: (stemId: string | null) => void
  onActiveTextEditorChange?: (editor: Editor | null) => void
  reviewController?: BulkImportReviewController
}

export function Step3SetAnswers({
  stems,
  categories = [],
  sections = [],
  tags = [],
  onUpdateStem,
  onNewImageFileIds,
  sourceChannel = null,
  onExpandedStemChange,
  onActiveTextEditorChange,
  reviewController,
}: Step3SetAnswersProps) {
  const { toast } = useToast()
  const rows = useMemo(() => buildAnswerRows(stems), [stems])
  const [expandedRowKey, setExpandedRowKey] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const generationAbortControllerRef = useRef<AbortController | null>(null)
  const [reviewFlagsByStemId, setReviewFlagsByStemId] = useState<Record<string, AiToolReviewFlag[]>>({})
  const missingExplanationTargets = useMemo(
    () =>
      stems.flatMap((stem, stemIndex) =>
        findMissingExplanations(stem.values, stemIndex).map((target) => ({
          ...target,
          stemId: stem.id,
        }))
      ),
    [stems]
  )
  const missingExplanationRowKeys = useMemo(
    () =>
      new Set(
        missingExplanationTargets.map(
          (target) => `${target.stemId}-${target.questionIndex}`,
        ),
      ),
    [missingExplanationTargets],
  )

  const editorSections = useMemo<UcatSectionOption[]>(
    () =>
      sections.map((section) => ({
        id: section.id,
        name: section.name ?? null,
        display_columns: section.display_columns ?? null,
      })),
    [sections]
  )
  const editorCategories = useMemo<CategoryOption[]>(
    () =>
      categories.map((category) => ({
        id: category.id ?? null,
        name: category.name ?? null,
        ucat_section_id: category.ucat_section_id,
        label: category.label ?? null,
      })),
    [categories]
  )

  const totalCols = 3 + (reviewController ? 3 : 0)

  const toggleExpanded = useCallback((key: string) => {
    setExpandedRowKey((current) => {
      const next = current === key ? null : key
      onExpandedStemChange?.(next ? rows.find((row) => `${row.stemId}-${row.questionIndex}` === next)?.stemId ?? null : null)
      if (next !== current) {
        onActiveTextEditorChange?.(null)
      }
      return next
    })
  }, [onActiveTextEditorChange, onExpandedStemChange, rows])

  useEffect(() => {
    return () => {
      generationAbortControllerRef.current?.abort()
      onActiveTextEditorChange?.(null)
    }
  }, [onActiveTextEditorChange])

  const handleStopGeneratingExplanations = useCallback(() => {
    generationAbortControllerRef.current?.abort()
  }, [])

  const approveAiFinding = useCallback(async (stemId: string, findingKey: string) => {
    if (!reviewController) return
    try {
      await reviewController.approveFinding(stemId, findingKey)
      toast({
        title: 'AI edit applied',
        description: 'The proposed change was applied. Run AI review again to verify it.',
      })
    } catch (error) {
      toast({
        title: 'Could not apply the edit',
        description: error instanceof Error ? error.message : 'The draft may have changed.',
        variant: 'destructive',
      })
    }
  }, [reviewController, toast])

  const handleBulkGenerateExplanations = useCallback(async () => {
    if (!onUpdateStem || isGenerating) return
    const stemsNeedingGeneration = stems.filter((stem) => stemNeedsExplanationGeneration(stem.values))
    if (stemsNeedingGeneration.length === 0) {
      toast({
        title: 'No missing explanations',
        description: 'Every question already has the required explanation fields.',
      })
      return
    }

    const abortController = new AbortController()
    generationAbortControllerRef.current = abortController
    setIsGenerating(true)
    try {
      const response = await ucatQuestionsApi.generateExplanations({
        concurrency: 4,
        signal: abortController.signal,
        stems: stemsNeedingGeneration.map((stem) => {
          const payload = formValuesToExplanationStemPayload(stem.values)
          const sectionName =
            sections.find((section) => section.id === stem.values.sectionId)?.name ?? null
          const category =
            categories.find((item) => item.id === stem.values.categoryId) ?? null
          return {
            id: stem.id,
            sectionId: payload.sectionId,
            sectionName,
            categoryId: payload.categoryId ?? null,
            categoryName: category?.label ?? category?.name ?? null,
            stemText: payload.stemText,
            accessScope: payload.accessScope,
            questions: payload.questions.map((question) => ({
              questionText: question.questionText,
              responseType: question.responseType,
              answerScheme: question.answerScheme,
              answerExplanation: question.answerExplanation ?? null,
              difficulty: question.difficulty ?? null,
              timeBurdenSeconds: question.timeBurdenSeconds ?? null,
              tagIds: question.tagIds ?? [],
              options: question.options.map((option) => ({
                answerText: option.answerText,
                answerExplanation: option.answerExplanation ?? null,
                answerKeyValue: option.answerKeyValue,
              })),
            })),
            questionIndices: [
              ...new Set(findMissingExplanations(stem.values).map((target) => target.questionIndex)),
            ],
          }
        }),
      })

      let appliedCount = 0
      let flaggedCount = 0
      const nextFlags: Record<string, AiToolReviewFlag[]> = { ...reviewFlagsByStemId }

      response.results.forEach((result) => {
        const stem = stemsNeedingGeneration[result.stemIndex]
        if (!stem || result.error) return

        const updates: AiToolExplanationUpdate[] = AiToolExplanationResponseSchema.parse({
          updates: result.updates,
        }).updates
        const flags = collectExplanationReviewFlags(updates)
        if (flags.length > 0) {
          nextFlags[stem.id] = flags
          flaggedCount += flags.length
        } else {
          delete nextFlags[stem.id]
        }

        const { stem: nextValues, appliedCount: stemApplied } = applyExplanationUpdates(
          stem.values,
          updates,
        )
        if (stemApplied > 0) {
          appliedCount += stemApplied
          onUpdateStem(stem.id, nextValues)
        }
      })

      setReviewFlagsByStemId(nextFlags)

      const errorCount = response.errorCount
      toast({
        title: appliedCount > 0 ? 'Explanations generated' : 'No explanations applied',
        description:
          [
            `Filled ${appliedCount} field${appliedCount === 1 ? '' : 's'} across ${response.appliedStemCount} stem${response.appliedStemCount === 1 ? '' : 's'}.`,
            errorCount > 0 ? `${errorCount} stem${errorCount === 1 ? '' : 's'} failed.` : null,
            flaggedCount > 0 ? `${flaggedCount} question${flaggedCount === 1 ? '' : 's'} flagged for review.` : null,
          ]
            .filter(Boolean)
            .join(' '),
        variant: appliedCount > 0 || flaggedCount > 0 ? 'default' : 'destructive',
      })
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        toast({
          title: 'Explanation generation stopped',
          description: 'No new AI explanations were applied.',
        })
        return
      }
      toast({
        title: 'Failed to generate explanations',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      })
    } finally {
      if (generationAbortControllerRef.current === abortController) {
        generationAbortControllerRef.current = null
      }
      setIsGenerating(false)
    }
  }, [categories, isGenerating, onUpdateStem, reviewFlagsByStemId, sections, stems, toast])

  const handleAcceptReviewSuggestion = useCallback(
    (stemId: string, flag: AiToolReviewFlag, textReplacementTo?: string) => {
      if (!onUpdateStem) return
      const stem = stems.find((item) => item.id === stemId)
      if (!stem) return
      const plan = parseReviewFlagAcceptPlan(flag)
      if (!plan) return
      if (plan.kind === 'text_replacement_choice' && !textReplacementTo) return

      const nextValues = applyReviewFlagSuggestion(stem.values, flag, {
        textReplacementTo,
      })
      onUpdateStem(stemId, nextValues)
      setReviewFlagsByStemId((current) => {
        const remaining = (current[stemId] ?? []).filter(
          (item) => item.questionIndex !== flag.questionIndex,
        )
        if (remaining.length === 0) {
          const next = { ...current }
          delete next[stemId]
          return next
        }
        return { ...current, [stemId]: remaining }
      })
      toast({
        title: 'Suggested change applied',
        description: `Updated question ${flag.questionIndex + 1}. Review before saving.`,
      })
    },
    [onUpdateStem, stems, toast],
  )

  const handleDismissReviewFlag = useCallback((stemId: string, flag: AiToolReviewFlag) => {
    setReviewFlagsByStemId((current) => {
      const remaining = (current[stemId] ?? []).filter(
        (item) => item.questionIndex !== flag.questionIndex,
      )
      if (remaining.length === 0) {
        const next = { ...current }
        delete next[stemId]
        return next
      }
      return { ...current, [stemId]: remaining }
    })
  }, [])

  if (stems.length === 0 || rows.length === 0) {
    return (
      <div className="space-y-2">
        <h2 className="text-base font-semibold">Review</h2>
        <p className="text-sm text-muted-foreground">
          No questions to show. Go back and parse your document first.
        </p>
      </div>
    )
  }

  const reviewFlagEntries = Object.entries(reviewFlagsByStemId).flatMap(([stemId, flags]) =>
    flags.map((flag) => ({ stemId, flag })),
  )

  return (
    <div className="space-y-4">
      {reviewController ? (
        <BulkImportReviewActions controller={reviewController} />
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Questions</h2>
          {missingExplanationTargets.length > 0 ? (
            <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
              {formatMissingExplanationSummary(missingExplanationTargets)}
            </p>
          ) : (
            <p className="mt-1 text-xs text-muted-foreground">
              All questions have the required explanation fields.
            </p>
          )}
        </div>
        {onUpdateStem && missingExplanationTargets.length > 0 ? (
          <Button
            type="button"
            size="sm"
            className={isGenerating ? tutorBtnOutline : tutorBtnPrimary}
            onClick={isGenerating
              ? handleStopGeneratingExplanations
              : () => void handleBulkGenerateExplanations()}
          >
            {isGenerating ? (
              <>
                <Square className="mr-2 h-3.5 w-3.5 fill-current" />
                Stop generating
              </>
            ) : (
              'Bulk generate explanations'
            )}
          </Button>
        ) : null}
      </div>

      {reviewFlagEntries.length > 0 ? (
        <div className="space-y-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
          <p className="font-medium">
            AI flagged {reviewFlagEntries.length} question{reviewFlagEntries.length === 1 ? '' : 's'} for review
          </p>
          <ul className="space-y-2">
            {reviewFlagEntries.map(({ stemId, flag }) => {
              const stemIndex = stems.findIndex((stem) => stem.id === stemId)
              const acceptPlan = parseReviewFlagAcceptPlan(flag)
              return (
                <li
                  key={`${stemId}-${flag.questionIndex}`}
                  className="flex flex-wrap items-start justify-between gap-2 rounded-md border border-amber-200/80 bg-white/50 px-3 py-2 dark:border-amber-900 dark:bg-black/20"
                >
                  <div className="min-w-0 space-y-1">
                    <p className="font-medium">
                      Stem {stemIndex >= 0 ? stemIndex + 1 : '?'} · Question {flag.questionIndex + 1}
                    </p>
                    <p className="text-xs">{flag.message}</p>
                    {flag.suggestedChanges ? (
                      <p className="text-xs text-muted-foreground">{flag.suggestedChanges}</p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {acceptPlan?.kind === 'correct_option' ||
                    acceptPlan?.kind === 'option_texts' ||
                    acceptPlan?.kind === 'text_replacement' ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className={tutorBtnOutline}
                        onClick={() => handleAcceptReviewSuggestion(stemId, flag)}
                      >
                        {acceptPlan.kind === 'correct_option'
                          ? 'Accept suggested answer'
                          : 'Accept suggested change'}
                      </Button>
                    ) : null}
                    {acceptPlan?.kind === 'text_replacement_choice'
                      ? acceptPlan.options.map((option) => (
                          <Button
                            key={option}
                            type="button"
                            size="sm"
                            variant="outline"
                            className={tutorBtnOutline}
                            onClick={() => handleAcceptReviewSuggestion(stemId, flag, option)}
                          >
                            Use “{option}”
                          </Button>
                        ))
                      : null}
                    {!acceptPlan && flag.suggestedChanges ? (
                      <span className="text-[11px] text-muted-foreground">
                        Edit manually — this suggestion can’t be applied automatically.
                      </span>
                    ) : null}
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDismissReviewFlag(stemId, flag)}
                    >
                      Dismiss
                    </Button>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      ) : null}

      <div className="rounded-md border">
        <Table className="w-full table-fixed text-xs">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[2.25rem] px-2">Stem</TableHead>
              <TableHead className="w-[2.25rem] px-2">Q</TableHead>
              <TableHead className="w-[28%] px-2">Stem text</TableHead>
              <TableHead className="w-[28%] px-2">Question</TableHead>
              {reviewController ? <TableHead className="w-[30%] px-2">Issues</TableHead> : null}
              {reviewController ? <TableHead className="w-[5rem] px-2 text-center">Import</TableHead> : null}
              {reviewController ? <TableHead className="w-[7rem] px-2 text-right">Actions</TableHead> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const rowKey = `${row.stemId}-${row.questionIndex}`
              const isExpanded = expandedRowKey === rowKey
              const isMissingExplanation = missingExplanationRowKeys.has(rowKey)
              const stem = stems.find((item) => item.id === row.stemId)
              const exclusionKey = row.questionId ? `${row.stemId}:${row.questionId}` : null
              const isExcluded = Boolean(
                reviewController?.excludedStemIds.has(row.stemId)
                || (
                  exclusionKey
                  && reviewController?.excludedQuestionIds.has(exclusionKey)
                )
              )
              const rowAiPhase = reviewController?.aiPhaseByStemId[row.stemId] ?? 'idle'
              const rowAiIsPending = rowAiPhase === 'queued' || rowAiPhase === 'analyzing'

              return (
                <Fragment key={rowKey}>
                  <TableRow
                    className={cn(
                      'h-9 max-h-9 cursor-pointer',
                      isExpanded && 'bg-muted/30 hover:bg-muted/30',
                      isExcluded && 'opacity-50',
                      isMissingExplanation && 'bg-amber-50 text-amber-950 hover:bg-amber-100 dark:bg-amber-950/30 dark:text-amber-100 dark:hover:bg-amber-950/40'
                    )}
                    onClick={() => toggleExpanded(rowKey)}
                  >
                    <TableCell className="px-2 font-mono text-muted-foreground">
                      {row.stemNumber}
                    </TableCell>
                    <TableCell className="px-2 font-mono text-muted-foreground">
                      {row.globalQuestionNumber}
                    </TableCell>
                    <TableCell className="max-w-0 overflow-hidden px-2">
                      <BulkImportRichTextPreview
                        json={row.stemTextJson}
                        singleLine
                        emptyFallback={<span className="text-muted-foreground">—</span>}
                      />
                    </TableCell>
                    <TableCell className="max-w-0 overflow-hidden px-2">
                      <BulkImportRichTextPreview
                        json={row.questionTextJson}
                        singleLine
                        emptyFallback={<span className="text-muted-foreground">—</span>}
                      />
                    </TableCell>
                    {reviewController ? (
                      <TableCell className="px-2 align-top">
                        <BulkImportQuestionIssues
                          stemId={row.stemId}
                          questionId={row.questionId}
                          questionIndex={row.questionIndex}
                          controller={reviewController}
                        />
                      </TableCell>
                    ) : null}
                    {reviewController ? (
                      <TableCell className="px-2 text-center">
                        <Switch
                          aria-label={`Import question ${row.globalQuestionNumber}`}
                          checked={!isExcluded}
                          disabled={!row.questionId}
                          onClick={(event) => event.stopPropagation()}
                          onCheckedChange={(checked) => {
                            if (!row.questionId) return
                            if (checked) {
                              reviewController.includeStem(row.stemId)
                              reviewController.includeQuestion(row.stemId, row.questionId)
                            } else {
                              reviewController.excludeQuestion(row.stemId, row.questionId)
                            }
                          }}
                        />
                      </TableCell>
                    ) : null}
                    {reviewController ? (
                      <TableCell className="px-2 text-right">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-[11px]"
                          disabled={isExcluded || rowAiIsPending}
                          onClick={(event) => {
                            event.stopPropagation()
                            void reviewController.runAiReviewForStem(row.stemId)
                          }}
                        >
                          {rowAiPhase === 'analyzing' ? (
                            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Bot className="mr-1.5 h-3.5 w-3.5" />
                          )}
                          {rowAiIsPending
                            ? rowAiPhase === 'queued' ? 'Queued' : 'Reviewing…'
                            : reviewController.hardFailures.some(({ stemId, issue }) => (
                                stemId === row.stemId
                                && (
                                  issue.scope.type === 'stem'
                                    ? row.questionIndex === 0
                                    : issue.scope.questionIndex === row.questionIndex
                                )
                              )) ? 'AI fix' : 'AI review'}
                        </Button>
                      </TableCell>
                    ) : null}
                  </TableRow>
                  {isExpanded && stem && onUpdateStem ? (
                    <TableRow className="bg-muted/20 hover:bg-muted/20">
                      <TableCell colSpan={totalCols} className="p-0 align-top">
                        <div
                          className="h-[min(75vh,900px)] min-h-[32rem] overflow-hidden border-t border-border"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <BulkImportReviewStemEditor
                            key={rowKey}
                            stemId={stem.id}
                            values={stem.values}
                            initialQuestionIndex={row.questionIndex}
                            sections={editorSections}
                            categories={editorCategories}
                            tags={tags}
                            onUpdateStem={onUpdateStem}
                            onNewImageFileIds={onNewImageFileIds}
                            onActiveTextEditorChange={onActiveTextEditorChange}
                            sourceChannel={sourceChannel}
                            aiGenerationMetadata={stem.aiGenerationMetadata ?? null}
                            aiReviewResult={reviewController?.aiResultsByStemId[stem.id] ?? null}
                            aiReviewPhase={reviewController?.aiPhaseByStemId[stem.id] ?? 'idle'}
                            aiReviewStale={reviewController?.staleAiStemIds.has(stem.id) ?? false}
                            onApproveAiFinding={reviewController
                              ? (findingKey) => void approveAiFinding(stem.id, findingKey)
                              : undefined}
                            onKeepAiFinding={reviewController
                              ? (findingKey) => reviewController.keepFinding(stem.id, findingKey)
                              : undefined}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : null}
                </Fragment>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

function formatMissingExplanationSummary(targets: Array<MissingExplanationTarget & { stemId: string }>): string {
  const questionTargets = new Set(
    targets.map((target) => `${target.stemIndex ?? 0}-${target.questionIndex}`)
  )
  const questionCount = questionTargets.size
  const fieldCount = targets.length
  return `${questionCount} question${questionCount === 1 ? '' : 's'} still ${
    questionCount === 1 ? 'needs' : 'need'
  } explanation text before final import (${fieldCount} missing field${
    fieldCount === 1 ? '' : 's'
  }).`
}
