'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import type { Json } from '@altitutor/shared'
import { Label, SegmentedControl } from '@altitutor/ui'
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
import {
  detectAlternativeParsingIndicators,
  formatAlternativeParsingIndicatorHint,
} from '@/features/ucat/questions/components/bulk-import/bulkImportParsingIndicatorHints'
import { collectLogicalLinesFromDoc } from '@/features/ucat/questions/lib/parsers/core'
import {
  splitStemDocumentFromDoc,
  type SplitQuestionDocumentResult,
  type StemSplitOptions,
} from '@/features/ucat/questions/lib/parsers/splitStemDocument'
import {
  proseMirrorHasOuterTable,
  stripOuterTablesFromProseMirrorDoc,
} from '@/features/ucat/shared/lib/rich-text'

export type PerStemQuestionPasteMode = 'separate' | 'single_document'

const QUESTION_PASTE_MODE_OPTIONS: {
  value: PerStemQuestionPasteMode
  label: string
}[] = [
  { value: 'separate', label: 'Paste into each stem' },
  { value: 'single_document', label: 'Paste one document' },
]

type StepPerStemQuestionsProps = {
  stemTexts: string[]
  perStemDocs: Array<Json | null>
  onPerStemDocChange: (index: number, value: Json) => void
  section: BulkImportParseSection
  parsingOptions: ParsingOptions
  onParsingOptionsChange: (options: ParsingOptions) => void
  pasteTableBehavior: PasteTableBehavior
  onPasteTableBehaviorChange: (behavior: PasteTableBehavior) => void
  pasteMode: PerStemQuestionPasteMode
  onPasteModeChange: (mode: PerStemQuestionPasteMode) => void
  singleDocument: Json | null
  onSingleDocumentChange: (value: Json) => void
  singleDocumentSplit: SplitQuestionDocumentResult
  questionSplitOptions: StemSplitOptions
  onQuestionSplitOptionsChange: (options: StemSplitOptions) => void
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
  globalQuestionOffset,
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
  globalQuestionOffset: number
}) {
  const classify = useMemo(() => parsingOptionsToClassify(parsingOptions), [parsingOptions])

  const parseState = useMemo(
    () => parseQuestionsOnlyForSection(value, section, parsingOptions),
    [value, section, parsingOptions]
  )

  const indicatorHint = useMemo(() => {
    if (parseState.questions.length > 0) return null
    const lines = collectLogicalLinesFromDoc(value, {
      detectNestedQuestionTables: section !== 'quantitative_reasoning',
    })
    const hints = detectAlternativeParsingIndicators(lines, parsingOptions)
    return formatAlternativeParsingIndicatorHint(hints)
  }, [parseState.questions.length, value, section, parsingOptions])

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
          indicatorHint ? (
            <p className="text-sm text-amber-700 dark:text-amber-400">{indicatorHint}</p>
          ) : (
            <p className="text-sm text-muted-foreground">No questions detected yet.</p>
          )
        ) : (
          <div className="flex w-full flex-col gap-2">
            {parseState.questions.map((question, questionIndex) => {
              const key = `${index}:${questionIndex}`
              return (
                <CollapsibleParsedQuestionCard
                  key={key}
                  question={question}
                  index={questionIndex}
                  globalIndex={globalQuestionOffset + questionIndex}
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

function SingleDocumentQuestionGroupPreview({
  index,
  stemText,
  value,
  section,
  parsingOptions,
  stemExpanded,
  onStemToggle,
  expandedQuestionKeys,
  onQuestionToggle,
  globalQuestionOffset,
}: {
  index: number
  stemText: string
  value: Json | null
  section: BulkImportParseSection
  parsingOptions: ParsingOptions
  stemExpanded: boolean
  onStemToggle: () => void
  expandedQuestionKeys: Set<string>
  onQuestionToggle: (questionIndex: number) => void
  globalQuestionOffset: number
}) {
  const parseState = useMemo(
    () => parseQuestionsOnlyForSection(value, section, parsingOptions),
    [value, section, parsingOptions]
  )

  const indicatorHint = useMemo(() => {
    if (parseState.questions.length > 0) return null
    const lines = collectLogicalLinesFromDoc(value, {
      detectNestedQuestionTables: section !== 'quantitative_reasoning',
    })
    return formatAlternativeParsingIndicatorHint(
      detectAlternativeParsingIndicators(lines, parsingOptions)
    )
  }, [parseState.questions.length, value, section, parsingOptions])

  return (
    <div className="space-y-3 border-b border-border/60 pb-5 last:border-b-0">
      <CollapsibleStemCard
        index={index}
        stem={stemText}
        expanded={stemExpanded}
        onToggle={onStemToggle}
      />
      {parseState.questions.length === 0 ? (
        indicatorHint ? (
          <p className="ml-4 border-l border-border pl-3 text-sm text-amber-700 dark:text-amber-400">
            {indicatorHint}
          </p>
        ) : (
          <p className="ml-4 border-l border-border pl-3 text-sm text-muted-foreground">
            No questions detected for this stem.
          </p>
        )
      ) : (
        <div className="ml-4 flex flex-col gap-2 border-l border-border pl-3">
          {parseState.questions.map((question, questionIndex) => {
            const key = `${index}:${questionIndex}`
            return (
              <CollapsibleParsedQuestionCard
                key={key}
                question={question}
                index={questionIndex}
                globalIndex={globalQuestionOffset + questionIndex}
                expanded={expandedQuestionKeys.has(key)}
                onToggle={() => onQuestionToggle(questionIndex)}
              />
            )
          })}
        </div>
      )}
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
  pasteMode,
  onPasteModeChange,
  singleDocument,
  onSingleDocumentChange,
  singleDocumentSplit,
  questionSplitOptions,
  onQuestionSplitOptionsChange,
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

  const displayedQuestionDocs =
    pasteMode === 'single_document' ? singleDocumentSplit.documents : perStemDocs

  const singleDocumentHighlightSplit = useMemo(
    () => splitStemDocumentFromDoc(singleDocument, questionSplitOptions),
    [singleDocument, questionSplitOptions]
  )
  const singleDocumentClassify = useMemo(
    () => parsingOptionsToClassify(parsingOptions),
    [parsingOptions]
  )
  const singleDocumentHighlight = useMemo(
    () => ({
      mode: 'question_groups' as const,
      section,
      classify: singleDocumentClassify,
      questionsOnly: true as const,
      splitLineIndices: singleDocumentHighlightSplit.splitLineIndices,
      discardedLineIndices: singleDocumentHighlightSplit.discardedLineIndices,
      discardedLineSpans: singleDocumentHighlightSplit.discardedLineSpans,
    }),
    [section, singleDocumentClassify, singleDocumentHighlightSplit]
  )

  const globalQuestionOffsets = useMemo(() => {
    let offset = 0
    return stemTexts.map((_, stemIndex) => {
      const start = offset
      const questions = parseQuestionsOnlyForSection(
        displayedQuestionDocs[stemIndex] ?? null,
        section,
        parsingOptions
      ).questions
      offset += questions.length
      return start
    })
  }, [stemTexts, displayedQuestionDocs, section, parsingOptions])

  const canStripOuterTables = useMemo(
    () =>
      pasteMode === 'single_document'
        ? proseMirrorHasOuterTable(singleDocument)
        : perStemDocs.some((doc) => proseMirrorHasOuterTable(doc)),
    [pasteMode, perStemDocs, singleDocument]
  )

  const handleStripOuterTables = useCallback(() => {
    if (pasteMode === 'single_document') {
      const next = stripOuterTablesFromProseMirrorDoc(singleDocument)
      if (next) onSingleDocumentChange(next)
      return
    }
    perStemDocs.forEach((doc, index) => {
      if (!proseMirrorHasOuterTable(doc)) return
      const next = stripOuterTablesFromProseMirrorDoc(doc)
      if (next) onPerStemDocChange(index, next)
    })
  }, [onPerStemDocChange, onSingleDocumentChange, pasteMode, perStemDocs, singleDocument])

  const hasGroupCountMismatch =
    pasteMode === 'single_document' &&
    singleDocumentSplit.documents.length > 0 &&
    singleDocumentSplit.documents.length !== stemTexts.length

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <h2 className="text-base font-semibold">Paste questions per stem</h2>
          <SegmentedControl
            value={pasteMode}
            onValueChange={onPasteModeChange}
            options={QUESTION_PASTE_MODE_OPTIONS}
            size="sm"
            aria-label="Question paste mode"
          />
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          <Step2PasteDocument
            title="Question parsing options"
            placeholder=""
            value={null}
            onChange={() => undefined}
            parsingOptions={parsingOptions}
            onParsingOptionsChange={onParsingOptionsChange}
            pasteTableBehavior={pasteTableBehavior}
            onPasteTableBehaviorChange={onPasteTableBehaviorChange}
            onStripOuterTables={handleStripOuterTables}
            canStripOuterTables={canStripOuterTables}
            questionSplitOptions={
              pasteMode === 'single_document' ? questionSplitOptions : undefined
            }
            onQuestionSplitOptionsChange={
              pasteMode === 'single_document' ? onQuestionSplitOptionsChange : undefined
            }
            settingsOnly
            settingsOnlyActionsOnly
          />
        </div>
      </div>

      {pasteMode === 'single_document' ? (
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden md:flex-row md:gap-0">
          <div className="flex min-h-0 min-w-0 flex-1 flex-col md:pr-4">
            <Label className="mb-2 shrink-0 text-xs font-medium text-muted-foreground">
              Questions document
            </Label>
            <div className="min-h-0 flex-1 overflow-y-auto rounded-md border bg-muted/40 p-3 [&_.ProseMirror]:min-h-[12rem]">
              <UcatRichTextEditor
                value={singleDocument}
                onChange={onSingleDocumentChange}
                placeholder="Paste all questions here…"
                minHeight="12rem"
                stemId={null}
                enableImages
                onImageFileIdsChange={onImageFileIdsChange}
                pasteTableBehavior={pasteTableBehavior}
                {...BULK_IMPORT_RTE_PASTE}
                ucatParseHighlight={singleDocumentHighlight}
              />
            </div>
          </div>

          <div className="hidden shrink-0 self-stretch md:block md:w-px md:bg-border" aria-hidden />

          <div className="flex min-h-0 min-w-0 flex-1 flex-col md:pl-4">
            <div className="mb-2 flex shrink-0 items-baseline justify-between gap-2">
              <Label className="text-xs font-medium text-muted-foreground">
                Detected question groups
              </Label>
              <span className="text-xs text-muted-foreground">
                {singleDocumentSplit.documents.length} group
                {singleDocumentSplit.documents.length === 1 ? '' : 's'}
              </span>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto pr-1">
              {hasGroupCountMismatch ? (
                <p className="mb-2 text-xs text-amber-700 dark:text-amber-400">
                  Detected {singleDocumentSplit.documents.length} question groups for{' '}
                  {stemTexts.length} stems. Adjust the question split settings or pasted labels.
                </p>
              ) : null}
              {singleDocumentSplit.warnings.map((warning) => (
                <p key={warning} className="mb-2 text-xs text-amber-700 dark:text-amber-400">
                  {warning}
                </p>
              ))}
              {stemTexts.length === 0 ? (
                <p className="text-sm text-muted-foreground">No stems available.</p>
              ) : (
                <div className="flex flex-col gap-5">
                  {stemTexts.map((stemText, index) => (
                    <SingleDocumentQuestionGroupPreview
                      key={index}
                      index={index}
                      stemText={stemText}
                      value={displayedQuestionDocs[index] ?? null}
                      section={section}
                      parsingOptions={parsingOptions}
                      stemExpanded={expandedStemIndices.has(index)}
                      onStemToggle={() => toggleStemExpanded(index)}
                      expandedQuestionKeys={expandedQuestionKeys}
                      onQuestionToggle={(questionIndex) =>
                        toggleQuestionExpanded(index, questionIndex)
                      }
                      globalQuestionOffset={globalQuestionOffsets[index] ?? 0}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <>
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
                    value={displayedQuestionDocs[index] ?? null}
                    onChange={(doc) => onPerStemDocChange(index, doc)}
                    section={section}
                    parsingOptions={parsingOptions}
                    pasteTableBehavior={pasteTableBehavior}
                    onImageFileIdsChange={onImageFileIdsChange}
                    stemExpanded={expandedStemIndices.has(index)}
                    onStemToggle={() => toggleStemExpanded(index)}
                    expandedQuestionKeys={expandedQuestionKeys}
                    onQuestionToggle={(questionIndex) =>
                      toggleQuestionExpanded(index, questionIndex)
                    }
                    globalQuestionOffset={globalQuestionOffsets[index] ?? 0}
                  />
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
