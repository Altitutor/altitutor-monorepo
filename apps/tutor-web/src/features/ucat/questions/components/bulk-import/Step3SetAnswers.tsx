'use client'

import { Fragment, useMemo, useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
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
import { proseMirrorToPlainText } from '@/features/ucat/shared/lib/rich-text'
import { QuestionPreviewContent } from '@/features/ucat/questions/components/bulk-import/QuestionPreviewContent'

const OPTION_LABELS = ['A', 'B', 'C', 'D', 'E'] as const
const QUESTION_TEXT_MAX = 80
const OPTION_TEXT_MAX = 50
const EXPLANATION_TRUNCATE = 60

function truncateOneLine(text: string, maxLen: number): string {
  const oneLine = text.replace(/\s+/g, ' ').trim()
  if (oneLine.length <= maxLen) return oneLine
  return `${oneLine.slice(0, maxLen)}…`
}

export type AnswerRow = {
  stemId: string
  stemIndex: number
  questionIndex: number
  globalQuestionNumber: number
  questionText: string
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

function buildAnswerRows(stems: BulkImportStemDraft[]): AnswerRow[] {
  const rows: AnswerRow[] = []
  let globalNumber = 0
  stems.forEach((stem, stemIndex) => {
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
}

export function Step3SetAnswers({ stems }: Step3SetAnswersProps) {
  const rows = useMemo(() => buildAnswerRows(stems), [stems])
  const [expandedRowKey, setExpandedRowKey] = useState<string | null>(null)

  const maxOptionCount = useMemo(
    () => (rows.length > 0 ? Math.max(...rows.map((r) => r.optionCount), 4) : 4),
    [rows]
  )
  const optionLabelsToShow = OPTION_LABELS.slice(0, maxOptionCount)
  const totalCols = 4 + maxOptionCount + 3 // Stem + # + Question + A..E + Correct + Explanation + Actions

  const toggleExpanded = (key: string) => {
    setExpandedRowKey((current) => (current === key ? null : key))
  }

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
          Expand a row to preview the question.
        </p>
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-14">Stem</TableHead>
              <TableHead className="w-14">Q#</TableHead>
              <TableHead className="min-w-[200px]">Question</TableHead>
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
              const options = question?.options ?? []
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
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        aria-label={isExpanded ? 'Collapse question' : 'Expand question'}
                        onClick={() => toggleExpanded(rowKey)}
                      >
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                  {isExpanded && stem && question && (
                    <TableRow className="bg-muted/20 hover:bg-muted/20">
                      <TableCell colSpan={totalCols} className="p-0 align-top">
                        <div className="p-3">
                          <QuestionPreviewContent
                            questionNumber={row.globalQuestionNumber}
                            stemTextJson={stem.values.stemText}
                            questionTextJson={question.questionText}
                            questionAnswerExplanationJson={question.answerExplanation}
                            options={options}
                            correctOptionIndex={row.correctOptionIndex}
                            isSyllogism={row.isSyllogism}
                            syllogismPattern={row.syllogismPattern}
                          />
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
