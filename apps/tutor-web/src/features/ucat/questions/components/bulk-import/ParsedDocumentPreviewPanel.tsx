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
    <div className="flex min-h-0 min-w-0 flex-col gap-2">
      <Label className="text-xs font-medium text-muted-foreground lg:sr-only">
        Parsed preview
      </Label>
      {parsedStems.length === 0 ? (
        <p className="text-sm text-muted-foreground">No stems detected yet.</p>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-1">
          {parsedStems.map((stem, stemIndex) => (
            <div key={stemIndex} className="flex flex-col gap-2">
              <CollapsibleStemCard
                index={stemIndex}
                stem={stem.stemText}
                expanded={expandedStemIndices.has(stemIndex)}
                onToggle={() => toggleStemExpanded(stemIndex)}
              />
              {stem.questions.length === 0 ? (
                <p className="pl-1 text-xs text-muted-foreground">No questions in this stem.</p>
              ) : (
                <div className="flex flex-col gap-2 pl-1">
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
      )}
    </div>
  )
}
