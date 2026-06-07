'use client'

import { cn } from '@/shared/utils'

export type BulkImportParseLegendVariant = 'stem_split' | 'questions' | 'answers'

export function ParseLegendSwatch({ className }: { className: string }) {
  return (
    <span
      className={cn(
        'inline-block h-2.5 min-w-[1.25rem] shrink-0 rounded-sm ring-1 ring-border/60',
        className
      )}
      aria-hidden
    />
  )
}

function StemSplitLineSwatch() {
  return (
    <span
      className="inline-block h-0 w-6 shrink-0 border-0 border-t-2 border-purple-500/55 dark:border-purple-400/55"
      aria-hidden
    />
  )
}

type ParseLegendListProps = {
  variant: BulkImportParseLegendVariant
  /** Answers legend only — explanations are always imported in bulk import. */
  includeExplanationsOnImport?: boolean
}

export function ParseLegendList({
  variant,
  includeExplanationsOnImport = true,
}: ParseLegendListProps) {
  const explClass = includeExplanationsOnImport ? 'ucat-parse-hl-a-expl' : 'ucat-parse-hl-a-expl-muted'

  if (variant === 'stem_split') {
    return (
      <ul className="space-y-1.5">
        <li className="flex items-center gap-2">
          <StemSplitLineSwatch />
          <span>Where the next stem begins</span>
        </li>
        <li className="flex items-center gap-2">
          <ParseLegendSwatch className="ucat-parse-hl-discard" />
          <span>Text removed on import</span>
        </li>
      </ul>
    )
  }

  if (variant === 'questions') {
    return (
      <ul className="space-y-1.5">
        <li className="flex items-center gap-2">
          <ParseLegendSwatch className="ucat-parse-hl-q-stem" />
          <span>Passage / stem</span>
        </li>
        <li className="flex items-center gap-2">
          <ParseLegendSwatch className="ucat-parse-hl-q-question" />
          <span>Question prompt / numbering</span>
        </li>
        <li className="flex items-center gap-2">
          <ParseLegendSwatch className="ucat-parse-hl-q-option" />
          <span>Answer options</span>
        </li>
      </ul>
    )
  }

  return (
    <ul className="space-y-1.5">
      <li className="flex items-center gap-2">
        <ParseLegendSwatch className="ucat-parse-hl-a-qnum" />
        <span>Question number</span>
      </li>
      <li className="flex items-center gap-2">
        <ParseLegendSwatch className="ucat-parse-hl-a-letter" />
        <span>Correct letter or Y/N</span>
      </li>
      <li className="flex items-center gap-2">
        <ParseLegendSwatch className={explClass} />
        <span>
          Explanation
          {!includeExplanationsOnImport ? ' (dimmed — not imported)' : ''}
        </span>
      </li>
      <li className="flex items-center gap-2">
        <ParseLegendSwatch className="ucat-parse-hl-a-header" />
        <span>Header row</span>
      </li>
      <li className="flex items-center gap-2">
        <span className="ucat-parse-hl-a-sep font-mono text-xs" aria-hidden>
          ⇥
        </span>
        <span>Tab separators</span>
      </li>
      <li className="flex items-center gap-2">
        <ParseLegendSwatch className="ucat-parse-hl-a-other" />
        <span>Unrecognized cells</span>
      </li>
    </ul>
  )
}
