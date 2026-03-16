'use client'

import { Fragment, useCallback, useMemo, useState } from 'react'
import type { Json } from '@altitutor/shared'
import { Eye, EyeOff, Pencil } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Button,
  Label,
  RadioGroup,
  RadioGroupItem,
} from '@altitutor/ui'
import type { BulkImportStemDraft } from '@/features/ucat/questions/hooks/useBulkImportWizard'
import type { UcatQuestionStemFormValues } from '@/features/ucat/questions/types/schema'
import { proseMirrorToPlainText } from '@/features/ucat/shared/lib/rich-text'
import { UcatRichTextEditor } from '@/features/ucat/shared/UcatRichTextEditor'
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

type QuestionEditFormProps = {
  stemId: string
  questionIndex: number
  stemTextJson: Json | null | undefined
  question: UcatQuestionStemFormValues['questions'][number]
  questionNumber: number
  onSave: (
    stemId: string,
    questionIndex: number,
    stemText: Json | null | undefined,
    question: UcatQuestionStemFormValues['questions'][number]
  ) => void
  onCancel: () => void
}

function QuestionEditForm({
  stemId,
  questionIndex,
  stemTextJson,
  question,
  questionNumber,
  onSave,
  onCancel,
}: QuestionEditFormProps) {
  const [stemText, setStemText] = useState<Json | null | undefined>(stemTextJson)
  const [questionText, setQuestionText] = useState<Json | null | undefined>(
    question.questionText
  )
  const [options, setOptions] = useState(question.options ?? [])
  const [correctOptionIndex, setCorrectOptionIndex] = useState(
    question.options?.findIndex((o) => o.isAnswer) ?? 0
  )
  const [answerExplanation, setAnswerExplanation] = useState<Json | null | undefined>(
    question.answerExplanation
  )
  const initialPattern =
    (question as { syllogismAnswerPattern?: string | null }).syllogismAnswerPattern ??
    (question.options ?? [])
      .map((o) => (o.isAnswer ? 'Y' : 'N'))
      .join('')
  const [syllogismPattern, setSyllogismPattern] = useState<string>(initialPattern)
  const isSyllogism = (question as { questionType?: string }).questionType === 'syllogism'

  const handleSave = () => {
    const resolvedCorrect = correctOptionIndex >= 0 ? correctOptionIndex : 0
    const updatedOptions = options.map((opt, i) => ({
      ...opt,
      isAnswer: isSyllogism
        ? syllogismPattern.charAt(i).toUpperCase() === 'Y'
        : i === resolvedCorrect,
    }))
    const qWithPattern = {
      ...question,
      questionText: questionText ?? question.questionText,
      answerExplanation: answerExplanation ?? question.answerExplanation,
      options: updatedOptions,
      syllogismAnswerPattern:
        isSyllogism && syllogismPattern.length === options.length
          ? syllogismPattern
          : null,
    } as UcatQuestionStemFormValues['questions'][number]
    onSave(stemId, questionIndex, stemText, qWithPattern)
  }

  return (
    <div className="space-y-4 rounded-md border border-border bg-background p-4">
      <div className="space-y-2">
        <Label className="text-xs font-medium text-muted-foreground">Stem text</Label>
        <UcatRichTextEditor
          value={stemText}
          onChange={(v) => setStemText(v)}
          minHeight="120px"
          pasteTableBehavior="keep"
        />
      </div>
      <div className="space-y-2">
        <Label className="text-xs font-medium text-muted-foreground">
          {questionNumber}. Question text
        </Label>
        <UcatRichTextEditor
          value={questionText}
          onChange={(v) => setQuestionText(v)}
          minHeight="80px"
          pasteTableBehavior="keep"
        />
      </div>
      <div className="space-y-2">
        <Label className="text-xs font-medium text-muted-foreground">
          Answer options
        </Label>
        {!isSyllogism && (
          <RadioGroup
            value={String(correctOptionIndex)}
            onValueChange={(v) => setCorrectOptionIndex(Number.parseInt(v, 10))}
            className="mb-2 flex flex-wrap gap-4"
          >
            {options.map((_, idx) => (
              <div key={idx} className="flex items-center gap-1.5">
                <RadioGroupItem value={String(idx)} id={`correct-${idx}`} />
                <Label htmlFor={`correct-${idx}`} className="text-xs font-normal cursor-pointer">
                  {OPTION_LABELS[idx] ?? idx + 1} is correct
                </Label>
              </div>
            ))}
          </RadioGroup>
        )}
        <div className="space-y-2">
          {options.map((opt, idx) => (
            <div key={idx} className="flex items-start gap-2">
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="w-6 shrink-0 font-mono text-muted-foreground">
                    {OPTION_LABELS[idx] ?? idx + 1}.
                  </span>
                  {isSyllogism && (
                    <div className="flex items-center gap-2">
                      <RadioGroup
                        value={syllogismPattern.charAt(idx) === 'Y' ? 'Y' : 'N'}
                        onValueChange={(v) => {
                          const arr = syllogismPattern.split('')
                          arr[idx] = v
                          setSyllogismPattern(
                            arr.join('').padEnd(options.length, 'N').slice(0, options.length)
                          )
                        }}
                        className="flex gap-2"
                      >
                        <div className="flex items-center gap-1">
                          <RadioGroupItem value="Y" id={`yn-y-${idx}`} />
                          <Label htmlFor={`yn-y-${idx}`} className="text-xs font-normal cursor-pointer">
                            Yes
                          </Label>
                        </div>
                        <div className="flex items-center gap-1">
                          <RadioGroupItem value="N" id={`yn-n-${idx}`} />
                          <Label htmlFor={`yn-n-${idx}`} className="text-xs font-normal cursor-pointer">
                            No
                          </Label>
                        </div>
                      </RadioGroup>
                    </div>
                  )}
                </div>
                <UcatRichTextEditor
                  value={opt.answerText}
                  onChange={(v) => {
                    const next = [...options]
                    next[idx] = { ...opt, answerText: v }
                    setOptions(next)
                  }}
                  minHeight="48px"
                  pasteTableBehavior="keep"
                />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <Label className="text-xs font-medium text-muted-foreground">
          Answer explanation
        </Label>
        <UcatRichTextEditor
          value={answerExplanation}
          onChange={(v) => setAnswerExplanation(v)}
          minHeight="60px"
          pasteTableBehavior="keep"
        />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" size="sm" className="h-9" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="button" size="sm" className="h-9" onClick={handleSave}>
          Save
        </Button>
      </div>
    </div>
  )
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
  onUpdateStem?: (stemId: string, values: UcatQuestionStemFormValues) => void
}

export function Step3SetAnswers({ stems, categories = [], onUpdateStem }: Step3SetAnswersProps) {
  const rows = useMemo(() => buildAnswerRows(stems, categories), [stems, categories])
  const [expandedRowKey, setExpandedRowKey] = useState<string | null>(null)
  const [editingRowKey, setEditingRowKey] = useState<string | null>(null)

  const maxOptionCount = useMemo(
    () => (rows.length > 0 ? Math.max(...rows.map((r) => r.optionCount), 4) : 4),
    [rows]
  )
  const optionLabelsToShow = OPTION_LABELS.slice(0, maxOptionCount)
  const totalCols = 5 + maxOptionCount + 3 // Stem + # + Question + Category + A..E + Correct + Explanation + Actions

  const toggleExpanded = useCallback((key: string) => {
    setExpandedRowKey((current) => {
      const next = current === key ? null : key
      if (next !== key) setEditingRowKey(null)
      return next
    })
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
      setEditingRowKey(null)
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
          Expand a row to preview, then use Edit to modify any field.
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
                        <div className="relative p-3">
                          {editingRowKey === rowKey && onUpdateStem ? (
                            <QuestionEditForm
                              stemId={row.stemId}
                              questionIndex={row.questionIndex}
                              stemTextJson={stem.values.stemText}
                              question={question}
                              questionNumber={row.globalQuestionNumber}
                              onSave={handleSaveEdit}
                              onCancel={() => setEditingRowKey(null)}
                            />
                          ) : (
                            <div className="flex flex-col gap-3">
                              <div className="flex justify-end">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="h-8 gap-1.5"
                                  onClick={() => onUpdateStem && setEditingRowKey(rowKey)}
                                  disabled={!onUpdateStem}
                                >
                                  <Pencil className="h-4 w-4" />
                                  Edit
                                </Button>
                              </div>
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
                          )}
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
