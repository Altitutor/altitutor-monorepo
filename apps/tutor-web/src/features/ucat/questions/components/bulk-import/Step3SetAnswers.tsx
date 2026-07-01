'use client'

import { Fragment, useCallback, useMemo, useState } from 'react'
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
import { Loader2, Sparkles } from 'lucide-react'
import type { BulkImportStemDraft } from '@/features/ucat/questions/hooks/useBulkImportWizard'
import type { UcatQuestionStemFormValues } from '@/features/ucat/questions/types/schema'
import { proseMirrorToPlainText } from '@/features/ucat/shared/lib/rich-text'
import { BulkImportRichTextPreview } from '@/features/ucat/questions/components/bulk-import/BulkImportRichTextPreview'
import { BulkImportReviewStemEditor } from '@/features/ucat/questions/components/bulk-import/BulkImportReviewStemEditor'
import type {
  CategoryOption,
  UcatSectionOption,
} from '@/features/ucat/questions/components/UcatQuestionStemDialog'
import type { UcatQuestionSourceChannel } from '@/features/ucat/questions/api/questions'
import {
  applyReviewFlagSuggestion,
  findMissingExplanations,
  type AiToolReviewFlag,
  type MissingExplanationTarget,
} from '@/features/ucat/questions/lib/ai-tools'
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
type ReviewTagOption = { id: string; name: string; label?: string | null }

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

function buildAnswerRows(stems: BulkImportStemDraft[]): AnswerRow[] {
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
  stems: BulkImportStemDraft[]
  categories?: ReviewCategoryOption[]
  sections?: ReviewSectionOption[]
  tags?: ReviewTagOption[]
  onUpdateStem?: (stemId: string, values: UcatQuestionStemFormValues) => void
  onNewImageFileIds?: (fileIds: string[]) => void
  sourceChannel?: UcatQuestionSourceChannel | null
}

export function Step3SetAnswers({
  stems,
  categories = [],
  sections = [],
  tags = [],
  onUpdateStem,
  onNewImageFileIds,
  sourceChannel = null,
}: Step3SetAnswersProps) {
  const { toast } = useToast()
  const rows = useMemo(() => buildAnswerRows(stems), [stems])
  const [expandedRowKey, setExpandedRowKey] = useState<string | null>(null)
  const [isGeneratingExplanations, setIsGeneratingExplanations] = useState(false)
  const [explanationReviewFlags, setExplanationReviewFlags] = useState<
    Array<AiToolReviewFlag & { stemIndex: number }>
  >([])
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
    setExpandedRowKey((current) => (current === key ? null : key))
  }, [])

  const handleGenerateMissingExplanations = useCallback(async () => {
    if (!onUpdateStem || missingExplanationTargets.length === 0) return
    setIsGeneratingExplanations(true)
    try {
      setExplanationReviewFlags([])
      const results = await Promise.all(stems.map(async (stem, stemIndex) => {
        const stemTargets = missingExplanationTargets.filter((target) => target.stemId === stem.id)
        if (stemTargets.length === 0) {
          return { stemId: stem.id, stem: null, appliedCount: 0, reviewFlags: [] as Array<AiToolReviewFlag & { stemIndex: number }> }
        }
        const response = await fetch('/api/ucat/question-stems/ai-tools/generate-explanations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            stem: stem.values,
            questionIndexes: Array.from(new Set(stemTargets.map((target) => target.questionIndex))),
          }),
        })
        const json = (await response.json()) as {
          stem?: UcatQuestionStemFormValues
          appliedCount?: number
          reviewFlags?: AiToolReviewFlag[]
          error?: string
        }
        if (!response.ok || !json.stem) {
          throw new Error(json.error ?? 'Failed to generate missing explanations.')
        }
        return {
          stemId: stem.id,
          stem: json.stem,
          appliedCount: json.appliedCount ?? 0,
          reviewFlags: (json.reviewFlags ?? []).map((flag) => ({ ...flag, stemIndex })),
        }
      }))
      const appliedTotal = results.reduce((sum, result) => sum + result.appliedCount, 0)
      const reviewFlags = results.flatMap((result) => result.reviewFlags)
      results.forEach((result) => {
        if (result.stem) onUpdateStem(result.stemId, result.stem)
      })
      setExplanationReviewFlags(reviewFlags)
      toast({
        description: reviewFlags.length > 0
          ? `${reviewFlags.length} question${reviewFlags.length === 1 ? '' : 's'} flagged for tutor review.`
          : appliedTotal > 0
            ? `Generated ${appliedTotal} missing explanation${appliedTotal === 1 ? '' : 's'}.`
            : 'No missing explanations were generated.',
        variant: reviewFlags.length > 0 ? 'destructive' : undefined,
      })
    } catch (error) {
      toast({
        description: error instanceof Error ? error.message : 'Failed to generate missing explanations.',
        variant: 'destructive',
      })
    } finally {
      setIsGeneratingExplanations(false)
    }
  }, [missingExplanationTargets, onUpdateStem, stems, toast])

  const handleAcceptExplanationSuggestion = useCallback(
    (flag: AiToolReviewFlag & { stemIndex: number }) => {
      const stem = stems[flag.stemIndex]
      if (!stem || !onUpdateStem) return
      onUpdateStem(stem.id, applyReviewFlagSuggestion(stem.values, flag))
      setExplanationReviewFlags((current) =>
        current.filter(
          (item) => !(item.stemIndex === flag.stemIndex && item.questionIndex === flag.questionIndex)
        )
      )
      toast({
        description: `Updated stem ${flag.stemIndex + 1}, question ${flag.questionIndex + 1}. Review before continuing.`,
      })
    },
    [onUpdateStem, stems, toast]
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
          {explanationReviewFlags.length > 0 ? (
            <div className="mt-2 space-y-1 rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
              <div className="font-medium">AI flagged questions for tutor review</div>
              {explanationReviewFlags.map((flag) => (
                <div key={`${flag.stemIndex}-${flag.questionIndex}-${flag.message}`} className="space-y-1">
                  <p>
                    Stem {flag.stemIndex + 1}, question {flag.questionIndex + 1}: {flag.message}
                    {flag.suggestedCorrectOptionIndex != null
                      ? ` Suggested correct option: ${String.fromCharCode(65 + flag.suggestedCorrectOptionIndex)}.`
                      : ''}
                    {flag.suggestedChanges ? ` Suggested change: ${flag.suggestedChanges}` : ''}
                  </p>
                  {flag.suggestedCorrectOptionIndex != null && flag.suggestedAnswerExplanation && onUpdateStem ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => handleAcceptExplanationSuggestion(flag)}
                    >
                      Accept change
                    </Button>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}
        </div>
        {missingExplanationTargets.length > 0 && onUpdateStem ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => void handleGenerateMissingExplanations()}
            disabled={isGeneratingExplanations}
          >
            {isGeneratingExplanations ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            Generate missing explanations
          </Button>
        ) : null}
      </div>
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
              const stem = stems.find((s) => s.id === row.stemId)
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
                          className="h-[min(75vh,900px)] min-h-[32rem] border-t border-border"
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
                            sourceChannel={sourceChannel}
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
