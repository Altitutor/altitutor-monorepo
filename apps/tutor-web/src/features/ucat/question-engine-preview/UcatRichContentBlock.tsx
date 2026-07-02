'use client'

import { useMemo } from 'react'
import { RichTextEditor } from '@altitutor/ui'
import type { Json } from '@altitutor/shared'
import { useRefreshedUcatContent } from '@/features/ucat/question-engine-preview/hooks/useRefreshedUcatContent'
import {
  collectUcatImageRefsFromDoc,
  docStructureFingerprint,
  extractImageUrlsFromDoc,
} from '@/features/ucat/question-engine-preview/lib/refresh-ucat-image-urls'
import {
  UCAT_ENGINE_READONLY_EDITOR_CLASSNAME,
  UCAT_ENGINE_TABLE_WRAPPER_CLASSNAME,
} from '@/features/ucat/shared/UcatRichTextEditor'
import { hasRichTextContent } from '@/features/ucat/shared/lib/rich-text'
import {
  expandParagraphBreaksInDoc,
  UCAT_ENGINE_PARAGRAPH_SPACING_CLASSNAME,
} from '@/features/ucat/shared/lib/ucat-paragraph-spacing'
import { cn } from '@/shared/utils'

const ENGINE_RICH_TEXT = cn(
  'text-black [color-scheme:light] dark:text-black',
  '[&_.tiptap]:!text-black [&_.ProseMirror]:!text-black',
  '[&_p]:!text-black [&_li]:!text-black [&_h1]:!text-black [&_h2]:!text-black [&_h3]:!text-black',
  UCAT_ENGINE_TABLE_WRAPPER_CLASSNAME
)

const THEME_RICH_TEXT = cn(
  'text-foreground',
  '[&_.tiptap]:text-foreground [&_.ProseMirror]:text-foreground',
  '[&_p]:text-foreground [&_li]:text-foreground [&_strong]:text-foreground [&_em]:text-foreground [&_u]:text-foreground',
  '[&_h1]:text-foreground [&_h2]:text-foreground [&_h3]:text-foreground',
  '[&_.ProseMirror_span[style*="color"]]:!text-foreground',
  '[&_.ProseMirror_span[style*="background"]]:!bg-transparent',
  UCAT_ENGINE_TABLE_WRAPPER_CLASSNAME
)

const PARAGRAPH_SPACING_CLASS = UCAT_ENGINE_PARAGRAPH_SPACING_CLASSNAME

type UcatRichContentBlockProps = {
  json?: Record<string, unknown> | null
  plainText: string
  preloadedContent?: Record<string, unknown> | null
  className?: string
  /** Engine chrome uses fixed black text; theme follows app foreground (e.g. bulk import previews). */
  textTone?: 'engine' | 'theme'
  paragraphSpacing?: boolean
}

/** Renders rich content when JSON is available (parity with ucat-web RichContentBlock). */
export function UcatRichContentBlock({
  json,
  plainText,
  preloadedContent,
  className,
  textTone = 'engine',
  paragraphSpacing = false,
}: UcatRichContentBlockProps) {
  const { content, isLoading } = useRefreshedUcatContent(preloadedContent != null ? undefined : json)

  const displayContent = preloadedContent ?? content
  const richJson = json as Json | null | undefined
  const toneClass = textTone === 'theme' ? THEME_RICH_TEXT : ENGINE_RICH_TEXT
  const renderedContent = useMemo(() => {
    if (!displayContent || typeof displayContent !== 'object') return null
    if (!paragraphSpacing) return displayContent
    return expandParagraphBreaksInDoc(displayContent as Json)
  }, [displayContent, paragraphSpacing])

  const hasImageRefs = useMemo(() => {
    if (!json || typeof json !== 'object') return false
    const doc =
      json.type === 'doc' && Array.isArray(json.content)
        ? json
        : { type: 'doc', content: Array.isArray(json.content) ? json.content : [json] }
    const refs = collectUcatImageRefsFromDoc(doc as Record<string, unknown>)
    return refs.paths.length > 0 || refs.fileIds.length > 0
  }, [json])

  const waitingForImageRefresh =
    hasImageRefs &&
    displayContent == null &&
    preloadedContent == null &&
    isLoading

  const editorKey = useMemo(() => {
    if (!renderedContent || !hasRichTextContent(richJson)) return plainText
    if (hasImageRefs) {
      return extractImageUrlsFromDoc(renderedContent as Record<string, unknown>).join('\0')
    }
    return docStructureFingerprint(renderedContent as Record<string, unknown>)
  }, [renderedContent, hasImageRefs, plainText, richJson])

  const renderPlainText = () => {
    const text = plainText || '\u00A0'
    if (!paragraphSpacing) {
      return (
        <p className={cn('whitespace-pre-line', toneClass, className)}>
          {text}
        </p>
      )
    }

    return (
      <div className={cn('space-y-2', toneClass, className)}>
        {text.split(/\r?\n/u).map((paragraph, index) => (
          <p key={`${index}-${paragraph.slice(0, 12)}`}>
            {paragraph || '\u00A0'}
          </p>
        ))}
      </div>
    )
  }

  if (hasRichTextContent(richJson)) {
    if (waitingForImageRefresh) {
      return renderPlainText()
    }
    if (displayContent == null || renderedContent == null) {
      return renderPlainText()
    }
    return (
      <div className={cn(toneClass, className)}>
        <RichTextEditor
          key={editorKey}
          content={renderedContent}
          editable={false}
          omitTypography
          minHeight="auto"
          className={cn(
            UCAT_ENGINE_READONLY_EDITOR_CLASSNAME,
            paragraphSpacing && PARAGRAPH_SPACING_CLASS
          )}
        />
      </div>
    )
  }
  return renderPlainText()
}
