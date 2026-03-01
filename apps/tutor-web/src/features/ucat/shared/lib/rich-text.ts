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
