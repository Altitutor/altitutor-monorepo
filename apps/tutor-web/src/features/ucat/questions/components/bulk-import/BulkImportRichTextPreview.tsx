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
  emptyFallback = null,
}: BulkImportRichTextPreviewProps) {
  if (!hasRichTextContent(json)) return emptyFallback

  const plainText = proseMirrorToPlainText(json)?.trim() ?? ''
  const hasTable = proseMirrorHasBlockTable(json)
  const useLineClamp = lineClamp != null && !hasTable

  return (
    <div
      className={cn(
        'pointer-events-none select-none',
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
        className={cn(COMPACT_RICH_CLASS, TABLE_RICH_CLASS)}
      />
    </div>
  )
}
