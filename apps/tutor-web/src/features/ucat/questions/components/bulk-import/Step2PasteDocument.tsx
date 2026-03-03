'use client'

import type { Json } from '@altitutor/shared'
import {
  Checkbox,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@altitutor/ui'
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
          <Select
            value={opts.questionIndicator}
            onValueChange={(v) =>
              setOpts({ ...opts, questionIndicator: v as QuestionIndicatorKind })
            }
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="dot">1. 2. 3.</SelectItem>
              <SelectItem value="paren">1) 2) 3)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="text-xs">Answer option indicator</Label>
          <Select
            value={opts.answerOptionIndicator}
            onValueChange={(v) =>
              setOpts({ ...opts, answerOptionIndicator: v as AnswerOptionIndicatorKind })
            }
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="paren">a) b) c)</SelectItem>
              <SelectItem value="dot">a. b. c.</SelectItem>
            </SelectContent>
          </Select>
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
          <Select
            value={pasteTableBehavior}
            onValueChange={(v) => onPasteTableBehaviorChange?.(v as PasteTableBehavior)}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="strip_all">Strip all tables</SelectItem>
              <SelectItem value="strip_outside">Strip outside tables only</SelectItem>
              <SelectItem value="keep">Keep formatting</SelectItem>
            </SelectContent>
          </Select>
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

