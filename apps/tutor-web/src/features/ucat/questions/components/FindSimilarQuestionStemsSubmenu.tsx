'use client'

import { useMemo, useState } from 'react'
import {
  DropdownMenuCheckboxItem,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from '@altitutor/ui'
import { Search } from 'lucide-react'
import type { QuestionRow } from '@/features/ucat/questions/hooks/useUcatQuestionsTable'
import {
  buildFindSimilarQuestionStemFilters,
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
  const available = useMemo(
    () => getAvailableFindSimilarCriteria(row, tagLabelsById),
    [row, tagLabelsById],
  )
  const [selected, setSelected] = useState<FindSimilarCriterion[]>(() =>
    available.map((option) => option.id),
  )

  const selectedSet = useMemo(() => new Set(selected), [selected])
  const canApply = selected.length > 0

  function toggleCriterion(id: FindSimilarCriterion, checked: boolean) {
    setSelected((prev) => {
      if (checked) return prev.includes(id) ? prev : [...prev, id]
      return prev.filter((item) => item !== id)
    })
  }

  function handleApply() {
    if (!canApply) return
    onApply(buildFindSimilarQuestionStemFilters(row, selected))
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
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={!canApply} onClick={handleApply}>
          Apply filters
        </DropdownMenuItem>
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  )
}
