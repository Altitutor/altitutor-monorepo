'use client'

import { useCallback } from 'react'
import { Textarea } from '@altitutor/ui'
import { parseAnswersTable } from '@/features/ucat/questions/lib/parseAnswersTable'

type Step2PasteAnswersProps = {
  value: string
  onChange: (value: string) => void
}

/**
 * When user pastes an HTML table (e.g. from Word/Google Docs), convert it to TSV
 * so the textarea shows tab/newline content and we can parse it consistently.
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

export function Step2PasteAnswers({
  value,
  onChange,
}: Step2PasteAnswersProps) {
  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const html = e.clipboardData?.getData?.('text/html')
      if (html && html.trim().includes('<table')) {
        const tsv = htmlTableToTsv(html)
        if (tsv) {
          e.preventDefault()
          onChange(tsv)
        }
      }
    },
    [onChange]
  )

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold">Paste answers table</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Paste your table of correct answers and explanations. One row per question, in order.
          The first row can be headers (e.g. &quot;Answer&quot; and &quot;Explanation&quot;) and will be
          skipped. Each row should have the correct option letter (A, B, C, D, or E) and the answer
          explanation. You can copy from Google Docs, Word, or Excel.
        </p>
      </div>

      <Textarea
        className="min-h-[280px] font-mono text-sm"
        placeholder="Paste your table here… (e.g. B	Explanation for Q1…&#10;C	Explanation for Q2…)"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onPaste={handlePaste}
      />

      {value.trim().length > 0 && (
        <p className="text-xs text-muted-foreground">
          Parsed {parseAnswersTable(value).length} answer row(s). Click Next to apply them to the
          questions.
        </p>
      )}
    </div>
  )
}
