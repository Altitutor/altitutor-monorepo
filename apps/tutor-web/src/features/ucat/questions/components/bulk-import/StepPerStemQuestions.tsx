'use client'

import { useCallback, useMemo, useState } from 'react'
import type { Json } from '@altitutor/shared'
import { Button, Label } from '@altitutor/ui'
import { AlertTriangle } from 'lucide-react'
import { UcatRichTextEditor } from '@/features/ucat/shared/UcatRichTextEditor'
import { cn } from '@/shared/utils'
import type { BulkImportParseSection } from '@/features/ucat/questions/components/bulk-import/bulkImportLogicalLines'
import {
  Step2PasteDocument,
  type ParsingOptions,
  type PasteTableBehavior,
} from '@/features/ucat/questions/components/bulk-import/Step2PasteDocument'
import { BULK_IMPORT_RTE_PASTE } from '@/features/ucat/questions/components/bulk-import/bulkImportRichTextDefaults'
import { parseQuestionsOnlyForSection } from '@/features/ucat/questions/components/bulk-import/bulkImportParseSection'
import { computeQuestionPasteStats } from '@/features/ucat/questions/components/bulk-import/bulkImportPasteStats'

const PREVIEW_LINE_LIMIT = 3
const COLLAPSED_EDITOR_MIN_HEIGHT = '3rem'
const EXPANDED_EDITOR_MIN_HEIGHT = '160px'

type StepPerStemQuestionsProps = {
  stemTexts: string[]
  perStemDocs: Array<Json | null>
  onPerStemDocChange: (index: number, value: Json) => void
  section: BulkImportParseSection
  parsingOptions: ParsingOptions
  onParsingOptionsChange: (options: ParsingOptions) => void
  pasteTableBehavior: PasteTableBehavior
  onPasteTableBehaviorChange: (behavior: PasteTableBehavior) => void
  onImageFileIdsChange?: (fileIds: string[]) => void
}

function truncateStemPreview(text: string): string {
  const lines = text.split('\n').filter((l) => l.trim().length > 0)
  if (lines.length <= PREVIEW_LINE_LIMIT) return lines.join('\n')
  return `${lines.slice(0, PREVIEW_LINE_LIMIT).join('\n')}\n…`
}

