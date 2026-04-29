'use client'

import { useCallback, useMemo } from 'react'
import type { Json } from '@altitutor/shared'
import {
  Button,
  Checkbox,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
  Label,
} from '@altitutor/ui'
import { Settings2 } from 'lucide-react'
import { BulkImportParseInfoButton } from '@/features/ucat/questions/components/bulk-import/BulkImportParseInfoButton'
import { computeAnswerPasteStats } from '@/features/ucat/questions/components/bulk-import/bulkImportPasteStats'
import { UcatRichTextEditor } from '@/features/ucat/shared/UcatRichTextEditor'
import type { UcatParseHighlightConfig } from '@/features/ucat/shared/ucatParseHighlightPlugin'
import { cn } from '@/shared/utils'

type Step2PasteAnswersProps = {
  value: Json | null
  onChange: (value: Json) => void
  /** When set, fills a parent flex column and scrolls only the editor region. */
  layout?: 'default' | 'split'
  includeExplanationsOnImport: boolean
  onIncludeExplanationsOnImportChange: (value: boolean) => void
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

export function Step2PasteAnswers({
  value,
  onChange,
  layout = 'default',
  includeExplanationsOnImport,
  onIncludeExplanationsOnImportChange,
}: Step2PasteAnswersProps) {
  const isSplit = layout === 'split'
  const answerParseHighlight: UcatParseHighlightConfig = useMemo(
    () => ({ mode: 'answer', includeExplanations: includeExplanationsOnImport }),
    [includeExplanationsOnImport]
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
      <div
        className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-3"
      >
        <div className="flex min-w-0 items-center gap-0.5">
          <h2 className="text-base font-semibold">Paste answers</h2>
          <BulkImportParseInfoButton
            variant="answers"
            stats={answerPasteStats}
            includeExplanationsOnImport={includeExplanationsOnImport}
          />
        </div>
        <div className="shrink-0 self-start sm:pt-0.5">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                aria-label="Settings for answers import"
              >
                <Settings2 className="h-3.5 w-3.5" />
                Answer settings
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-72 max-h-[min(24rem,70vh)] overflow-y-auto" align="end">
              <DropdownMenuLabel className="text-xs">Import</DropdownMenuLabel>
              <div className="px-1 pb-1">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="bulk-import-include-answer-explanations"
                    checked={includeExplanationsOnImport}
                    onCheckedChange={(checked) =>
                      onIncludeExplanationsOnImportChange(checked === true)
                    }
                  />
                  <Label
                    htmlFor="bulk-import-include-answer-explanations"
                    className="cursor-pointer text-xs font-normal leading-snug"
                  >
                    Include explanations when importing (correct letters are always applied)
                  </Label>
                </div>
                {!includeExplanationsOnImport && (
                  <p className="mt-2 text-[10px] text-muted-foreground">
                    Explanations are dimmed in the editor and will not be written to questions on
                    import.
                  </p>
                )}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
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
          ucatParseHighlight={answerParseHighlight}
        />
      </div>
    </div>
  )
}
