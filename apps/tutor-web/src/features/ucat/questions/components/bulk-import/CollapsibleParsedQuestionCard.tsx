'use client'

import { cn } from '@/shared/utils'
import type { ParsedOption, ParsedQuestion } from '@/features/ucat/questions/lib/parsers/core'

const PREVIEW_LINE_LIMIT = 2

function questionNeedsExpand(question: ParsedQuestion): boolean {
  const trimmed = question.text.trim()
  if (trimmed.length === 0) return question.options.length > 0
  const lines = trimmed.split('\n').filter((line) => line.trim().length > 0)
  return lines.length > PREVIEW_LINE_LIMIT || trimmed.length > 100 || question.options.length > 0
}

function formatOptionLabel(label: string): string {
  const trimmed = label.trim()
  if (trimmed.length === 0) return '?'
  return trimmed.toUpperCase()
}

type CollapsibleParsedQuestionCardProps = {
  question: ParsedQuestion
  /** Question index within the stem (0-based). */
  index: number
  /** Question index across the whole bulk import run (0-based). */
  globalIndex?: number
  expanded: boolean
  onToggle: () => void
}

export function CollapsibleParsedQuestionCard({
  question,
  index,
  globalIndex,
  expanded,
  onToggle,
}: CollapsibleParsedQuestionCardProps) {
  const trimmedText = question.text.trim()
  const title =
    globalIndex != null
      ? `Question ${index + 1} · Q${globalIndex + 1}`
      : `Question ${index + 1}`
  const canExpand = questionNeedsExpand(question)
  const showExpandHint = !expanded && canExpand

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
        'hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
      )}
      aria-expanded={expanded}
    >
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
      {expanded && question.options.length > 0 ? (
        <ul className="mt-2 space-y-1.5 border-t border-border/60 pt-2">
          {question.options.map((option: ParsedOption) => (
            <li key={`${option.label}-${option.text}`} className="leading-relaxed text-foreground/90">
              <span className="font-medium text-muted-foreground">
                {formatOptionLabel(option.label)})
              </span>{' '}
              {option.text.trim() || <span className="italic text-muted-foreground">Empty option</span>}
            </li>
          ))}
        </ul>
      ) : null}
      {expanded && question.options.length === 0 ? (
        <p className="mt-2 border-t border-border/60 pt-2 text-muted-foreground italic">
          No answer options detected
        </p>
      ) : null}
    </div>
  )
}