function PerStemQuestionRow({
  index,
  stemText,
  value,
  onChange,
  section,
  parsingOptions,
  pasteTableBehavior,
  onImageFileIdsChange,
  expanded,
  onExpand,
}: {
  index: number
  stemText: string
  value: Json | null
  onChange: (value: Json) => void
  section: BulkImportParseSection
  parsingOptions: ParsingOptions
  pasteTableBehavior: PasteTableBehavior
  onImageFileIdsChange?: (fileIds: string[]) => void
  expanded: boolean
  onExpand: () => void
}) {
  const parseState = useMemo(
    () => parseQuestionsOnlyForSection(value, section, parsingOptions),
    [value, section, parsingOptions]
  )

  const classify = useMemo(
    () => ({
      questionIndicator: parsingOptions.questionIndicator,
      answerOptionIndicator: parsingOptions.answerOptionIndicator,
      questionNumberOnOwnLine: parsingOptions.questionNumberOnOwnLine,
      answerOptionOnOwnLine: parsingOptions.answerOptionOnOwnLine,
    }),
    [parsingOptions]
  )

  const stats = useMemo(
    () => computeQuestionPasteStats(value, section, classify),
    [value, section, classify]
  )

  const hasQuestions = parseState.questions.length > 0

  return (
    <div
      className={cn(
        'grid gap-3 rounded-lg border p-3 md:grid-cols-2',
        !hasQuestions && 'border-amber-500/40',
        !expanded && 'opacity-95'
      )}
      onFocusCapture={onExpand}
      onClick={onExpand}
    >
      <div className="space-y-2">
        <div className="text-sm font-semibold">Stem {index + 1}</div>
        <pre
          className={cn(
            'whitespace-pre-wrap rounded border bg-muted/30 p-2 text-xs leading-relaxed',
            !expanded && 'line-clamp-3 max-h-[4.5rem] overflow-hidden'
          )}
        >
          {expanded ? stemText : truncateStemPreview(stemText)}
        </pre>
      </div>
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <Label className="text-xs font-medium">Questions for this stem</Label>
          <span className="text-xs text-muted-foreground">
            {stats.totalQuestions} question{stats.totalQuestions === 1 ? '' : 's'}
          </span>
        </div>
        {parseState.stemLikeWarning && expanded ? (
          <div className="flex items-start gap-1.5 rounded border border-amber-500/40 bg-amber-500/5 px-2 py-1.5 text-xs text-amber-800 dark:text-amber-300">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Stem-like content detected — did you paste the right section?
          </div>
        ) : null}
        <div
          className={cn(
            'rounded-md border bg-muted/40 p-2 transition-[max-height]',
            expanded ? 'min-h-[160px]' : 'max-h-24 overflow-hidden'
          )}
        >
          <UcatRichTextEditor
            value={value}
            onChange={onChange}
            placeholder={
              expanded
                ? 'Paste questions and answer options for this stem…'
                : 'Click to paste questions…'
            }
            minHeight={expanded ? EXPANDED_EDITOR_MIN_HEIGHT : COLLAPSED_EDITOR_MIN_HEIGHT}
            stemId={null}
            enableImages
            onImageFileIdsChange={onImageFileIdsChange}
            pasteTableBehavior={pasteTableBehavior}
            {...BULK_IMPORT_RTE_PASTE}
            ucatParseHighlight={
              expanded
                ? {
                    mode: 'question',
                    section,
                    classify,
                  }
                : { mode: 'off' }
            }
          />
        </div>
      </div>
    </div>
  )
}

export function StepPerStemQuestions({
  stemTexts,
  perStemDocs,
  onPerStemDocChange,
  section,
  parsingOptions,
  onParsingOptionsChange,
  pasteTableBehavior,
  onPasteTableBehaviorChange,
  onImageFileIdsChange,
}: StepPerStemQuestionsProps) {
  const [expandedRows, setExpandedRows] = useState<Set<number>>(() => new Set())

  const expandRow = useCallback((index: number) => {
    setExpandedRows((prev) => {
      if (prev.has(index)) return prev
      const next = new Set(prev)
      next.add(index)
      return next
    })
  }, [])

  const expandAll = useCallback(() => {
    setExpandedRows(new Set(stemTexts.map((_, i) => i)))
  }, [stemTexts])

  const collapseAll = useCallback(() => {
    setExpandedRows(new Set())
  }, [])

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
        <Step2PasteDocument
          title="Question parsing options"
          placeholder=""
          value={null}
          onChange={() => undefined}
          parsingOptions={parsingOptions}
          onParsingOptionsChange={onParsingOptionsChange}
          pasteTableBehavior={pasteTableBehavior}
          onPasteTableBehaviorChange={onPasteTableBehaviorChange}
          settingsOnly
        />
        <div className="flex shrink-0 gap-2">
          <Button type="button" variant="outline" size="sm" onClick={collapseAll}>
            Collapse all
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={expandAll}>
            Expand all
          </Button>
        </div>
      </div>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
        {stemTexts.map((stemText, index) => (
          <PerStemQuestionRow
            key={index}
            index={index}
            stemText={stemText}
            value={perStemDocs[index] ?? null}
            onChange={(doc) => onPerStemDocChange(index, doc)}
            section={section}
            parsingOptions={parsingOptions}
            pasteTableBehavior={pasteTableBehavior}
            onImageFileIdsChange={onImageFileIdsChange}
            expanded={expandedRows.has(index)}
            onExpand={() => expandRow(index)}
          />
        ))}
      </div>
    </div>
  )
}
