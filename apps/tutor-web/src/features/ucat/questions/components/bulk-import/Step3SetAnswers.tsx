'use client'

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
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
  useToast,
} from '@altitutor/ui'
import { Loader2 } from 'lucide-react'
import type { BulkImportStemDraft } from '@/features/ucat/questions/hooks/useBulkImportWizard'
import type { UcatQuestionStemFormValues } from '@/features/ucat/questions/types/schema'
import { proseMirrorToPlainText } from '@/features/ucat/shared/lib/rich-text'
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

const OPTION_LABELS = ['A', 'B', 'C', 'D', 'E'] as const
const QUESTION_TEXT_MAX = 60
const OPTION_TEXT_MAX = 36

function truncateOneLine(text: string, maxLen: number): string {
  const oneLine = text.replace(/\s+/g, ' ').trim()
  if (oneLine.length <= maxLen) return oneLine
  return `${oneLine.slice(0, maxLen)}…`
}

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
  stemIndex: number
  questionIndex: number
  globalQuestionNumber: number
  questionText: string
  questionTextJson: Json | null
  optionCount: number
  optionTexts: string[]
  optionTextJsons: Array<Json | null>
  correctOptionIndex: number
  correctLetter: string
  isSyllogism: boolean
  syllogismPattern: string | null
  answerExplanationPlain: string
  answerExplanationJson: Json | null
}

