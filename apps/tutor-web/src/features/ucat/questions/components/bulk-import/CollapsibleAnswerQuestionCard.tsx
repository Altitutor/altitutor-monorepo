'use client'

import { cn } from '@/shared/utils'
import type { QuestionAnswerPreview } from '@/features/ucat/questions/components/bulk-import/bulkImportBulkAnswers'

const PREVIEW_LINE_LIMIT = 2

function questionNeedsExpand(preview: QuestionAnswerPreview): boolean {
  const trimmed = preview.questionText.trim()
  if (trimmed.length === 0) return preview.isParsed
  const lines = trimmed.split('\n').filter((line) => line.trim().length > 0)
  return (
    lines.length > PREVIEW_LINE_LIMIT ||
    trimmed.length > 100 ||
    (preview.isParsed && (preview.explanationPreview?.length ?? 0) > 80)
  )
}

type CollapsibleAnswerQuestionCardProps = {
  preview: QuestionAnswerPreview
  expanded: boolean
  onToggle: () => void
}

export function CollapsibleAnswerQuestionCard({
  preview,
  expanded,
  onToggle,
}: CollapsibleAnswerQuestionCardProps) {
  const { row, questionText, answerLetter, syllogismPattern, explanationPreview, hasExplanation, isParsed } =
    preview
  const title = `Q${row.globalIndex + 1} · Stem ${row.stemIndex + 1} Q${row.questionIndex + 1}`
  const canExpand = questionNeedsExpand(preview)
  const showExpandHint = !expanded && canExpand
  const trimmedText = questionText.trim()

  const answerLabel = isParsed
    ? answerLetter != null
      ? answerLetter
      : syllogismPattern != null
        ? syllogismPattern
        : '—'
    : null

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onToggle}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onToggle()
        }
      }}
      className={cn(
        'w-full shrink-0 cursor-pointer select-none rounded-md border bg-background px-3 py-2 text-left text-xs transition-colors',
        'hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        isParsed && !hasExplanation && 'border-amber-500/40'
      )}
      aria-expanded={expanded}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-medium text-muted-foreground">{title}</span>
            {showExpandHint ? (
              <span className="shrink-0 text-[10px] text-muted-foreground">Click to expand</span>
            ) : null}
          </div>

          {trimmedText.length > 0 ? (
            <div
              className={cn(
                'mt-1 whitespace-pre-wrap font-sans leading-relaxed text-foreground/90',
                !expanded && canExpand && 'line-clamp-2'
              )}
            >
              {trimmedText}
            </div>
          ) : (
            <p className="mt-1 text-muted-foreground italic">No question text</p>
          )}
        </div>

        <div className="shrink-0 text-right">
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Answer</p>
          {answerLabel != null ? (
            <p
              className={cn(
                'mt-0.5 text-sm font-semibold tabular-nums',
                hasExplanation ? 'text-primary' : 'text-amber-700 dark:text-amber-300'
              )}
            >
              {answerLabel}
            </p>
          ) : (
            <p className="mt-0.5 text-sm text-muted-foreground">—</p>
          )}
          {isParsed && !hasExplanation ? (
            <p className="mt-0.5 text-[10px] text-amber-700 dark:text-amber-300">No explanation</p>
          ) : null}
        </div>
      </div>

      {expanded && isParsed && explanationPreview ? (
        <p className="mt-2 border-t border-border/60 pt-2 leading-relaxed text-foreground/90">
          {explanationPreview}
        </p>
      ) : null}
      {expanded && isParsed && !explanationPreview ? (
        <p className="mt-2 border-t border-border/60 pt-2 text-muted-foreground italic">
          No explanation text detected
        </p>
      ) : null}
    </div>
  )
}
