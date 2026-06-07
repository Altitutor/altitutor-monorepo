'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import type { Json } from '@altitutor/shared'
import { Label } from '@altitutor/ui'
import { cn } from '@/shared/utils'
import { UcatRichTextEditor } from '@/features/ucat/shared/UcatRichTextEditor'
import type { BulkImportParseSection } from '@/features/ucat/questions/components/bulk-import/bulkImportLogicalLines'
import { CollapsibleParsedQuestionCard } from '@/features/ucat/questions/components/bulk-import/CollapsibleParsedQuestionCard'
import { CollapsibleStemCard } from '@/features/ucat/questions/components/bulk-import/CollapsibleStemCard'
import {
  Step2PasteDocument,
  parsingOptionsToClassify,
  type ParsingOptions,
  type PasteTableBehavior,
} from '@/features/ucat/questions/components/bulk-import/Step2PasteDocument'
import { BULK_IMPORT_RTE_PASTE } from '@/features/ucat/questions/components/bulk-import/bulkImportRichTextDefaults'
import { parseQuestionsOnlyForSection } from '@/features/ucat/questions/components/bulk-import/bulkImportParseSection'

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

function PerStemQuestionRow({
  index,
  stemText,
  value,
  onChange,
  section,
  parsingOptions,
  pasteTableBehavior,
  onImageFileIdsChange,
  stemExpanded,
  onStemToggle,
  expandedQuestionKeys,
  onQuestionToggle,
}: {
  index: number
  stemText: string
  value: Json | null
  onChange: (value: Json) => void
  section: BulkImportParseSection
  parsingOptions: ParsingOptions
  pasteTableBehavior: PasteTableBehavior
  onImageFileIdsChange?: (fileIds: string[]) => void
  stemExpanded: boolean
  onStemToggle: () => void
  expandedQuestionKeys: Set<string>
  onQuestionToggle: (questionIndex: number) => void
}) {
  const classify = useMemo(() => parsingOptionsToClassify(parsingOptions), [parsingOptions])

  const parseState = useMemo(
    () => parseQuestionsOnlyForSection(value, section, parsingOptions),
    [value, section, parsingOptions]
  )

  const ucatParseHighlight = useMemo(
    () => ({
      mode: 'question' as const,
      section,
      classify,
      questionsOnly: true as const,
    }),
    [section, classify]
  )

  const pasteAreaRef = useRef<HTMLDivElement>(null)
  const [pasteFocused, setPasteFocused] = useState(false)

  const handlePasteFocusIn = useCallback(() => {
    setPasteFocused(true)
  }, [])

  const handlePasteFocusOut = useCallback(() => {
    window.requestAnimationFrame(() => {
      const active = document.activeElement
      if (active instanceof Node && pasteAreaRef.current?.contains(active)) return
      setPasteFocused(false)
    })
  }, [])

  return (
    <div className="grid gap-3 border-b border-border/60 pb-6 last:border-b-0 lg:grid-cols-3">
      <div className="min-w-0">
        <CollapsibleStemCard
          index={index}
          stem={stemText}
          expanded={stemExpanded}
          onToggle={onStemToggle}
        />
      </div>

      <div className="flex min-w-0 flex-col gap-2">
        <Label className="text-xs font-medium text-muted-foreground lg:sr-only">
          Paste questions · Stem {index + 1}
        </Label>
        <div
          ref={pasteAreaRef}
          onFocusCapture={handlePasteFocusIn}
          onBlurCapture={handlePasteFocusOut}
          className={cn(
            'rounded-md border bg-muted/40 transition-[padding]',
            pasteFocused
              ? 'p-3 [&_.ProseMirror]:min-h-[8rem]'
              : 'cursor-text px-3 py-2 [&_.ProseMirror]:max-h-[6.5rem] [&_.ProseMirror]:min-h-[6.5rem] [&_.ProseMirror]:overflow-hidden'
          )}
        >
          <UcatRichTextEditor
            value={value}
            onChange={onChange}
            placeholder="Paste questions and answer options for this stem…"
            minHeight={pasteFocused ? '8rem' : '6.5rem'}
            stemId={null}
            enableImages
            onImageFileIdsChange={onImageFileIdsChange}
            pasteTableBehavior={pasteTableBehavior}
            {...BULK_IMPORT_RTE_PASTE}
            ucatParseHighlight={ucatParseHighlight}
          />
        </div>
      </div>

      <div className="flex min-w-0 flex-col gap-2">
        <Label className="text-xs font-medium text-muted-foreground lg:sr-only">
          Parsed questions · Stem {index + 1}
        </Label>
        {parseState.questions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No questions detected yet.</p>
        ) : (
          <div className="flex w-full flex-col gap-2">
            {parseState.questions.map((question, questionIndex) => {
              const key = `${index}:${questionIndex}`
              return (
                <CollapsibleParsedQuestionCard
                  key={key}
                  question={question}
                  index={questionIndex}
                  expanded={expandedQuestionKeys.has(key)}
                  onToggle={() => onQuestionToggle(questionIndex)}
                />
              )
            })}
          </div>
        )}
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
  const [expandedStemIndices, setExpandedStemIndices] = useState<Set<number>>(() => new Set())
  const [expandedQuestionKeys, setExpandedQuestionKeys] = useState<Set<string>>(() => new Set())

  const toggleStemExpanded = useCallback((index: number) => {
    setExpandedStemIndices((prev) => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }, [])

  const toggleQuestionExpanded = useCallback((stemIndex: number, questionIndex: number) => {
    const key = `${stemIndex}:${questionIndex}`
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
        <h2 className="text-base font-semibold">Paste questions per stem</h2>
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
          settingsOnlyActionsOnly
        />
      </div>

      <div className="grid shrink-0 gap-3 border-b border-border pb-2 lg:grid-cols-3">
        <Label className="text-xs font-medium text-muted-foreground">Stem preview</Label>
        <Label className="text-xs font-medium text-muted-foreground">Paste questions</Label>
        <Label className="text-xs font-medium text-muted-foreground">Parsed questions</Label>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        {stemTexts.length === 0 ? (
          <p className="text-sm text-muted-foreground">No stems available.</p>
        ) : (
          <div className="flex flex-col gap-6">
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
                stemExpanded={expandedStemIndices.has(index)}
                onStemToggle={() => toggleStemExpanded(index)}
                expandedQuestionKeys={expandedQuestionKeys}
                onQuestionToggle={(questionIndex) => toggleQuestionExpanded(index, questionIndex)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
