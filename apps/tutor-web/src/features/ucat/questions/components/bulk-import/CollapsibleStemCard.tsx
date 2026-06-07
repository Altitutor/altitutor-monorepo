'use client'

import { cn } from '@/shared/utils'

const PREVIEW_LINE_LIMIT = 4

function getStemLines(text: string): string[] {
  return text.trim().split('\n')
}

function stemNeedsExpand(text: string): boolean {
  const trimmed = text.trim()
  if (trimmed.length === 0) return false
  const lines = getStemLines(text)
  return (
    lines.length > PREVIEW_LINE_LIMIT ||
    trimmed.replace(/\s+/g, ' ').length > 160
  )
}

type CollapsibleStemCardProps = {
  index: number
  stem: string
  expanded: boolean
  onToggle: () => void
  /** Highlights the card when this stem is active in a multi-column layout. */
  selected?: boolean
  /** When set, clicking the header selects the stem; clicking the body toggles expand. */
  onSelect?: () => void
}

export function CollapsibleStemCard({
  index,
  stem,
  expanded,
  onToggle,
  selected = false,
  onSelect,
}: CollapsibleStemCardProps) {
  const trimmedStem = stem.trim()
  if (trimmedStem.length === 0) return null

  const canExpand = stemNeedsExpand(stem)
  const showExpandHint = !expanded && canExpand
  const selectable = onSelect != null

  const stemBody = (
    <div
      className={cn(
        'mt-1 whitespace-pre-wrap font-sans leading-relaxed text-foreground/90',
        !expanded && canExpand && 'line-clamp-4'
      )}
    >
      {trimmedStem}
    </div>
  )

  if (selectable) {
    return (
      <div
        className={cn(
          'w-full shrink-0 rounded-md border bg-background text-left text-xs transition-colors',
          selected && 'border-primary/50 ring-2 ring-primary/20',
          !selected && 'hover:bg-muted/50'
        )}
      >
        <button
          type="button"
          onClick={onSelect}
          className="flex w-full items-baseline justify-between gap-2 px-3 pt-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="font-medium text-muted-foreground">Stem {index + 1}</span>
          {selected ? (
            <span className="shrink-0 text-[10px] text-primary">Selected</span>
          ) : null}
        </button>
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
          className="cursor-pointer px-3 pb-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-b-md"
          aria-expanded={expanded}
        >
          {showExpandHint ? (
            <span className="mb-1 block text-[10px] text-muted-foreground">Click to expand</span>
          ) : null}
          {stemBody}
        </div>
      </div>
    )
  }

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
        'w-full shrink-0 cursor-pointer rounded-md border bg-background px-3 py-2 text-left text-xs transition-colors',
        'hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
      )}
      aria-expanded={expanded}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-medium text-muted-foreground">Stem {index + 1}</span>
        {showExpandHint ? (
          <span className="shrink-0 text-[10px] text-muted-foreground">Click to expand</span>
        ) : null}
      </div>
      {stemBody}
    </div>
  )
}
