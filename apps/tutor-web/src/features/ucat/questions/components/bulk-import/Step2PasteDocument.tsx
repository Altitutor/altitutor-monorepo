'use client'

import type { Json } from '@altitutor/shared'
import { Checkbox, Label, SearchableSelect } from '@altitutor/ui'
import { UcatRichTextEditor } from '@/features/ucat/shared/UcatRichTextEditor'
import type {
  AnswerOptionIndicatorKind,
  QuestionIndicatorKind,
} from '@/features/ucat/questions/lib/parsers/core'

export type PasteTableBehavior = 'strip_all' | 'strip_outside' | 'keep'

export type ParsingOptions = {
  questionIndicator: QuestionIndicatorKind
  answerOptionIndicator: AnswerOptionIndicatorKind
  questionNumberOnOwnLine: boolean
  answerOptionOnOwnLine: boolean
}

const DEFAULT_PARSING_OPTIONS: ParsingOptions = {
  questionIndicator: 'dot',
  answerOptionIndicator: 'paren',
  questionNumberOnOwnLine: false,
  answerOptionOnOwnLine: false,
}

const QUESTION_INDICATOR_OPTIONS: { value: QuestionIndicatorKind; label: string }[] = [
  { value: 'dot', label: '1. 2. 3.' },
  { value: 'paren', label: '1) 2) 3)' },
]

const ANSWER_OPTION_INDICATOR_OPTIONS: { value: AnswerOptionIndicatorKind; label: string }[] = [
  { value: 'paren', label: 'a) b) c)' },
  { value: 'dot', label: 'a. b. c.' },
]

const PASTE_TABLE_BEHAVIOR_OPTIONS: { value: PasteTableBehavior; label: string }[] = [
  { value: 'strip_all', label: 'Strip all tables' },
  { value: 'strip_outside', label: 'Strip outside tables only' },
  { value: 'keep', label: 'Keep formatting' },
]

type Step2PasteDocumentProps = {
  value: Json | null
  onChange: (value: Json) => void
  onImageFileIdsChange?: (fileIds: string[]) => void
  parsingOptions?: ParsingOptions
  onParsingOptionsChange?: (options: ParsingOptions) => void
  pasteTableBehavior?: PasteTableBehavior
  onPasteTableBehaviorChange?: (behavior: PasteTableBehavior) => void
}

export function Step2PasteDocument({
  value,
  onChange,
  onImageFileIdsChange,
  parsingOptions = DEFAULT_PARSING_OPTIONS,
  onParsingOptionsChange,
  pasteTableBehavior = 'strip_all',
  onPasteTableBehaviorChange,
}: Step2PasteDocumentProps) {
  const opts = parsingOptions
  const setOpts = onParsingOptionsChange ?? (() => {})

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold">Paste questions document</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Paste or type the UCAT questions you want to import.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-6 rounded-md border bg-muted/40 p-3">
        <div className="space-y-2">
          <Label className="text-xs">Question indicator</Label>
          <SearchableSelect<{ value: QuestionIndicatorKind; label: string }>
            items={QUESTION_INDICATOR_OPTIONS}
            value={
              QUESTION_INDICATOR_OPTIONS.find((i) => i.value === opts.questionIndicator) ??
              QUESTION_INDICATOR_OPTIONS[0]
            }
            onValueChange={(item) =>
              item && setOpts({ ...opts, questionIndicator: item.value })
            }
            getItemLabel={(i) => i.label}
            getItemId={(i) => i.value}
            triggerClassName="w-[140px]"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-xs">Answer option indicator</Label>
          <SearchableSelect<{ value: AnswerOptionIndicatorKind; label: string }>
            items={ANSWER_OPTION_INDICATOR_OPTIONS}
            value={
              ANSWER_OPTION_INDICATOR_OPTIONS.find(
                (i) => i.value === opts.answerOptionIndicator
              ) ?? ANSWER_OPTION_INDICATOR_OPTIONS[0]
            }
            onValueChange={(item) =>
              item && setOpts({ ...opts, answerOptionIndicator: item.value })
            }
            getItemLabel={(i) => i.label}
            getItemId={(i) => i.value}
            triggerClassName="w-[140px]"
          />
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            id="question-on-own-line"
            checked={opts.questionNumberOnOwnLine}
            onCheckedChange={(checked) =>
              setOpts({ ...opts, questionNumberOnOwnLine: checked === true })
            }
          />
          <Label htmlFor="question-on-own-line" className="text-xs font-normal cursor-pointer">
            Question number must be on own line
          </Label>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            id="option-on-own-line"
            checked={opts.answerOptionOnOwnLine}
            onCheckedChange={(checked) =>
              setOpts({ ...opts, answerOptionOnOwnLine: checked === true })
            }
          />
          <Label htmlFor="option-on-own-line" className="text-xs font-normal cursor-pointer">
            Answer option letter must be on own line
          </Label>
        </div>
        <div className="space-y-2">
          <Label className="text-xs">Paste table handling</Label>
          <SearchableSelect<{ value: PasteTableBehavior; label: string }>
            items={PASTE_TABLE_BEHAVIOR_OPTIONS}
            value={
              PASTE_TABLE_BEHAVIOR_OPTIONS.find((i) => i.value === pasteTableBehavior) ??
              PASTE_TABLE_BEHAVIOR_OPTIONS[0]
            }
            onValueChange={(item) => item && onPasteTableBehaviorChange?.(item.value)}
            getItemLabel={(i) => i.label}
            getItemId={(i) => i.value}
            triggerClassName="w-[180px]"
          />
        </div>
      </div>

      <div className="rounded-md border bg-muted/40 p-3 min-h-[360px]">
        <UcatRichTextEditor
          value={value}
          onChange={onChange}
          placeholder="Paste your UCAT questions here…"
          minHeight="320px"
          stemId={null}
          enableImages={true}
          onImageFileIdsChange={onImageFileIdsChange}
          pasteTableBehavior={pasteTableBehavior}
        />
      </div>
    </div>
  )
}

