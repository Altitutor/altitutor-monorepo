'use client'

import { useCallback, useMemo, useState } from 'react'
import type { Json } from '@altitutor/shared'
import { Label } from '@altitutor/ui'
import { CollapsibleParsedQuestionCard } from '@/features/ucat/questions/components/bulk-import/CollapsibleParsedQuestionCard'
import { CollapsibleStemCard } from '@/features/ucat/questions/components/bulk-import/CollapsibleStemCard'
import type { BulkImportParseSection } from '@/features/ucat/questions/components/bulk-import/bulkImportLogicalLines'
import { parseCombinedDocumentForSection } from '@/features/ucat/questions/components/bulk-import/bulkImportParseSection'
import type { ParsingOptions } from '@/features/ucat/questions/components/bulk-import/Step2PasteDocument'

type ParsedDocumentPreviewPanelProps = {
  value: Json | null
  section: BulkImportParseSection
  parsingOptions: ParsingOptions
}

export function ParsedDocumentPreviewPanel({
  value,
  section,
  parsingOptions,
}: ParsedDocumentPreviewPanelProps) {
  const [expandedStemIndices, setExpandedStemIndices] = useState<Set<number>>(() => new Set())
  const [expandedQuestionKeys, setExpandedQuestionKeys] = useState<Set<string>>(() => new Set())

  const parsedStems = useMemo(
    () => parseCombinedDocumentForSection(value, section, parsingOptions),
    [value, section, parsingOptions]
  )

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

  const totalQuestions = parsedStems.reduce((acc, stem) => acc + stem.questions.length, 0)

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col gap-2 overflow-hidden">
      <Label className="shrink-0 text-xs font-medium text-muted-foreground lg:sr-only">
        Parsed preview
      </Label>
      {parsedStems.length === 0 ? (
        <p className="text-sm text-muted-foreground">No stems detected yet.</p>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          <div className="flex flex-col gap-3">
          {parsedStems.map((stem, stemIndex) => (
            <div key={stemIndex} className="flex flex-col gap-2">
              <CollapsibleStemCard
                index={stemIndex}
                stem={stem.stemText}
                expanded={expandedStemIndices.has(stemIndex)}
                onToggle={() => toggleStemExpanded(stemIndex)}
              />
              {stem.questions.length === 0 ? (
                <p className="ml-4 border-l border-border pl-3 text-xs text-muted-foreground">
                  No questions in this stem.
                </p>
              ) : (
                <div className="ml-4 flex flex-col gap-2 border-l border-border pl-3">
                  {stem.questions.map((question, questionIndex) => {
                    const key = `${stemIndex}:${questionIndex}`
                    return (
                      <CollapsibleParsedQuestionCard
                        key={key}
                        question={question}
                        index={questionIndex}
                        expanded={expandedQuestionKeys.has(key)}
                        onToggle={() => toggleQuestionExpanded(stemIndex, questionIndex)}
                      />
                    )
                  })}
                </div>
              )}
            </div>
          ))}
          {totalQuestions === 0 && parsedStems.length > 0 ? (
            <p className="text-xs text-muted-foreground">
              Stems found but no questions yet. Check your question settings.
            </p>
          ) : null}
          </div>
        </div>
      )}
    </div>
  )
}
