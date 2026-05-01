'use client'

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { cn } from '@/shared/utils'
import type { Json } from '@altitutor/shared'
import { Eye, EyeOff } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Button,
} from '@altitutor/ui'
import type { BulkImportStemDraft } from '@/features/ucat/questions/hooks/useBulkImportWizard'
import type { UcatQuestionStemFormValues } from '@/features/ucat/questions/types/schema'
import { proseMirrorToPlainText } from '@/features/ucat/shared/lib/rich-text'
import { UcatQuestionEnginePreview } from '@/features/ucat/question-engine-preview/UcatQuestionEnginePreview'
import { UcatResultsStyleQuestionEditor } from '@/features/ucat/question-engine-preview/UcatResultsStyleQuestionEditor'
import {
  resolveSectionDisplayColumns,
  stemFormValuesToEnginePreviewQuestion,
} from '@/features/ucat/question-engine-preview/mapStemFormToEnginePreview'

const OPTION_LABELS = ['A', 'B', 'C', 'D', 'E'] as const
const QUESTION_TEXT_MAX = 80
const OPTION_TEXT_MAX = 50
const EXPLANATION_TRUNCATE = 60

function truncateOneLine(text: string, maxLen: number): string {
  const oneLine = text.replace(/\s+/g, ' ').trim()
  if (oneLine.length <= maxLen) return oneLine
  return `${oneLine.slice(0, maxLen)}…`
}

type CategoryOption = { id?: string | null; name?: string | null }

export type AnswerRow = {
  stemId: string
  stemIndex: number
  questionIndex: number
  globalQuestionNumber: number
  questionText: string
  categoryName: string
  optionCount: number
  optionTexts: string[]
  correctOptionIndex: number
  correctLetter: string
  /** For syllogism: Y/N pattern e.g. 'YYNNY'; null for MC or when not set */
  isSyllogism: boolean
  syllogismPattern: string | null
  answerExplanationPlain: string
  answerExplanationTruncated: string
}

function buildAnswerRows(
  stems: BulkImportStemDraft[],
  categories: CategoryOption[]
): AnswerRow[] {
  const rows: AnswerRow[] = []
  let globalNumber = 0
  stems.forEach((stem, stemIndex) => {
    const categoryId = stem.values.categoryId ?? null
    const category = categoryId
      ? categories.find((c) => (c.id ?? null) === categoryId)
      : null
    const categoryName = (category?.name ?? '').trim() || '—'
    const questions = stem.values.questions ?? []
    questions.forEach((q, questionIndex) => {
      globalNumber += 1
      const options = q.options ?? []
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
        categoryName,
        optionCount: options.length,
        optionTexts,
        correctOptionIndex: resolvedCorrect,
        correctLetter: OPTION_LABELS[resolvedCorrect] ?? 'A',
        isSyllogism,
        syllogismPattern,
        answerExplanationPlain: explanationPlain,
        answerExplanationTruncated: truncateOneLine(explanationPlain, EXPLANATION_TRUNCATE),
      })
    })
  })
  return rows
}

type Step3SetAnswersProps = {
  stems: BulkImportStemDraft[]
  categories?: CategoryOption[]
  /** Used to resolve two-column vs single-column stem layout for engine preview. */
  sections?: Array<{ id: string | null; display_columns?: number | null }>
  onUpdateStem?: (stemId: string, values: UcatQuestionStemFormValues) => void
}

