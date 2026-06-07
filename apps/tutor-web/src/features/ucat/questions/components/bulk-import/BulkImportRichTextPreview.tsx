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
  /** Force a single truncated line (e.g. review table cells). Tables fall back to plain-text ellipsis. */
  singleLine?: boolean
  emptyFallback?: ReactNode
}

const COMPACT_RICH_CLASS =
  'text-xs leading-relaxed text-foreground/90 [&_.ProseMirror]:min-h-0 [&_.ProseMirror]:p-0 [&_.ProseMirror]:text-xs [&_.ProseMirror]:leading-relaxed'

const TABLE_RICH_CLASS =
  '[&_.ProseMirror_table]:my-2 [&_.ProseMirror_table]:w-full [&_.ProseMirror_table]:border-collapse [&_.ProseMirror_table]:table-fixed [&_.ProseMirror_th]:border [&_.ProseMirror_th]:border-border [&_.ProseMirror_th]:p-1.5 [&_.ProseMirror_th]:bg-muted [&_.ProseMirror_th]:text-left [&_.ProseMirror_td]:border [&_.ProseMirror_td]:border-border [&_.ProseMirror_td]:p-1.5 [&_.ProseMirror_td]:align-top'

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

  if (singleLine && hasTable) {
    const oneLine = plainText.replace(/\s+/g, ' ').trim()
    return (
      <span className={cn('block truncate', className)} title={oneLine || undefined}>
        {oneLine || '—'}
      </span>
    )
  }

  const useLineClamp = (singleLine ? 1 : lineClamp) != null && !hasTable
  const clampLines = singleLine ? 1 : lineClamp

  return (
    <div
      className={cn(
        'pointer-events-none min-w-0 select-none',
        singleLine && 'truncate overflow-hidden whitespace-nowrap',
        useLineClamp && clampLines === 1 && 'line-clamp-1',
        useLineClamp && clampLines === 2 && 'line-clamp-2',
        useLineClamp && clampLines === 3 && 'line-clamp-3',
        useLineClamp && clampLines === 4 && 'line-clamp-4',
        !singleLine && hasTable && 'overflow-x-auto',
        className
      )}
      title={singleLine ? plainText.replace(/\s+/g, ' ').trim() || undefined : undefined}
    >
      <UcatRichContentBlock
        json={json as Record<string, unknown> | null}
        plainText={plainText}
        preloadedContent={json as Record<string, unknown> | null}
        className={cn(
          COMPACT_RICH_CLASS,
          !singleLine && TABLE_RICH_CLASS,
          singleLine &&
            'inline [&_.ProseMirror]:inline [&_.ProseMirror_p]:inline [&_.ProseMirror_p]:whitespace-nowrap'
        )}
      />
    </div>
  )
}
