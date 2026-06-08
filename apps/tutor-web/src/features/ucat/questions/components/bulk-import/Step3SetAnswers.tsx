'use client'

import { Fragment, useCallback, useMemo, useState } from 'react'
import { cn } from '@/shared/utils'
import type { Json } from '@altitutor/shared'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@altitutor/ui'
import type { BulkImportStemDraft } from '@/features/ucat/questions/hooks/useBulkImportWizard'
import type { UcatQuestionStemFormValues } from '@/features/ucat/questions/types/schema'
import { proseMirrorToPlainText } from '@/features/ucat/shared/lib/rich-text'
import { BulkImportRichTextPreview } from '@/features/ucat/questions/components/bulk-import/BulkImportRichTextPreview'
import { BulkImportReviewStemEditor } from '@/features/ucat/questions/components/bulk-import/BulkImportReviewStemEditor'
import type {
  CategoryOption,
  UcatSectionOption,
} from '@/features/ucat/questions/components/UcatQuestionStemDialog'

const OPTION_LABELS = ['A', 'B', 'C', 'D', 'E'] as const
const QUESTION_TEXT_MAX = 60
const OPTION_TEXT_MAX = 36

function truncateOneLine(text: string, maxLen: number): string {
  const oneLine = text.replace(/\s+/g, ' ').trim()
  if (oneLine.length <= maxLen) return oneLine
  return `${oneLine.slice(0, maxLen)}…`
}

type ReviewCategoryOption = { id?: string | null; name?: string | null; ucat_section_id?: string | null }
type ReviewSectionOption = { id: string | null; name?: string | null; display_columns?: number | null }
type ReviewTagOption = { id: string; name: string }

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
  isSyllogism: boolean
  syllogismPattern: string | null
  answerExplanationPlain: string
  answerExplanationJson: Json | null
}

function buildAnswerRows(
  stems: BulkImportStemDraft[],
  categories: ReviewCategoryOption[]
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
  categories?: ReviewCategoryOption[]
  sections?: ReviewSectionOption[]
  tags?: ReviewTagOption[]
  onUpdateStem?: (stemId: string, values: UcatQuestionStemFormValues) => void
  onNewImageFileIds?: (fileIds: string[]) => void
}

export function Step3SetAnswers({
  stems,
  categories = [],
  sections = [],
  tags = [],
  onUpdateStem,
  onNewImageFileIds,
}: Step3SetAnswersProps) {
  const rows = useMemo(() => buildAnswerRows(stems, categories), [stems, categories])
  const [expandedRowKey, setExpandedRowKey] = useState<string | null>(null)

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
      })),
    [categories]
  )

  const maxOptionCount = useMemo(
    () => (rows.length > 0 ? Math.max(...rows.map((r) => r.optionCount), 4) : 4),
    [rows]
  )
  const optionLabelsToShow = OPTION_LABELS.slice(0, maxOptionCount)
  const totalCols = 4 + maxOptionCount + 2

  const toggleExpanded = useCallback((key: string) => {
    setExpandedRowKey((current) => (current === key ? null : key))
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
