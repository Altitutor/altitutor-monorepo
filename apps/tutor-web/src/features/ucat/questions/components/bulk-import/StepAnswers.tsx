'use client'

import { useMemo } from 'react'
import type { Json } from '@altitutor/shared'
import {
  Button,
  Label,
  RadioGroup,
  RadioGroupItem,
  Switch,
} from '@altitutor/ui'
import { cn } from '@/shared/utils'
import { Step2PasteAnswers } from '@/features/ucat/questions/components/bulk-import/Step2PasteAnswers'
import { BULK_IMPORT_RTE_PASTE } from '@/features/ucat/questions/components/bulk-import/bulkImportRichTextDefaults'
import { UcatRichTextEditor } from '@/features/ucat/shared/UcatRichTextEditor'
import type { BulkImportStemDraft } from '@/features/ucat/questions/hooks/useBulkImportWizard'
import {
  type FlatQuestionRef,
  type PerQuestionAnswerDraft,
  flattenBulkImportQuestions,
} from '@/features/ucat/questions/components/bulk-import/bulkImportPerQuestionAnswers'

export type AnswersInputMode = 'bulk' | 'per_question'

type StepAnswersProps = {
  mode: AnswersInputMode
  onModeChange: (mode: AnswersInputMode) => void
  bulkAnswersJson: Json | null
  onBulkAnswersChange: (value: Json) => void
  stems: BulkImportStemDraft[]
  perQuestionAnswers: PerQuestionAnswerDraft[]
  onPerQuestionAnswersChange: (drafts: PerQuestionAnswerDraft[]) => void
}

const RTE = { forceLightChrome: true as const, pasteTableBehavior: 'keep' as const }

