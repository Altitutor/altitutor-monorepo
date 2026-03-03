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

type ProseMirrorNode = {
  type: string
  text?: string
  attrs?: Record<string, Json | undefined>
}

function buildInlineNodesFromTokenizedString(text: string): ProseMirrorNode[] {
  const nodes: ProseMirrorNode[] = []
  if (!text) return nodes

  const tokenRegex = /\[\[IMG:([^\]]+)\]\]/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  // Helper to push a text node if non-empty
  const pushText = (value: string) => {
    if (!value) return
    nodes.push({ type: 'text', text: value })
  }

  while ((match = tokenRegex.exec(text)) !== null) {
    const before = text.slice(lastIndex, match.index)
    pushText(before)

    const paramString = match[1] ?? ''
    const params = Object.create(null) as Record<string, string>
    for (const part of paramString.split(';')) {
      if (!part) continue
      const [key, rawValue] = part.split('=')
      if (!key) continue
      try {
        params[key] = decodeURIComponent(rawValue ?? '')
      } catch {
        params[key] = rawValue ?? ''
      }
    }

    const src = params.s ?? ''
    const fileId = params.f ?? ''

    if (src || fileId) {
      const attrs: Record<string, Json | undefined> = {}
      if (src) attrs.src = src
      if (fileId) attrs.fileId = fileId
      nodes.push({
        type: 'image',
        attrs,
      })
    } else {
      // Fallback: treat token as plain text if it had no usable data
      pushText(match[0] ?? '')
    }

    lastIndex = tokenRegex.lastIndex
  }

  const after = text.slice(lastIndex)
  pushText(after)

  return nodes
}

/** Convert tokenized plain text (with [[IMG:...]] markers) into ProseMirror JSON. */
export function tokenizedPlainTextToProseMirror(text: string): Json {
  return {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: buildInlineNodesFromTokenizedString(text),
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

/** Like plainTextToProseMirrorWithLineBreaks, but preserves [[IMG:...]] tokens as image nodes. */
export function tokenizedPlainTextToProseMirrorWithLineBreaks(text: string): Json {
  if (!text || typeof text !== 'string') {
    return { type: 'doc', content: [{ type: 'paragraph', content: [] }] }
  }
  const lines = text.split('\n')
  const content = lines.map((line) => ({
    type: 'paragraph',
    content: buildInlineNodesFromTokenizedString(line),
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

function proseMirrorHasImage(value: Json | null | undefined): boolean {
  if (!value || typeof value !== 'object') return false
  const root = value as Record<string, unknown>

  const visit = (node: unknown): boolean => {
    if (!node || typeof node !== 'object') return false
    const rec = node as Record<string, unknown>
    if (rec.type === 'image') return true
    const content = rec.content
    if (Array.isArray(content)) {
      for (const child of content) {
        if (visit(child)) return true
      }
    }
    return false
  }

  return visit(root)
}

/** Returns true if the ProseMirror value has non-empty plain text or image content. */
export function hasRichTextContent(value: Json | null | undefined): boolean {
  const plain = proseMirrorToPlainText(value)?.trim() ?? ''
  if (plain.length > 0) return true
  return proseMirrorHasImage(value)
}

/**
 * Filters an array of options to those with non-empty answerText.
 * Use when building API payloads so empty answer options are not submitted.
 */
export function filterOptionsWithContent<T extends { answerText: Json }>(options: T[]): T[] {
  return options.filter((opt) => {
    const plain = proseMirrorToPlainText(opt.answerText)?.trim() ?? ''
    const hasImage = proseMirrorHasImage(opt.answerText)
    const keep = plain.length > 0 || hasImage
    return keep
  })
}
