'use client'

import { RichTextEditor } from '@altitutor/ui'
import { useRefreshedUcatContent } from '@/features/ucat/question-engine-preview/hooks/useRefreshedUcatContent'
import { cn } from '@/shared/utils'

const ENGINE_RICH_TEXT =
  'text-black [color-scheme:light] dark:text-black [&_.ProseMirror]:!text-black [&_p]:!text-black [&_li]:!text-black [&_h1]:!text-black [&_h2]:!text-black [&_h3]:!text-black'

function hasContent(json: Record<string, unknown> | null | undefined): boolean {
  if (!json || typeof json !== 'object') return false
  const content = json.content
  return Array.isArray(content) && content.length > 0
}

type UcatRichContentBlockProps = {
  json?: Record<string, unknown> | null
  plainText: string
  preloadedContent?: Record<string, unknown> | null
  className?: string
}

/** Renders rich content when JSON is available (parity with ucat-web RichContentBlock). */
export function UcatRichContentBlock({
  json,
  plainText,
  preloadedContent,
  className,
}: UcatRichContentBlockProps) {
  const { content, isLoading } = useRefreshedUcatContent(preloadedContent != null ? undefined : json)

  const displayContent = preloadedContent ?? content

  if (hasContent(json)) {
    if (displayContent == null || (preloadedContent == null && isLoading)) {
      return (
        <p className={cn('whitespace-pre-line', ENGINE_RICH_TEXT, className)}>
          {plainText || '\u00A0'}
        </p>
      )
    }
    return (
      <div className={cn(ENGINE_RICH_TEXT, className)}>
        <RichTextEditor
          content={displayContent}
          editable={false}
          minHeight="auto"
          className="min-h-0 text-black [&_.ProseMirror]:min-h-0 [&_.ProseMirror]:p-0 [&_.ProseMirror]:!text-black"
        />
      </div>
    )
  }
  return (
    <p className={cn('whitespace-pre-line', ENGINE_RICH_TEXT, className)}>
      {plainText || '\u00A0'}
    </p>
  )
}
