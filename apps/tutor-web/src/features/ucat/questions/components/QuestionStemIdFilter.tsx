'use client'

import React, { useEffect, useRef, useState } from 'react'
import { Input, Label } from '@altitutor/ui'
import { parseQuestionStemIdInput } from '@/features/ucat/questions/lib/question-stem-id-filter'

type QuestionStemIdFilterProps = {
  ids: string[]
  onChange: (ids: string[]) => void
}

export function QuestionStemIdFilter({ ids, onChange }: QuestionStemIdFilterProps) {
  const [draft, setDraft] = useState(() => ids.join(', '))
  const lastEmittedSignatureRef = useRef(ids.join(','))
  const idsSignature = ids.join(',')
  const parsed = parseQuestionStemIdInput(draft)

  useEffect(() => {
    if (idsSignature === lastEmittedSignatureRef.current) return
    lastEmittedSignatureRef.current = idsSignature
    setDraft(idsSignature.split(',').filter(Boolean).join(', '))
  }, [idsSignature])

  function handleChange(value: string) {
    setDraft(value)
    const next = parseQuestionStemIdInput(value).ids
    lastEmittedSignatureRef.current = next.join(',')
    onChange(next)
  }

  return (
    <div className="space-y-2 p-3">
      <Label htmlFor="question-stem-id-filter" className="text-xs">
        Question stem IDs
      </Label>
      <Input
        id="question-stem-id-filter"
        value={draft}
        onChange={(event) => handleChange(event.target.value)}
        placeholder="UUID, UUID, …"
        autoComplete="off"
        spellCheck={false}
        aria-invalid={parsed.invalidTokens.length > 0}
        aria-describedby={
          parsed.invalidTokens.length > 0
            ? 'question-stem-id-filter-help question-stem-id-filter-error'
            : 'question-stem-id-filter-help'
        }
      />
      <p id="question-stem-id-filter-help" className="text-xs text-muted-foreground">
        Enter one ID or a comma-separated list.
      </p>
      {parsed.invalidTokens.length > 0 ? (
        <p id="question-stem-id-filter-error" className="text-xs text-destructive" role="alert">
          {parsed.invalidTokens.length === 1
            ? 'One entry is not a complete UUID.'
            : `${parsed.invalidTokens.length} entries are not complete UUIDs.`}
        </p>
      ) : null}
    </div>
  )
}
