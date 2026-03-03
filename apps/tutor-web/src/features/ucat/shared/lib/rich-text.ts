import type { Json } from '@altitutor/shared'

export function plainTextToProseMirror(text: string): Json {
  return {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: text
          ? [
              {
                type: 'text',
                text,
              },
            ]
          : [],
      },
    ],
  }
}

/**
 * Convert plain text with newlines to ProseMirror JSON with one paragraph per line.
 * Use for content where line breaks should be preserved (e.g. question stem passages).
 */
export function plainTextToProseMirrorWithLineBreaks(text: string): Json {
  if (!text || typeof text !== 'string') {
    return { type: 'doc', content: [{ type: 'paragraph', content: [] }] }
  }
  const lines = text.split('\n')
  const content = lines.map((line) => ({
    type: 'paragraph',
    content: line.length > 0 ? [{ type: 'text', text: line }] : [],
  }))
  return { type: 'doc', content }
}

export function proseMirrorToPlainText(value: Json | null | undefined): string {
  if (!value || typeof value !== 'object') return ''

  const asRecord = value as Record<string, unknown>
  const content = asRecord.content
  if (!Array.isArray(content)) return ''

  const chunks: string[] = []

  for (const node of content) {
    if (!node || typeof node !== 'object') continue
    const nodeRecord = node as Record<string, unknown>
    const nodeContent = nodeRecord.content
    if (!Array.isArray(nodeContent)) continue

    const line = nodeContent
      .map((child) => {
        if (!child || typeof child !== 'object') return ''
        const childRecord = child as Record<string, unknown>
        return typeof childRecord.text === 'string' ? childRecord.text : ''
      })
      .join('')

    if (line.length > 0) chunks.push(line)
  }

  return chunks.join('\n')
}

/** Returns true if the ProseMirror value has non-empty plain text. */
export function hasRichTextContent(value: Json | null | undefined): boolean {
  return (proseMirrorToPlainText(value)?.trim().length ?? 0) > 0
}

/**
 * Filters an array of options to those with non-empty answerText.
 * Use when building API payloads so empty answer options are not submitted.
 */
export function filterOptionsWithContent<T extends { answerText: Json }>(options: T[]): T[] {
  return options.filter((opt) => hasRichTextContent(opt.answerText))
}
