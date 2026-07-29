'use client'

import { useMemo, useState } from 'react'
import {
  DropdownMenuCheckboxItem,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  Input,
} from '@altitutor/ui'
import { Search } from 'lucide-react'
import type { QuestionRow } from '@/features/ucat/questions/hooks/useUcatQuestionsTable'
import {
  buildFindSimilarQuestionStemFilters,
  createdAtLeewayMsFromMinutes,
  FIND_SIMILAR_CREATED_AT_LEEWAY_MINUTES,
  getAvailableFindSimilarCriteria,
  type FindSimilarCriterion,
} from '@/features/ucat/questions/lib/find-similar-question-stems'

type FindSimilarQuestionStemsSubmenuProps = {
  row: QuestionRow
  tagLabelsById?: Map<string, string>
  onApply: (filters: Record<string, unknown[]>) => void
}

export function FindSimilarQuestionStemsSubmenu({
  row,
  tagLabelsById,
  onApply,
}: FindSimilarQuestionStemsSubmenuProps) {
  const [windowMinutes, setWindowMinutes] = useState(FIND_SIMILAR_CREATED_AT_LEEWAY_MINUTES)
  const leewayMs = createdAtLeewayMsFromMinutes(windowMinutes)
  const available = useMemo(
    () => getAvailableFindSimilarCriteria(row, tagLabelsById, leewayMs),
    [row, tagLabelsById, leewayMs],
  )
  const [selected, setSelected] = useState<FindSimilarCriterion[]>(() => {
    const createdAt = available.find((option) => option.id === 'created_at')
    return createdAt ? ['created_at'] : available[0] ? [available[0].id] : []
  })

  const selectedSet = useMemo(() => new Set(selected), [selected])
  const canApply = selected.length > 0
  const showWindowControl = selectedSet.has('created_at')

  function toggleCriterion(id: FindSimilarCriterion, checked: boolean) {
    setSelected((prev) => {
      if (checked) return prev.includes(id) ? prev : [...prev, id]
      return prev.filter((item) => item !== id)
    })
  }

  function handleApply() {
    if (!canApply) return
    onApply(buildFindSimilarQuestionStemFilters(row, selected, leewayMs))
  }

  if (available.length === 0) return null

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger className="items-start">
        <Search className="mr-2 h-4 w-4 shrink-0" />
        <span>Find question stems with similar</span>
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent className="w-64">
        {available.map((option) => (
          <DropdownMenuCheckboxItem
            key={option.id}
            checked={selectedSet.has(option.id)}
            onCheckedChange={(checked) => toggleCriterion(option.id, checked === true)}
            onSelect={(event) => event.preventDefault()}
            className="items-start"
          >
            <div className="flex min-w-0 flex-col gap-0.5">
              <span>{option.label}</span>
              {option.description ? (
                <span className="truncate text-xs font-normal text-muted-foreground">
                  {option.description}
                </span>
              ) : null}
            </div>
          </DropdownMenuCheckboxItem>
        ))}
        {showWindowControl ? (
          <div
            className="flex items-center gap-2 px-2 py-1.5"
            onPointerDown={(event) => event.preventDefault()}
            onClick={(event) => event.stopPropagation()}
          >
            <label htmlFor="find-similar-created-at-window" className="shrink-0 text-xs text-muted-foreground">
              ± minutes
            </label>
            <Input
              id="find-similar-created-at-window"
              type="number"
              min={1}
              max={120}
              step={1}
              value={windowMinutes}
              onChange={(event) => {
                const next = Number(event.target.value)
                if (!Number.isFinite(next)) return
                setWindowMinutes(Math.max(1, Math.min(120, Math.round(next))))
              }}
              onKeyDown={(event) => event.stopPropagation()}
              className="h-7 w-16"
            />
          </div>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={!canApply} onClick={handleApply}>
          Apply filters
        </DropdownMenuItem>
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  )
}