function buildAnswerRows(stems: ReviewStemDraft[]): AnswerRow[] {
  const rows: AnswerRow[] = []
  let globalNumber = 0
  stems.forEach((stem, stemIndex) => {
    const questions = stem.values.questions ?? []
    questions.forEach((q, questionIndex) => {
      globalNumber += 1
      const options = q.options ?? []
      const optionTextJsons = options.map((opt) => (opt.answerText ?? null) as Json | null)
      const optionTexts = options.map((opt) =>
        truncateOneLine(
          proseMirrorToPlainText(opt.answerText ?? null)?.trim() ?? '',
          OPTION_TEXT_MAX
        )
      )
      const correctOptionIndex = options.findIndex((opt) => opt.isAnswer === true)
      const resolvedCorrect = correctOptionIndex >= 0 ? correctOptionIndex : 0
      const explanationPlain = proseMirrorToPlainText(q.answerExplanation ?? null)?.trim() ?? ''
      const isSyllogism = (q as { questionType?: string }).questionType === 'syllogism'
      const syllogismPattern =
        (q as { syllogismAnswerPattern?: string | null }).syllogismAnswerPattern ?? null
      rows.push({
        stemId: stem.id,
        stemIndex,
        questionIndex,
        globalQuestionNumber: globalNumber,
        questionText: truncateOneLine(
          proseMirrorToPlainText(q.questionText ?? null)?.trim() ?? '',
          QUESTION_TEXT_MAX
        ),
        questionTextJson: (q.questionText ?? null) as Json | null,
        optionCount: options.length,
        optionTexts,
        optionTextJsons,
        correctOptionIndex: resolvedCorrect,
        correctLetter: OPTION_LABELS[resolvedCorrect] ?? 'A',
        isSyllogism,
        syllogismPattern,
        answerExplanationPlain: explanationPlain,
        answerExplanationJson: (q.answerExplanation ?? null) as Json | null,
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
}: Step3SetAnswersProps) {
  const { toast } = useToast()
  const rows = useMemo(() => buildAnswerRows(stems), [stems])
  const [expandedRowKey, setExpandedRowKey] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
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

  const maxOptionCount = useMemo(
    () => (rows.length > 0 ? Math.max(...rows.map((r) => r.optionCount), 4) : 4),
    [rows]
  )
  const optionLabelsToShow = OPTION_LABELS.slice(0, maxOptionCount)
  const totalCols = 3 + maxOptionCount + 2

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
      onActiveTextEditorChange?.(null)
    }
  }, [onActiveTextEditorChange])

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

    setIsGenerating(true)
    try {
      const response = await ucatQuestionsApi.generateExplanations({
        concurrency: 4,
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
            isPrivate: payload.isPrivate,
            questions: payload.questions.map((question) => ({
              questionText: question.questionText,
              questionType: question.questionType,
              answerExplanation: question.answerExplanation ?? null,
              difficulty: question.difficulty ?? null,
              timeBurdenSeconds: question.timeBurdenSeconds ?? null,
              tagIds: question.tagIds ?? [],
              options: question.options.map((option) => ({
                answerText: option.answerText,
                answerExplanation: option.answerExplanation ?? null,
                isAnswer: option.isAnswer,
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
      toast({
        title: 'Failed to generate explanations',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      })
    } finally {
      setIsGenerating(false)
    }
  }, [categories, isGenerating, onUpdateStem, reviewFlagsByStemId, sections, stems, toast])

  const handleAcceptReviewSuggestion = useCallback(
    (stemId: string, flag: AiToolReviewFlag) => {
      if (!onUpdateStem) return
      const stem = stems.find((item) => item.id === stemId)
      if (!stem) return
      const nextValues = applyReviewFlagSuggestion(stem.values, flag)
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
        title: 'Suggested answer applied',
        description: `Updated question ${flag.questionIndex + 1}. Review the explanation before saving.`,
      })
    },
    [onUpdateStem, stems, toast],
  )

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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Review</h2>
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
            className={tutorBtnPrimary}
            onClick={() => void handleBulkGenerateExplanations()}
            disabled={isGenerating}
          >
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating...
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
                  {flag.suggestedCorrectOptionIndex != null ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className={tutorBtnOutline}
                      onClick={() => handleAcceptReviewSuggestion(stemId, flag)}
                    >
                      Accept suggested answer
                    </Button>
                  ) : null}
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
              <TableHead className="w-[3rem] px-2">Stem</TableHead>
              <TableHead className="w-[2.5rem] px-2">#</TableHead>
              <TableHead className="w-[28%] px-2">Question</TableHead>
              {optionLabelsToShow.map((label) => (
                <TableHead key={label} className="px-2">
                  {label}
                </TableHead>
              ))}
              <TableHead className="w-[3rem] px-2">Ans</TableHead>
              <TableHead className="px-2">Explanation</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const rowKey = `${row.stemId}-${row.questionIndex}`
              const isExpanded = expandedRowKey === rowKey
              const isMissingExplanation = missingExplanationRowKeys.has(rowKey)
              const stem = stems.find((item) => item.id === row.stemId)
              const correctDisplay = row.isSyllogism
                ? (row.syllogismPattern ?? '')
                : row.correctLetter

              return (
                <Fragment key={rowKey}>
                  <TableRow
                    className={cn(
                      'h-9 max-h-9 cursor-pointer',
                      isExpanded && 'bg-muted/30 hover:bg-muted/30',
                      isMissingExplanation && 'bg-amber-50 text-amber-950 hover:bg-amber-100 dark:bg-amber-950/30 dark:text-amber-100 dark:hover:bg-amber-950/40'
                    )}
                    onClick={() => toggleExpanded(rowKey)}
                  >
                    <TableCell className="px-2 font-mono text-muted-foreground">
                      {row.stemIndex + 1}
                    </TableCell>
                    <TableCell className="px-2 font-mono text-muted-foreground">
                      {row.globalQuestionNumber}
                    </TableCell>
                    <TableCell className="max-w-0 overflow-hidden px-2">
                      <BulkImportRichTextPreview
                        json={row.questionTextJson}
                        singleLine
                        emptyFallback={<span className="text-muted-foreground">—</span>}
                      />
                    </TableCell>
                    {optionLabelsToShow.map((label, idx) => (
                      <TableCell key={label} className="max-w-0 overflow-hidden px-2">
                        {idx < row.optionCount ? (
                          <BulkImportRichTextPreview
                            json={row.optionTextJsons[idx] ?? null}
                            singleLine
                          />
                        ) : (
                          '—'
                        )}
                      </TableCell>
                    ))}
                    <TableCell className="px-2 font-medium font-mono">{correctDisplay}</TableCell>
                    <TableCell className="max-w-0 overflow-hidden px-2">
                      <BulkImportRichTextPreview
                        json={row.answerExplanationJson}
                        singleLine
                        emptyFallback={<span className="text-muted-foreground">—</span>}
                      />
                    </TableCell>
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
  } explanation text before you can continue from review (${fieldCount} missing field${
    fieldCount === 1 ? '' : 's'
  }).`
}