function PerQuestionRow({
  row,
  draft,
  onChange,
}: {
  row: FlatQuestionRef
  draft: PerQuestionAnswerDraft
  onChange: (next: PerQuestionAnswerDraft) => void
}) {
  const questionPreview = useMemo(() => {
    const stem = row
    return stem.label
  }, [row])

  return (
    <div className="space-y-3 rounded-lg border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm font-semibold">{questionPreview}</div>
        <div className="flex items-center gap-2 text-xs">
          <Label htmlFor={`expl-scope-${row.globalIndex}`} className="text-muted-foreground">
            {draft.explanationScope === 'per_option' ? 'Per-option explanations' : 'Question explanation'}
          </Label>
          <Switch
            id={`expl-scope-${row.globalIndex}`}
            checked={draft.explanationScope === 'per_option'}
            onCheckedChange={(checked) =>
              onChange({
                ...draft,
                explanationScope: checked ? 'per_option' : 'question',
              })
            }
          />
        </div>
      </div>

      {row.isSyllogism ? (
        <div className="space-y-2">
          {Array.from({ length: row.optionCount }).map((_, optIndex) => (
            <div key={optIndex} className="flex flex-wrap items-center gap-3">
              <span className="w-8 text-xs font-medium">Stmt {optIndex + 1}</span>
              <RadioGroup
                value={draft.syllogismPattern?.charAt(optIndex) === 'Y' ? 'Y' : 'N'}
                onValueChange={(v) => {
                  const arr = (draft.syllogismPattern ?? '').split('')
                  arr[optIndex] = v
                  onChange({
                    ...draft,
                    syllogismPattern: arr
                      .join('')
                      .padEnd(row.optionCount, 'N')
                      .slice(0, row.optionCount),
                  })
                }}
                className="flex gap-3"
              >
                <div className="flex items-center gap-1">
                  <RadioGroupItem value="Y" id={`sy-${row.globalIndex}-${optIndex}-y`} />
                  <Label htmlFor={`sy-${row.globalIndex}-${optIndex}-y`} className="text-xs">
                    Yes
                  </Label>
                </div>
                <div className="flex items-center gap-1">
                  <RadioGroupItem value="N" id={`sy-${row.globalIndex}-${optIndex}-n`} />
                  <Label htmlFor={`sy-${row.globalIndex}-${optIndex}-n`} className="text-xs">
                    No
                  </Label>
                </div>
              </RadioGroup>
              {draft.explanationScope === 'per_option' ? (
                <div className="min-w-[200px] flex-1">
                  <UcatRichTextEditor
                    {...RTE}
                    {...BULK_IMPORT_RTE_PASTE}
                    value={draft.optionExplanations[optIndex] ?? null}
                    onChange={(v) => {
                      const optionExplanations = [...draft.optionExplanations]
                      optionExplanations[optIndex] = v
                      onChange({ ...draft, optionExplanations })
                    }}
                    minHeight="48px"
                    stemId={null}
                  />
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: row.optionCount }).map((_, optIndex) => (
              <label
                key={optIndex}
                className={cn(
                  'flex cursor-pointer items-center gap-1.5 rounded border px-2 py-1 text-xs',
                  draft.correctOptionIndex === optIndex && 'border-primary bg-primary/5'
                )}
              >
                <input
                  type="radio"
                  name={`correct-${row.globalIndex}`}
                  checked={draft.correctOptionIndex === optIndex}
                  onChange={() => onChange({ ...draft, correctOptionIndex: optIndex })}
                />
                {String.fromCharCode(65 + optIndex)}
              </label>
            ))}
          </div>
          {draft.explanationScope === 'per_option' ? (
            <div className="space-y-2">
              {Array.from({ length: row.optionCount }).map((_, optIndex) => (
                <div key={optIndex} className="space-y-1">
                  <Label className="text-xs text-muted-foreground">
                    Option {String.fromCharCode(65 + optIndex)} explanation
                  </Label>
                  <UcatRichTextEditor
                    {...RTE}
                    {...BULK_IMPORT_RTE_PASTE}
                    value={draft.optionExplanations[optIndex] ?? null}
                    onChange={(v) => {
                      const optionExplanations = [...draft.optionExplanations]
                      optionExplanations[optIndex] = v
                      onChange({ ...draft, optionExplanations })
                    }}
                    minHeight="48px"
                    stemId={null}
                  />
                </div>
              ))}
            </div>
          ) : null}
        </div>
      )}

      {draft.explanationScope === 'question' ? (
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Explanation</Label>
          <UcatRichTextEditor
            {...RTE}
            {...BULK_IMPORT_RTE_PASTE}
            value={draft.questionExplanation}
            onChange={(v) => onChange({ ...draft, questionExplanation: v })}
            minHeight="64px"
            stemId={null}
          />
        </div>
      ) : null}
    </div>
  )
}

export function StepAnswers({
  mode,
  onModeChange,
  bulkAnswersJson,
  onBulkAnswersChange,
  stems,
  perQuestionAnswers,
  onPerQuestionAnswersChange,
}: StepAnswersProps) {
  const flat = useMemo(() => flattenBulkImportQuestions(stems), [stems])

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <div className="flex shrink-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold">Answers</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Explanations are required for every question.
          </p>
        </div>
        <div className="flex rounded-md border p-0.5">
          <Button
            type="button"
            size="sm"
            variant={mode === 'bulk' ? 'default' : 'ghost'}
            onClick={() => onModeChange('bulk')}
          >
            Paste answers document
          </Button>
          <Button
            type="button"
            size="sm"
            variant={mode === 'per_question' ? 'default' : 'ghost'}
            onClick={() => onModeChange('per_question')}
          >
            Per question
          </Button>
        </div>
      </div>

      {mode === 'bulk' ? (
        <div className="min-h-0 flex-1">
          <Step2PasteAnswers value={bulkAnswersJson} onChange={onBulkAnswersChange} layout="default" />
        </div>
      ) : (
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
          {flat.map((row, index) => (
            <PerQuestionRow
              key={`${row.stemId}-${row.questionIndex}`}
              row={row}
              draft={
                perQuestionAnswers[index] ?? {
                  correctOptionIndex: null,
                  syllogismPattern: null,
                  explanationScope: row.isSyllogism ? 'per_option' : 'question',
                  questionExplanation: null,
                  optionExplanations: [],
                }
              }
              onChange={(next) => {
                const copies = [...perQuestionAnswers]
                copies[index] = next
                onPerQuestionAnswersChange(copies)
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}
