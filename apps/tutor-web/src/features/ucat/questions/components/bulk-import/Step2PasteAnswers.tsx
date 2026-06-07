'use client'

import { useMemo } from 'react'
import type { Json } from '@altitutor/shared'
import { BULK_IMPORT_RTE_PASTE } from '@/features/ucat/questions/components/bulk-import/bulkImportRichTextDefaults'
import {
  answerFieldSeparatorChar,
  type AnswerFieldSeparator,
} from '@/features/ucat/questions/lib/parseAnswersTable'
import { UcatRichTextEditor } from '@/features/ucat/shared/UcatRichTextEditor'
import type { UcatParseHighlightConfig } from '@/features/ucat/shared/ucatParseHighlightPlugin'
import { cn } from '@/shared/utils'
import type { AnswerParsingOptions } from '@/features/ucat/questions/components/bulk-import/StepAnswers'

type Step2PasteAnswersProps = {
  value: Json | null
  onChange: (value: Json) => void
  /** When set, fills a parent flex column and scrolls only the editor region. */
  layout?: 'default' | 'split'
  /** When true, omits the step heading (used inside {@link StepAnswers} split layout). */
  embedded?: boolean
  answerParsingOptions?: AnswerParsingOptions
}

function separatorPlaceholderExample(separator: AnswerFieldSeparator): string {
  const sep =
    separator === 'tab' ? '\t' : answerFieldSeparatorChar(separator)
  return `Paste your table here… (e.g. 1${sep}B${sep}Explanation for Q1…, one row per line)`
}

export function Step2PasteAnswers({
  value,
  onChange,
  layout = 'default',
  embedded = false,
  answerParsingOptions,
}: Step2PasteAnswersProps) {
  const isSplit = layout === 'split'
  const fieldSeparator = answerParsingOptions?.fieldSeparator ?? 'tab'
  const pasteTableBehavior = answerParsingOptions?.pasteTableBehavior ?? 'keep'
  const answerParseHighlight: UcatParseHighlightConfig = useMemo(
    () => ({ mode: 'answer', includeExplanations: true, fieldSeparator }),
    [fieldSeparator]
  )

  return (
    <div className={cn(isSplit ? 'flex h-full min-h-0 flex-col' : 'space-y-4')}>
      {!embedded ? (
        <h2 className="text-base font-semibold">Paste answers</h2>
      ) : null}

      <div
        className={cn(
          'rounded-md border bg-muted/40 p-3',
          isSplit ? 'min-h-0 flex-1 overflow-y-auto' : 'min-h-[320px]'
        )}
      >
        <UcatRichTextEditor
          value={value}
          onChange={onChange}
          placeholder={separatorPlaceholderExample(fieldSeparator)}
          minHeight={isSplit ? '200px' : '280px'}
          stemId={null}
          enableImages={false}
          pasteTableBehavior={pasteTableBehavior}
          {...BULK_IMPORT_RTE_PASTE}
          pasteStripFormatting={false}
          ucatParseHighlight={answerParseHighlight}
        />
      </div>
    </div>
  )
}