export function Step3SetAnswers({
  stems,
  categories = [],
  sections = [],
  onUpdateStem,
}: Step3SetAnswersProps) {
  const rows = useMemo(() => buildAnswerRows(stems, categories), [stems, categories])
  const [expandedRowKey, setExpandedRowKey] = useState<string | null>(null)
  const [expandedDetailMode, setExpandedDetailMode] = useState<'view' | 'edit'>('view')

  useEffect(() => {
    setExpandedDetailMode('view')
  }, [expandedRowKey])

  const maxOptionCount = useMemo(
    () => (rows.length > 0 ? Math.max(...rows.map((r) => r.optionCount), 4) : 4),
    [rows]
  )
  const optionLabelsToShow = OPTION_LABELS.slice(0, maxOptionCount)
  const totalCols = 5 + maxOptionCount + 3 // Stem + # + Question + Category + A..E + Correct + Explanation + Actions

  const toggleExpanded = useCallback((key: string) => {
    setExpandedRowKey((current) => (current === key ? null : key))
  }, [])

  const handleSaveEdit = useCallback(
    (
      stemId: string,
      questionIndex: number,
      updatedStemText: Json | null | undefined,
      updatedQuestion: UcatQuestionStemFormValues['questions'][number]
    ) => {
      const stem = stems.find((s) => s.id === stemId)
      if (!stem || !onUpdateStem) return
      const questions = [...(stem.values.questions ?? [])]
      questions[questionIndex] = updatedQuestion
      onUpdateStem(stemId, {
        ...stem.values,
        stemText: updatedStemText ?? stem.values.stemText,
        questions,
      })
      setExpandedDetailMode('view')
    },
    [stems, onUpdateStem]
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
      <div>
        <h2 className="text-base font-semibold">Review</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Review correct answers and explanations. For syllogisms, Correct shows the Y/N pattern.
          Expand a row to preview the question engine layout. Use View for a read-only preview or Edit to change answers and explanations (same layout as question review, without response statistics).
        </p>
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-14">Stem</TableHead>
              <TableHead className="w-14">Q#</TableHead>
              <TableHead className="min-w-[200px]">Question</TableHead>
              <TableHead className="min-w-[120px]">Category</TableHead>
              {optionLabelsToShow.map((label) => (
                <TableHead key={label} className="min-w-[100px]">
                  {label}
                </TableHead>
              ))}
              <TableHead className="w-20">Correct</TableHead>
              <TableHead className="min-w-[140px]">Answer explanation</TableHead>
              <TableHead className="w-20">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const rowKey = `${row.stemId}-${row.questionIndex}`
              const isExpanded = expandedRowKey === rowKey
              const stem = stems.find((s) => s.id === row.stemId)
              const question = stem?.values.questions?.[row.questionIndex]
              const sectionMeta = stem
                ? sections.find((s) => s.id === stem.values.sectionId)
                : undefined
              const sectionDisplayColumns = resolveSectionDisplayColumns(undefined, sectionMeta)
              const enginePreviewQuestion =
                stem && question
                  ? stemFormValuesToEnginePreviewQuestion(
                      stem.values,
                      row.questionIndex,
                      sectionDisplayColumns
                    )
                  : null
              const correctDisplay = row.isSyllogism
                ? (row.syllogismPattern ?? '')
                : row.correctLetter

              return (
                <Fragment key={rowKey}>
                  <TableRow>
                    <TableCell className="font-mono text-muted-foreground">
                      {row.stemIndex + 1}
                    </TableCell>
                    <TableCell className="font-mono text-muted-foreground">
                      {row.globalQuestionNumber}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate" title={row.questionText}>
                      {row.questionText}
                    </TableCell>
                    <TableCell className="max-w-[120px] truncate text-muted-foreground">
                      {row.categoryName}
                    </TableCell>
                    {optionLabelsToShow.map((label, idx) => (
                      <TableCell
                        key={label}
                        className="max-w-[100px] truncate"
                        title={row.optionTexts[idx]}
                      >
                        {idx < row.optionCount ? row.optionTexts[idx] : '—'}
                      </TableCell>
                    ))}
                    <TableCell className="font-medium font-mono">{correctDisplay}</TableCell>
                    <TableCell
                      className="max-w-[140px] truncate"
                      title={row.answerExplanationPlain || undefined}
                    >
                      {row.answerExplanationTruncated || '—'}
                    </TableCell>
                    <TableCell className="p-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        aria-label={isExpanded ? 'Hide question' : 'View question'}
                        onClick={() => toggleExpanded(rowKey)}
                      >
                        {isExpanded ? (
                          <>
                            <EyeOff className="h-4 w-4" />
                            Hide
                          </>
                        ) : (
                          <>
                            <Eye className="h-4 w-4" />
                            View
                          </>
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                  {isExpanded && stem && question && (
                    <TableRow className="bg-muted/20 hover:bg-muted/20">
                      <TableCell colSpan={totalCols} className="p-0 align-top">
                        <div className="relative flex flex-col gap-3 p-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-medium text-muted-foreground">
                              Q{row.globalQuestionNumber}
                            </span>
                            <div className="inline-flex rounded-md border border-border bg-muted/40 p-0.5">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className={cn(
                                  'h-8 px-3',
                                  expandedDetailMode === 'view' && 'bg-background shadow-sm'
                                )}
                                onClick={() => setExpandedDetailMode('view')}
                              >
                                View
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className={cn(
                                  'h-8 px-3',
                                  expandedDetailMode === 'edit' && 'bg-background shadow-sm'
                                )}
                                onClick={() => onUpdateStem && setExpandedDetailMode('edit')}
                                disabled={!onUpdateStem}
                              >
                                Edit
                              </Button>
                            </div>
                          </div>
                          {expandedDetailMode === 'view' && enginePreviewQuestion ? (
                            <div className="max-h-[min(70vh,880px)] overflow-auto rounded-md border bg-white shadow-sm">
                              <UcatQuestionEnginePreview
                                key={rowKey}
                                question={enginePreviewQuestion}
                                showAnswerExplanations
                                interactive={false}
                              />
                            </div>
                          ) : null}
                          {expandedDetailMode === 'edit' && onUpdateStem ? (
                            <UcatResultsStyleQuestionEditor
                              key={rowKey}
                              stemTextJson={stem.values.stemText}
                              question={question}
                              sectionDisplayColumns={sectionDisplayColumns}
                              onSave={(stemText, updatedQuestion) => {
                                handleSaveEdit(row.stemId, row.questionIndex, stemText, updatedQuestion)
                              }}
                              onCancel={() => setExpandedDetailMode('view')}
                            />
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
