'use client'

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { cn } from '@/shared/utils'
import type { Json } from '@altitutor/shared'
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
import { BulkImportRichTextPreview } from '@/features/ucat/questions/components/bulk-import/BulkImportRichTextPreview'
import { UcatQuestionEnginePreview } from '@/features/ucat/question-engine-preview/UcatQuestionEnginePreview'
import { UcatResultsStyleQuestionEditor } from '@/features/ucat/question-engine-preview/UcatResultsStyleQuestionEditor'
import {
  resolveSectionDisplayColumns,
  stemFormValuesToEnginePreviewQuestion,
} from '@/features/ucat/question-engine-preview/mapStemFormToEnginePreview'

const OPTION_LABELS = ['A', 'B', 'C', 'D', 'E'] as const
const QUESTION_TEXT_MAX = 60
const OPTION_TEXT_MAX = 36

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
  questionTextJson: Json | null
  categoryName: string
  optionCount: number
  optionTexts: string[]
  optionTextJsons: Array<Json | null>
  correctOptionIndex: number
  correctLetter: string
  /** For syllogism: Y/N pattern e.g. 'YYNNY'; null for MC or when not set */
  isSyllogism: boolean
  syllogismPattern: string | null
  answerExplanationPlain: string
  answerExplanationJson: Json | null
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
        categoryName,
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
  const totalCols = 4 + maxOptionCount + 2 // Stem + Q# + Question + Category + options + Correct + Explanation

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
      </div>
      <div className="rounded-md border">
        <Table className="w-full table-fixed text-xs">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[3rem] px-2">Stem</TableHead>
              <TableHead className="w-[2.5rem] px-2">#</TableHead>
              <TableHead className="w-[22%] px-2">Question</TableHead>
              <TableHead className="w-[12%] px-2">Category</TableHead>
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
                  <TableRow
                    className={cn(
                      'h-9 max-h-9 cursor-pointer',
                      isExpanded && 'bg-muted/30 hover:bg-muted/30'
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
                    <TableCell className="truncate px-2 text-muted-foreground" title={row.categoryName}>
                      {row.categoryName}
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
                                onClick={(event) => {
                                  event.stopPropagation()
                                  setExpandedDetailMode('view')
                                }}
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
                                onClick={(event) => {
                                  event.stopPropagation()
                                  onUpdateStem && setExpandedDetailMode('edit')
                                }}
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
