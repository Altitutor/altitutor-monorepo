'use client'

import type { ReactNode } from 'react'
import type { Json } from '@altitutor/shared'
import { UcatRichContentBlock } from '@/features/ucat/question-engine-preview/UcatRichContentBlock'
import {
  hasRichTextContent,
  proseMirrorHasBlockTable,
  proseMirrorToPlainText,
} from '@/features/ucat/shared/lib/rich-text'
import { cn } from '@/shared/utils'

type BulkImportRichTextPreviewProps = {
  json?: Json | null
  className?: string
  /** Clamp visible lines when collapsed (e.g. card preview). Ignored when content includes a table. */
  lineClamp?: 1 | 2 | 3 | 4
  /** Force a single truncated line (e.g. review table cells). Never renders images/tables. */
  singleLine?: boolean
  emptyFallback?: ReactNode
}

const COMPACT_RICH_CLASS =
  'text-xs leading-relaxed text-foreground/90 [&_.ProseMirror]:min-h-0 [&_.ProseMirror]:p-0 [&_.ProseMirror]:text-xs [&_.ProseMirror]:leading-relaxed'

const TABLE_RICH_CLASS =
  '[&_.ProseMirror_table]:my-2 [&_.ProseMirror_table]:w-full [&_.ProseMirror_table]:border-collapse [&_.ProseMirror_table]:table-fixed [&_.ProseMirror_th]:border [&_.ProseMirror_th]:border-border [&_.ProseMirror_th]:p-1.5 [&_.ProseMirror_th]:bg-muted [&_.ProseMirror_th]:text-left [&_.ProseMirror_td]:border [&_.ProseMirror_td]:border-border [&_.ProseMirror_td]:p-1.5 [&_.ProseMirror_td]:align-top'

function nodeHasType(value: Json | null | undefined, type: string): boolean {
  if (!value || typeof value !== 'object') return false
  const visit = (node: unknown): boolean => {
    if (!node || typeof node !== 'object') return false
    const rec = node as Record<string, unknown>
    if (rec.type === type) return true
    const content = rec.content
    if (Array.isArray(content)) {
      for (const child of content) {
        if (visit(child)) return true
      }
    }
    return false
  }
  return visit(value)
}

export function BulkImportRichTextPreview({
  json,
  className,
  lineClamp,
  singleLine = false,
  emptyFallback = null,
}: BulkImportRichTextPreviewProps) {
  if (!hasRichTextContent(json)) return emptyFallback

  const plainText = proseMirrorToPlainText(json)?.trim() ?? ''
  const hasTable = proseMirrorHasBlockTable(json)
  const oneLine = plainText.replace(/\s+/g, ' ').trim()

  // Compact table cells: never render images/tables — plain truncated text only.
  if (singleLine) {
    let display = oneLine
    if (!display) {
      if (nodeHasType(json, 'image')) display = '[Image]'
      else if (hasTable) display = '[Table]'
      else display = '—'
    }
    return (
      <span className={cn('block truncate', className)} title={display}>
        {display}
      </span>
    )
  }

  const useLineClamp = lineClamp != null && !hasTable

  return (
    <div
      className={cn(
        'pointer-events-none min-w-0 select-none',
        useLineClamp && lineClamp === 1 && 'line-clamp-1',
        useLineClamp && lineClamp === 2 && 'line-clamp-2',
        useLineClamp && lineClamp === 3 && 'line-clamp-3',
        useLineClamp && lineClamp === 4 && 'line-clamp-4',
        hasTable && 'overflow-x-auto',
        className
      )}
    >
      <UcatRichContentBlock
        json={json as Record<string, unknown> | null}
        plainText={plainText}
        preloadedContent={json as Record<string, unknown> | null}
        textTone="theme"
        className={cn(COMPACT_RICH_CLASS, TABLE_RICH_CLASS)}
      />
    </div>
  )
}
