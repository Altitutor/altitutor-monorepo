'use client'

import { Button, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@altitutor/ui'

type BulkImportQuestionNavigatorProps = {
  count: number
  activeIndex: number
  onSelectIndex: (index: number) => void
  onPrevious: () => void
  onNext: () => void
}

export function BulkImportQuestionNavigator({
  count,
  activeIndex,
  onSelectIndex,
  onPrevious,
  onNext,
}: BulkImportQuestionNavigatorProps) {
  if (count === 0) {
    return null
  }

  const current = activeIndex + 1

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium">
          Question {current} of {count}
        </span>
        <Select
          value={String(current)}
          onValueChange={(value) => {
            const index = Number(value) - 1
            if (!Number.isNaN(index)) onSelectIndex(index)
          }}
        >
          <SelectTrigger className="h-8 w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Array.from({ length: count }).map((_, idx) => (
              <SelectItem key={idx + 1} value={String(idx + 1)}>
                Question {idx + 1}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onPrevious}
          disabled={activeIndex === 0}
        >
          Previous
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onNext}
          disabled={activeIndex >= count - 1}
        >
          Next
        </Button>
      </div>
    </div>
  )
}

