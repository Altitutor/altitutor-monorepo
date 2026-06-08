import type { Json } from '@altitutor/shared'

export type JsonLike = string | number | boolean | null | JsonLike[] | { [key: string]: JsonLike }

/** Extract plain text from rich JSON (ProseMirror/TipTap or similar). */
export function extractTextFromRichJson(value: JsonLike): string {
  if (value == null) return ''
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  if (Array.isArray(value)) {
    return value.map(extractTextFromRichJson).filter(Boolean).join(' ').replace(/\s+/g, ' ').trim()
  }
  const record = value as { [key: string]: JsonLike }
  if (Array.isArray(record.content)) {
    return record.content.map(extractTextFromRichJson).filter(Boolean).join(' ').replace(/\s+/g, ' ').trim()
  }
  if (typeof record.text === 'string') return record.text
  return Object.values(record).map(extractTextFromRichJson).filter(Boolean).join(' ').replace(/\s+/g, ' ').trim()
}

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

const TABLE_PLACEHOLDER_RE = /^\[\[TABLE:([^\]]+)\]\]$/

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
 * Like tokenizedPlainTextToProseMirror, but resolves [[TABLE:id]] when the entire text
 * is a table placeholder. Use for option text that may be a table.
 */
export function tokenizedPlainTextToProseMirrorWithTables(
  text: string,
  tableMap?: Map<string, Json>
): Json {
  if (!text || typeof text !== 'string') {
    return { type: 'doc', content: [{ type: 'paragraph', content: [] }] }
  }
  const trimmed = text.trim()
  const tableMatch = TABLE_PLACEHOLDER_RE.exec(trimmed)
  if (tableMatch && tableMap) {
    const tableId = tableMatch[1]
    const tableNode = tableMap.get(tableId ?? '')
    if (
      tableNode &&
      typeof tableNode === 'object' &&
      (tableNode as Record<string, unknown>).type === 'table'
    ) {
      return { type: 'doc', content: [tableNode] }
    }
  }
  return tokenizedPlainTextToProseMirror(text)
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

/**
 * Like tokenizedPlainTextToProseMirrorWithLineBreaks, but also resolves [[TABLE:id]] placeholders
 * to actual table nodes. Use for Quantitative Reasoning where tables must be preserved.
 *
 * @param text - Tokenized text with optional [[IMG:...]] and [[TABLE:id]] placeholders
 * @param tableMap - Map from placeholder id to ProseMirror table node JSON
 */
export function tokenizedPlainTextToProseMirrorWithLineBreaksAndTables(
  text: string,
  tableMap?: Map<string, Json>
): Json {
  if (!text || typeof text !== 'string') {
    return { type: 'doc', content: [{ type: 'paragraph', content: [] }] }
  }
  const lines = text.split('\n')
  const content: Json[] = []

  for (const line of lines) {
    const tableMatch = TABLE_PLACEHOLDER_RE.exec(line.trim())
    if (tableMatch && tableMap) {
      const tableId = tableMatch[1]
      const tableNode = tableMap.get(tableId ?? '')
      if (tableNode && typeof tableNode === 'object' && (tableNode as Record<string, unknown>).type === 'table') {
        content.push(tableNode)
        continue
      }
    }
    content.push({
      type: 'paragraph',
      content: buildInlineNodesFromTokenizedString(line),
    })
  }

  return { type: 'doc', content }
}

export function proseMirrorToPlainText(value: Json | null | undefined): string {
  if (!value || typeof value !== 'object') return ''

  const walk = (node: unknown): string => {
    if (!node || typeof node !== 'object') return ''
    const rec = node as Record<string, unknown>
    if (typeof rec.text === 'string') return rec.text
    if (rec.type === 'hardBreak') return '\n'
    if (!Array.isArray(rec.content)) return ''

    const type = rec.type
    const parts = rec.content.map(walk)

    if (type === 'table') return parts.filter(Boolean).join('\n')
    if (type === 'tableRow') return parts.join('\t')
    if (type === 'doc') return parts.filter(Boolean).join('\n')
    return parts.join('')
  }

  return walk(value).replace(/\n{3,}/g, '\n\n').trim()
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

function proseMirrorHasTable(value: Json | null | undefined): boolean {
  if (!value || typeof value !== 'object') return false
  const root = value as Record<string, unknown>

  const visit = (node: unknown): boolean => {
    if (!node || typeof node !== 'object') return false
    const rec = node as Record<string, unknown>
    if (rec.type === 'table') return true
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

/** Returns true if the ProseMirror value has non-empty plain text, image, or table content. */
export function hasRichTextContent(value: Json | null | undefined): boolean {
  const plain = proseMirrorToPlainText(value)?.trim() ?? ''
  if (plain.length > 0) return true
  if (proseMirrorHasImage(value)) return true
  return proseMirrorHasTable(value)
}

export function proseMirrorHasBlockTable(value: Json | null | undefined): boolean {
  return proseMirrorHasTable(value)
}

/**
 * Filters an array of options to those with non-empty answerText.
 * Use when building API payloads so empty answer options are not submitted.
 */
export function filterOptionsWithContent<T extends { answerText: Json }>(options: T[]): T[] {
  return options.filter((opt) => hasRichTextContent(opt.answerText))
}
