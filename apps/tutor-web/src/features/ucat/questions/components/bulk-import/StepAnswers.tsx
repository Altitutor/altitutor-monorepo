'use client'

import { useCallback, useMemo, useState } from 'react'
import type { Json } from '@altitutor/shared'
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
  Label,
  SearchableSelect,
} from '@altitutor/ui'
import { Settings2 } from 'lucide-react'
import { CollapsibleAnswerQuestionCard } from '@/features/ucat/questions/components/bulk-import/CollapsibleAnswerQuestionCard'
import { BulkImportParseLegendButton } from '@/features/ucat/questions/components/bulk-import/BulkImportParseLegendButton'
import { Step2PasteAnswers } from '@/features/ucat/questions/components/bulk-import/Step2PasteAnswers'
import { buildQuestionAnswerPreviews } from '@/features/ucat/questions/components/bulk-import/bulkImportBulkAnswers'
import type { BulkImportStemDraft } from '@/features/ucat/questions/hooks/useBulkImportWizard'
import type {
  AnswerFieldSeparator,
  AnswerParseOptions,
} from '@/features/ucat/questions/lib/parseAnswersTable'
import type { PasteTableBehavior } from '@/features/ucat/questions/components/bulk-import/Step2PasteDocument'

export type AnswerParsingOptions = {
  fieldSeparator: AnswerFieldSeparator
  pasteTableBehavior: PasteTableBehavior
}

export const DEFAULT_ANSWER_PARSING_OPTIONS: AnswerParsingOptions = {
  fieldSeparator: 'tab',
  pasteTableBehavior: 'keep',
}

const ANSWER_FIELD_SEPARATOR_OPTIONS: { value: AnswerFieldSeparator; label: string }[] = [
  { value: 'tab', label: 'Tab' },
  { value: 'comma', label: 'Comma (,)' },
  { value: 'semicolon', label: 'Semicolon (;)' },
  { value: 'pipe', label: 'Pipe (|)' },
]

const ANSWER_PASTE_TABLE_BEHAVIOR_OPTIONS: { value: PasteTableBehavior; label: string }[] = [
  { value: 'keep', label: 'None (keep formatting)' },
  { value: 'strip_outside', label: 'Strip outside tables only' },
  { value: 'strip_all', label: 'Strip all tables' },
]

export function answerParsingOptionsToParseOptions(
  options: AnswerParsingOptions
): AnswerParseOptions {
  return { fieldSeparator: options.fieldSeparator }
}

type StepAnswersProps = {
  bulkAnswersJson: Json | null
  onBulkAnswersChange: (value: Json) => void
  onImageFileIdsChange?: (fileIds: string[]) => void
  stems: BulkImportStemDraft[]
  isDecisionMakingSection: boolean
  answerParsingOptions: AnswerParsingOptions
  onAnswerParsingOptionsChange: (options: AnswerParsingOptions) => void
}

export function StepAnswers({
  bulkAnswersJson,
  onBulkAnswersChange,
  onImageFileIdsChange,
  stems,
  isDecisionMakingSection,
  answerParsingOptions,
  onAnswerParsingOptionsChange,
}: StepAnswersProps) {
  const [expandedQuestionKeys, setExpandedQuestionKeys] = useState<Set<string>>(() => new Set())
  const parseOptions = useMemo(
    () => answerParsingOptionsToParseOptions(answerParsingOptions),
    [answerParsingOptions]
  )

  const previews = useMemo(
    () =>
      buildQuestionAnswerPreviews(
        stems,
        bulkAnswersJson,
        isDecisionMakingSection,
        parseOptions
      ),
    [stems, bulkAnswersJson, isDecisionMakingSection, parseOptions]
  )

  const toggleQuestionExpanded = useCallback((key: string) => {
    setExpandedQuestionKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex shrink-0 flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-base font-semibold">Paste answers</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Paste one answers document for all questions. Explanations are required for every question.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <BulkImportParseLegendButton variant="answers" includeExplanationsOnImport />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                aria-label="Answer parsing settings"
              >
                <Settings2 className="h-3.5 w-3.5" />
                Answer settings
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className="w-72 max-w-[min(18rem,92vw)] p-2"
              align="end"
            >
              <DropdownMenuLabel className="px-0 text-xs">Field separator</DropdownMenuLabel>
              <p className="mb-2 text-[11px] leading-snug text-muted-foreground">
                Character between question number, answer option, and explanation columns.
              </p>
              <SearchableSelect<{ value: AnswerFieldSeparator; label: string }>
                items={ANSWER_FIELD_SEPARATOR_OPTIONS}
                value={
                  ANSWER_FIELD_SEPARATOR_OPTIONS.find(
                    (o) => o.value === answerParsingOptions.fieldSeparator
                  ) ?? ANSWER_FIELD_SEPARATOR_OPTIONS[0]!
                }
                onValueChange={(item) =>
                  item &&
                  onAnswerParsingOptionsChange({
                    ...answerParsingOptions,
                    fieldSeparator: item.value,
                  })
                }
                getItemLabel={(item) => item.label}
                getItemId={(item) => item.value}
                triggerClassName="w-full"
              />
              <DropdownMenuLabel className="mt-3 px-0 text-xs">Table paste handling</DropdownMenuLabel>
              <p className="mb-2 text-[11px] leading-snug text-muted-foreground">
                How pasted tables are converted when importing from Word, Google Docs, or Excel.
              </p>
              <SearchableSelect<{ value: PasteTableBehavior; label: string }>
                items={ANSWER_PASTE_TABLE_BEHAVIOR_OPTIONS}
                value={
                  ANSWER_PASTE_TABLE_BEHAVIOR_OPTIONS.find(
                    (o) => o.value === answerParsingOptions.pasteTableBehavior
                  ) ?? ANSWER_PASTE_TABLE_BEHAVIOR_OPTIONS[0]!
                }
                onValueChange={(item) =>
                  item &&
                  onAnswerParsingOptionsChange({
                    ...answerParsingOptions,
                    pasteTableBehavior: item.value,
                  })
                }
                getItemLabel={(item) => item.label}
                getItemId={(item) => item.value}
                triggerClassName="w-full"
              />
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="grid shrink-0 gap-3 border-b border-border pb-2 lg:grid-cols-2">
        <Label className="text-xs font-medium text-muted-foreground">Questions</Label>
        <Label className="text-xs font-medium text-muted-foreground">Paste answers document</Label>
      </div>

      <div className="grid min-h-0 flex-1 gap-4 overflow-hidden lg:grid-cols-2">
        <div className="min-h-0 overflow-y-auto pr-1">
          {previews.length === 0 ? (
            <p className="text-sm text-muted-foreground">No questions to match answers against.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {previews.map((preview) => {
                const key = `${preview.row.stemId}:${preview.row.questionIndex}`
                return (
                  <CollapsibleAnswerQuestionCard
                    key={key}
                    preview={preview}
                    expanded={expandedQuestionKeys.has(key)}
                    onToggle={() => toggleQuestionExpanded(key)}
                  />
                )
              })}
            </div>
          )}
        </div>

        <div className="flex min-h-0 min-w-0 flex-col">
          <Step2PasteAnswers
            value={bulkAnswersJson}
            onChange={onBulkAnswersChange}
            onImageFileIdsChange={onImageFileIdsChange}
            layout="split"
            embedded
            answerParsingOptions={answerParsingOptions}
          />
        </div>
      </div>
    </div>
  )
}
