'use client'

import { useMemo } from 'react'
import type { Json } from '@altitutor/shared'
import {
  Button,
  Checkbox,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Label,
  SearchableSelect,
} from '@altitutor/ui'
import { Settings2 } from 'lucide-react'
import { UcatRichTextEditor } from '@/features/ucat/shared/UcatRichTextEditor'
import { cn } from '@/shared/utils'
import { BulkImportParseInfoButton } from '@/features/ucat/questions/components/bulk-import/BulkImportParseInfoButton'
import { computeQuestionPasteStats } from '@/features/ucat/questions/components/bulk-import/bulkImportPasteStats'
import type { BulkImportParseSection } from '@/features/ucat/questions/components/bulk-import/bulkImportLogicalLines'
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
  title?: string
  placeholder?: string
  onImageFileIdsChange?: (fileIds: string[]) => void
  parsingOptions?: ParsingOptions
  onParsingOptionsChange?: (options: ParsingOptions) => void
  pasteTableBehavior?: PasteTableBehavior
  onPasteTableBehaviorChange?: (behavior: PasteTableBehavior) => void
  /** When set, fills a parent flex column and scrolls only the editor region. */
  layout?: 'default' | 'split'
  /**
   * When set, the editor shows in-document parse highlights for this section.
   * (Former `liveParseSection` — the preview panel below the editor is removed.)
   */
  liveParseSection?: BulkImportParseSection | null
}

export function Step2PasteDocument({
  value,
  onChange,
  title = 'Paste questions document',
  placeholder = 'Paste your UCAT questions here…',
  onImageFileIdsChange,
  parsingOptions = DEFAULT_PARSING_OPTIONS,
  onParsingOptionsChange,
  pasteTableBehavior = 'strip_all',
  onPasteTableBehaviorChange,
  layout = 'default',
  liveParseSection = null,
}: Step2PasteDocumentProps) {
  const opts = parsingOptions
  const setOpts = onParsingOptionsChange ?? (() => {})
  const isSplit = layout === 'split'

  const classify = useMemo(
    () => ({
      questionIndicator: opts.questionIndicator,
      answerOptionIndicator: opts.answerOptionIndicator,
      questionNumberOnOwnLine: opts.questionNumberOnOwnLine,
      answerOptionOnOwnLine: opts.answerOptionOnOwnLine,
    }),
    [
      opts.answerOptionIndicator,
      opts.answerOptionOnOwnLine,
      opts.questionIndicator,
      opts.questionNumberOnOwnLine,
    ]
  )

  const ucatQHighlight = useMemo(() => {
    if (!liveParseSection) return { mode: 'off' as const }
    return {
      mode: 'question' as const,
      section: liveParseSection,
      classify,
    }
  }, [classify, liveParseSection])

  const questionPasteStats = useMemo(
    () => computeQuestionPasteStats(value, liveParseSection, classify),
    [value, liveParseSection, classify]
  )

  return (
    <div
      className={cn(isSplit ? 'flex h-full min-h-0 flex-col gap-3' : 'space-y-4')}
    >
      <div
        className="flex shrink-0 flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-3"
      >
        <div className="flex min-w-0 items-center gap-0.5">
          <h2 className="text-base font-semibold">{title}</h2>
          <BulkImportParseInfoButton
            variant="questions"
            stats={questionPasteStats}
            sectionKnown={liveParseSection != null}
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
                aria-label="Parser settings for pasted questions"
              >
                <Settings2 className="h-3.5 w-3.5" />
                Question settings
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className="w-80 max-h-[min(24rem,70vh)] max-w-[min(20rem,92vw)] overflow-y-auto p-2"
              align="end"
            >
              <DropdownMenuLabel className="px-0 text-xs">Parser</DropdownMenuLabel>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Question indicator</Label>
                  <SearchableSelect<{ value: QuestionIndicatorKind; label: string }>
                    items={QUESTION_INDICATOR_OPTIONS}
                    value={
                      QUESTION_INDICATOR_OPTIONS.find(
                        (i) => i.value === opts.questionIndicator
                      ) ?? QUESTION_INDICATOR_OPTIONS[0]
                    }
                    onValueChange={(item) =>
                      item && setOpts({ ...opts, questionIndicator: item.value })
                    }
                    getItemLabel={(i) => i.label}
                    getItemId={(i) => i.value}
                    triggerClassName="w-full"
                  />
                </div>
                <div className="space-y-1.5">
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
                    triggerClassName="w-full"
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
                  <Label
                    htmlFor="question-on-own-line"
                    className="text-xs font-normal leading-snug cursor-pointer"
                  >
                    Question number must be on its own line
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
                  <Label
                    htmlFor="option-on-own-line"
                    className="text-xs font-normal leading-snug cursor-pointer"
                  >
                    Answer option letter must be on its own line
                  </Label>
                </div>
                <DropdownMenuSeparator />
                <div className="space-y-1.5">
                  <Label className="text-xs">Table paste handling</Label>
                  <SearchableSelect<{ value: PasteTableBehavior; label: string }>
                    items={PASTE_TABLE_BEHAVIOR_OPTIONS}
                    value={
                      PASTE_TABLE_BEHAVIOR_OPTIONS.find(
                        (i) => i.value === pasteTableBehavior
                      ) ?? PASTE_TABLE_BEHAVIOR_OPTIONS[0]
                    }
                    onValueChange={(item) =>
                      item && onPasteTableBehaviorChange?.(item.value)
                    }
                    getItemLabel={(i) => i.label}
                    getItemId={(i) => i.value}
                    triggerClassName="w-full"
                  />
                </div>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div
        className={cn(
          'rounded-md border bg-muted/40 p-3',
          isSplit ? 'min-h-0 flex-1 overflow-y-auto' : 'min-h-[360px]'
        )}
      >
        <UcatRichTextEditor
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          minHeight={isSplit ? '200px' : '320px'}
          stemId={null}
          enableImages={true}
          onImageFileIdsChange={onImageFileIdsChange}
          pasteTableBehavior={pasteTableBehavior}
          ucatParseHighlight={ucatQHighlight}
        />
      </div>
    </div>
  )
}
