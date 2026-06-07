'use client'

import { RichTextEditor } from '@altitutor/ui'
import type { Json } from '@altitutor/shared'
import { useRefreshedUcatContent } from '@/features/ucat/question-engine-preview/hooks/useRefreshedUcatContent'
import {
  UCAT_ENGINE_READONLY_EDITOR_CLASSNAME,
  UCAT_ENGINE_TABLE_WRAPPER_CLASSNAME,
} from '@/features/ucat/shared/UcatRichTextEditor'
import { hasRichTextContent } from '@/features/ucat/shared/lib/rich-text'
import { cn } from '@/shared/utils'

const ENGINE_RICH_TEXT = cn(
  'text-black [color-scheme:light] dark:text-black',
  '[&_.tiptap]:!text-black [&_.ProseMirror]:!text-black',
  '[&_p]:!text-black [&_li]:!text-black [&_h1]:!text-black [&_h2]:!text-black [&_h3]:!text-black',
  UCAT_ENGINE_TABLE_WRAPPER_CLASSNAME
)

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
  const richJson = json as Json | null | undefined

  if (hasRichTextContent(richJson)) {
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
          omitTypography
          minHeight="auto"
          className={UCAT_ENGINE_READONLY_EDITOR_CLASSNAME}
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
