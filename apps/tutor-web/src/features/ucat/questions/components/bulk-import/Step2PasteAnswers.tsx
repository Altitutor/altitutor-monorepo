'use client'

import { useCallback, useMemo } from 'react'
import type { Json } from '@altitutor/shared'
import { BulkImportParseInfoButton } from '@/features/ucat/questions/components/bulk-import/BulkImportParseInfoButton'
import { BulkImportParseLegendButton } from '@/features/ucat/questions/components/bulk-import/BulkImportParseLegendButton'
import { BULK_IMPORT_RTE_PASTE } from '@/features/ucat/questions/components/bulk-import/bulkImportRichTextDefaults'
import { computeAnswerPasteStats } from '@/features/ucat/questions/components/bulk-import/bulkImportPasteStats'
import { UcatRichTextEditor } from '@/features/ucat/shared/UcatRichTextEditor'
import type { UcatParseHighlightConfig } from '@/features/ucat/shared/ucatParseHighlightPlugin'
import { cn } from '@/shared/utils'

type Step2PasteAnswersProps = {
  value: Json | null
  onChange: (value: Json) => void
  /** When set, fills a parent flex column and scrolls only the editor region. */
  layout?: 'default' | 'split'
}

/**
 * When the user pastes an HTML table (e.g. from Word/Google Docs), convert it to TSV
 * and set one paragraph per row so the rich doc matches a plain TSV import.
 */
function htmlTableToTsv(html: string): string {
  if (typeof document === 'undefined') return ''
  try {
    const doc = new DOMParser().parseFromString(html, 'text/html')
    const table = doc.querySelector('table')
    if (!table) return ''
    const rows: string[] = []
    table.querySelectorAll('tr').forEach((tr) => {
      const cells = Array.from(tr.querySelectorAll('td, th')).map((el) =>
        (el.textContent ?? '').trim().replace(/\t/g, ' ').replace(/\n/g, ' ')
      )
      if (cells.length > 0) rows.push(cells.join('\t'))
    })
    return rows.join('\n')
  } catch {
    return ''
  }
}

function tsvPlainTextToAnswerDocJson(tsv: string): Json {
  const lines = tsv.split(/\r\n|\n|\r/)
  return {
    type: 'doc',
    content: lines.map((line) => ({
      type: 'paragraph',
      content: line ? [{ type: 'text', text: line }] : [],
    })),
  } as unknown as Json
}

export function Step2PasteAnswers({ value, onChange, layout = 'default' }: Step2PasteAnswersProps) {
  const isSplit = layout === 'split'
  const answerParseHighlight: UcatParseHighlightConfig = useMemo(
    () => ({ mode: 'answer', includeExplanations: true }),
    []
  )

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const html = e.clipboardData?.getData?.('text/html')
      if (html && html.trim().includes('<table')) {
        const tsv = htmlTableToTsv(html)
        if (tsv) {
          e.preventDefault()
          onChange(tsvPlainTextToAnswerDocJson(tsv))
        }
      }
    },
    [onChange]
  )

  const answerPasteStats = useMemo(() => computeAnswerPasteStats(value), [value])

  return (
    <div className={cn(isSplit ? 'flex h-full min-h-0 flex-col gap-3' : 'space-y-4')}>
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
        <div className="flex min-w-0 items-center gap-0.5">
          <h2 className="text-base font-semibold">Paste answers</h2>
          <BulkImportParseInfoButton
            variant="answers"
            stats={answerPasteStats}
            includeExplanationsOnImport
          />
        </div>
        <BulkImportParseLegendButton variant="answers" includeExplanationsOnImport />
      </div>

      <div
        className={cn(
          'rounded-md border bg-muted/40 p-3',
          isSplit ? 'min-h-0 flex-1 overflow-y-auto' : 'min-h-[320px]'
        )}
        onPasteCapture={handlePaste}
      >
        <UcatRichTextEditor
          value={value}
          onChange={onChange}
          placeholder="Paste your table here… (e.g. B	Explanation for Q1…, one row per line)"
          minHeight={isSplit ? '200px' : '280px'}
          stemId={null}
          enableImages={false}
          pastePlainTextAsParagraphs
          pasteTableBehavior="keep"
          {...BULK_IMPORT_RTE_PASTE}
          ucatParseHighlight={answerParseHighlight}
        />
      </div>
    </div>
  )
}
