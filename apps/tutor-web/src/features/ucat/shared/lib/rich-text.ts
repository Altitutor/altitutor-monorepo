import type { Json } from '@altitutor/shared'

export type JsonLike = string | number | boolean | null | JsonLike[] | { [key: string]: JsonLike }

export type RichTextSyntaxLeak = {
  kind: 'markdown_emphasis' | 'markdown_link' | 'latex_delimiter'
  text: string
}

const RICH_TEXT_SYNTAX_PATTERNS: Array<{
  kind: RichTextSyntaxLeak['kind']
  pattern: RegExp
}> = [
  { kind: 'markdown_emphasis', pattern: /\*\*[^*\n]+\*\*|~~[^~\n]+~~/u },
  { kind: 'markdown_link', pattern: /\[[^\]\n]+\]\([^\s)\n]+\)/u },
  { kind: 'latex_delimiter', pattern: /\\\([^\n]*?\\\)|\\\[[\s\S]*?\\\]/u },
]

/** Finds formatting source that would be shown literally inside ProseMirror text nodes. */
export function findRichTextSyntaxLeaks(
  value: Json | null | undefined,
): RichTextSyntaxLeak[] {
  const leaks: RichTextSyntaxLeak[] = []

  const visit = (node: unknown) => {
    if (!node || typeof node !== 'object') return
    if (Array.isArray(node)) {
      node.forEach(visit)
      return
    }
    const record = node as Record<string, unknown>
    if (record.type === 'text' && typeof record.text === 'string') {
      for (const candidate of RICH_TEXT_SYNTAX_PATTERNS) {
        if (candidate.pattern.test(record.text)) {
          leaks.push({ kind: candidate.kind, text: record.text })
        }
      }
    }
    if (Array.isArray(record.content)) record.content.forEach(visit)
  }

  visit(value)
  return leaks
}

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
  if (
    (record.type === 'inlineMath' || record.type === 'blockMath')
    && record.attrs
    && typeof record.attrs === 'object'
    && !Array.isArray(record.attrs)
  ) {
    const latex = (record.attrs as { [key: string]: JsonLike }).latex
    if (typeof latex === 'string') return latex
  }
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
  marks?: Array<{ type: string }>
  attrs?: Record<string, Json | undefined>
  content?: Json[]
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

function proseMirrorTableCell(text: string, header = false): Json {
  return {
    type: header ? 'tableHeader' : 'tableCell',
    attrs: { colspan: 1, rowspan: 1, colwidth: null },
    content: [proseMirrorParagraph(text)],
  }
}

function normalizeInlineFormattingTags(text: string): string {
  return text
    .replace(/&lt;(\/?(?:b|strong|i|em))&gt;/giu, '<$1>')
    .replace(/<((?:b|strong|i|em))\s+[^>]*>/giu, '<$1>')
}

type InlineMark = {
  type: 'bold' | 'italic' | 'strike' | 'code' | 'link'
  attrs?: Record<string, Json | undefined>
}

function activeMarks(
  active: Set<'bold' | 'italic'>,
  extra?: InlineMark,
): InlineMark[] {
  const marks = new Set(active)
  const result: InlineMark[] = Array.from(marks).map((type) => ({ type }))
  if (extra) result.push(extra)
  return result
}

function appendInlineTextNode(
  nodes: Json[],
  text: string,
  active: Set<'bold' | 'italic'>,
  extra?: InlineMark,
  normalizeMathCommands = true,
) {
  if (!text) return
  const marks = activeMarks(active, extra)
  const renderedText = normalizeMathCommands ? normalizeBareMathCommands(text) : text
  nodes.push(marks.length ? { type: 'text', text: renderedText, marks } : { type: 'text', text: renderedText })
}

const BARE_MATH_COMMANDS: Record<string, string> = {
  div: '÷',
  times: '×',
  pm: '±',
  approx: '≈',
  le: '≤',
  leq: '≤',
  ge: '≥',
  geq: '≥',
  neq: '≠',
  cdot: '·',
}

export function normalizeBareMathCommands(text: string): string {
  return text
    .replace(/\\(div|times|pm|approx|leq|geq|neq|cdot|le|ge)(?![A-Za-z])/gu, (_, command: string) => BARE_MATH_COMMANDS[command] ?? command)
    .replace(/\\%/gu, '%')
}

function safeMarkdownLinkMark(href: string): InlineMark | null {
  if (!/^(?:https?:\/\/|mailto:)/iu.test(href)) return null
  return { type: 'link', attrs: { href } }
}

export function aiInlineTextNodes(text: string): Json[] {
  const nodes: Json[] = []
  const active = new Set<'bold' | 'italic'>()
  const normalized = normalizeInlineFormattingTags(text)
  const pattern = /(\\\([^\n]*?\\\)|\[[^\]\n]+\]\([^\s)\n]+\)|\*\*[^*\n]+\*\*|~~[^~\n]+~~|`[^`\n]+`|_[^_\n]+_|<\/?(?:b|strong|i|em)>)/giu
  let cursor = 0

  for (const match of normalized.matchAll(pattern)) {
    const index = match.index ?? 0
    if (index > cursor) appendInlineTextNode(nodes, normalized.slice(cursor, index), active)
    const token = match[0]
    const inlineMath = token.match(/^\\\(([\s\S]*?)\\\)$/u)
    const markdownLink = token.match(/^\[([^\]\n]+)\]\(([^\s)\n]+)\)$/u)
    if (inlineMath?.[1]?.trim()) {
      nodes.push({
        type: 'inlineMath',
        attrs: { latex: inlineMath[1].trim() },
      })
    } else if (markdownLink?.[1] && markdownLink[2]) {
      const linkMark = safeMarkdownLinkMark(markdownLink[2])
      appendInlineTextNode(
        nodes,
        linkMark ? markdownLink[1] : token,
        active,
        linkMark ?? undefined,
      )
    } else if (token.startsWith('**') && token.endsWith('**')) {
      appendInlineTextNode(nodes, token.slice(2, -2), active, { type: 'bold' })
    } else if (token.startsWith('~~') && token.endsWith('~~')) {
      appendInlineTextNode(nodes, token.slice(2, -2), active, { type: 'strike' })
    } else if (token.startsWith('`') && token.endsWith('`')) {
      appendInlineTextNode(nodes, token.slice(1, -1), active, { type: 'code' }, false)
    } else if (token.startsWith('_') && token.endsWith('_')) {
      appendInlineTextNode(nodes, token.slice(1, -1), active, { type: 'italic' })
    } else {
      const tag = token.toLowerCase()
      if (tag === '<b>' || tag === '<strong>') active.add('bold')
      if (tag === '</b>' || tag === '</strong>') active.delete('bold')
      if (tag === '<i>' || tag === '<em>') active.add('italic')
      if (tag === '</i>' || tag === '</em>') active.delete('italic')
    }
    cursor = index + token.length
  }

  if (cursor < normalized.length) appendInlineTextNode(nodes, normalized.slice(cursor), active)
  return nodes.filter((node) => {
    const textValue = (node as Record<string, unknown>).text
    return typeof textValue !== 'string' || textValue.length > 0
  })
}

function proseMirrorParagraph(text: string): Json {
  const trimmed = text.trim()
  return {
    type: 'paragraph',
    content: trimmed ? aiInlineTextNodes(trimmed) : [],
  }
}

function parseMarkdownTableRow(line: string): string[] | null {
  const trimmed = line.trim()
  if (!trimmed.includes('|')) return null
  const withoutEdges = trimmed.replace(/^\|/u, '').replace(/\|$/u, '')
  const cells = withoutEdges.split('|').map((cell) => cell.trim())
  return cells.length >= 2 ? cells : null
}

function isMarkdownTableSeparator(line: string): boolean {
  const cells = parseMarkdownTableRow(line)
  return !!cells && cells.every((cell) => /^:?-{3,}:?$/u.test(cell.replace(/\s+/gu, '')))
}

function markdownTableToProseMirror(lines: string[]): Json | null {
  if (lines.length < 2 || !isMarkdownTableSeparator(lines[1] ?? '')) return null
  const header = parseMarkdownTableRow(lines[0] ?? '')
  if (!header) return null
  const bodyLines = lines.slice(2)
  const rows: Json[] = [
    {
      type: 'tableRow',
      content: header.map((cell) => proseMirrorTableCell(cell, true)),
    },
  ]
  for (const line of bodyLines) {
    const cells = parseMarkdownTableRow(line)
    if (!cells) continue
    rows.push({
      type: 'tableRow',
      content: header.map((_, index) => proseMirrorTableCell(cells[index] ?? '')),
    })
  }
  return rows.length > 1 ? { type: 'table', content: rows } : null
}

type MarkdownListItem = {
  ordered: boolean
  text: string
}

function parseMarkdownListMarker(line: string): MarkdownListItem | null {
  const ordered = line.match(/^\s*\d+\.\s+(.+)$/u)
  if (ordered?.[1]) return { ordered: true, text: ordered[1].trimEnd() }
  const unordered = line.match(/^\s*[-*]\s+(.+)$/u)
  if (unordered?.[1]) return { ordered: false, text: unordered[1].trimEnd() }
  return null
}

function markdownListToProseMirror(items: string[], ordered: boolean): Json {
  return {
    type: ordered ? 'orderedList' : 'bulletList',
    ...(ordered ? { attrs: { start: 1 } } : {}),
    content: items.map((item) => ({
      type: 'listItem',
      content: [proseMirrorParagraph(item)],
    })),
  }
}

function continueOrderedListNumbering(nodes: Json[]): Json[] {
  let nextStart: number | null = null
  return nodes.map((node) => {
    if (!node || typeof node !== 'object' || Array.isArray(node)) {
      nextStart = null
      return node
    }
    const record = node as Record<string, Json | undefined>
    if (record.type === 'orderedList') {
      const attrs = record.attrs && typeof record.attrs === 'object' && !Array.isArray(record.attrs)
        ? record.attrs as Record<string, Json | undefined>
        : {}
      const existingStart = typeof attrs.start === 'number' ? attrs.start : 1
      const start = nextStart ?? existingStart
      const itemCount = Array.isArray(record.content) ? record.content.length : 0
      nextStart = start + itemCount
      return { ...record, attrs: { ...attrs, start } }
    }
    if (record.type !== 'blockMath') nextStart = null
    return node
  })
}

/**
 * Converts AI-authored prose into ProseMirror JSON. Unlike the plain-text helpers,
 * this detects GitHub-style markdown pipe tables and stores them as real table nodes.
 */
export function aiTextToProseMirror(text: string): Json {
  if (!text || typeof text !== 'string') {
    return { type: 'doc', content: [{ type: 'paragraph', content: [] }] }
  }

  const lines = text.split(/\r?\n/u)
  const content: Json[] = []
  let paragraphLines: string[] = []

  const flushParagraph = () => {
    if (paragraphLines.length === 0) return
    const paragraphText = paragraphLines.join('\n').trimEnd()
    if (paragraphText.trim()) {
      content.push(proseMirrorParagraph(paragraphText))
    }
    paragraphLines = []
  }

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? ''
    const next = lines[index + 1] ?? ''

    const displayMathStart = line.match(/^\s*\\\[(.*)$/u)
    if (displayMathStart) {
      flushParagraph()
      const mathLines: string[] = []
      let remainder = displayMathStart[1] ?? ''
      let closed = false

      while (true) {
        const closingIndex = remainder.indexOf('\\]')
        if (closingIndex >= 0) {
          mathLines.push(remainder.slice(0, closingIndex))
          closed = true
          break
        }
        mathLines.push(remainder)
        index += 1
        if (index >= lines.length) break
        remainder = lines[index] ?? ''
      }

      const latex = mathLines.join('\n').trim()
      if (closed && latex) {
        content.push({ type: 'blockMath', attrs: { latex } })
      } else {
        paragraphLines.push(`\\[${mathLines.join('\n')}`)
      }
      continue
    }

    if (/^\s*```/u.test(line)) {
      flushParagraph()
      const codeLines: string[] = []
      index += 1
      while (index < lines.length && !/^\s*```\s*$/u.test(lines[index] ?? '')) {
        codeLines.push(lines[index] ?? '')
        index += 1
      }
      const code = codeLines.join('\n')
      content.push({
        type: 'codeBlock',
        content: code ? [{ type: 'text', text: code }] : [],
      })
      continue
    }

    const heading = line.match(/^(#{1,4})\s+(.+)$/u)
    if (heading?.[1] && heading[2]) {
      flushParagraph()
      content.push({
        type: 'heading',
        attrs: { level: Math.min(heading[1].length, 4) },
        content: aiInlineTextNodes(heading[2].trim()),
      })
      continue
    }

    if (parseMarkdownTableRow(line) && isMarkdownTableSeparator(next)) {
      flushParagraph()
      const tableLines = [line, next]
      index += 2
      while (index < lines.length && parseMarkdownTableRow(lines[index] ?? '')) {
        tableLines.push(lines[index] ?? '')
        index += 1
      }
      index -= 1
      const table = markdownTableToProseMirror(tableLines)
      if (table) content.push(table)
      continue
    }

    const blockquote = line.match(/^\s*>\s?(.*)$/u)
    if (blockquote) {
      flushParagraph()
      const quoteLines: string[] = [blockquote[1] ?? '']
      index += 1
      while (index < lines.length) {
        const quoteLine = (lines[index] ?? '').match(/^\s*>\s?(.*)$/u)
        if (!quoteLine) break
        quoteLines.push(quoteLine[1] ?? '')
        index += 1
      }
      index -= 1
      content.push({
        type: 'blockquote',
        content: quoteLines
          .filter((quoteLine) => quoteLine.trim())
          .map(proseMirrorParagraph),
      })
      continue
    }

    if (/^\s*(?:---+|\*\*\*+|___+)\s*$/u.test(line)) {
      flushParagraph()
      content.push({ type: 'horizontalRule' })
      continue
    }

    const listStart = parseMarkdownListMarker(line)
    if (listStart) {
      flushParagraph()
      const listItems: string[] = [listStart.text]
      const ordered = listStart.ordered
      index += 1
      while (index < lines.length) {
        const candidate = lines[index] ?? ''
        const nextListItem = parseMarkdownListMarker(candidate)
        if (nextListItem && nextListItem.ordered === ordered) {
          listItems.push(nextListItem.text)
          index += 1
          continue
        }
        if (
          candidate.trim() &&
          /^\s{2,}\S/u.test(candidate) &&
          !parseMarkdownTableRow(candidate) &&
          !candidate.match(/^(#{1,4})\s+(.+)$/u)
        ) {
          listItems[listItems.length - 1] = `${listItems[listItems.length - 1].trimEnd()} ${candidate.trim()}`
          index += 1
          continue
        }
        break
      }
      index -= 1
      content.push(markdownListToProseMirror(listItems, ordered))
      continue
    }

    if (!line.trim()) {
      flushParagraph()
      continue
    }
    paragraphLines.push(line)
  }
  flushParagraph()

  return {
    type: 'doc',
    content: content.length > 0
      ? continueOrderedListNumbering(content)
      : [{ type: 'paragraph', content: [] }],
  }
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
    const attrs = rec.attrs
    const latex =
      attrs && typeof attrs === 'object' && !Array.isArray(attrs)
        ? (attrs as Record<string, unknown>).latex
        : null
    if (rec.type === 'inlineMath' && typeof latex === 'string') {
      return `\\(${latex}\\)`
    }
    if (rec.type === 'blockMath' && typeof latex === 'string') {
      return `\\[${latex}\\]`
    }
    if (!Array.isArray(rec.content)) return ''

    const type = rec.type
    const parts = rec.content.map(walk)

    if (type === 'table') return parts.filter(Boolean).join('\n')
    if (type === 'tableRow') return parts.join('\t')
    if (type === 'doc') return parts.filter(Boolean).join('\n')
    if (type === 'bulletList' || type === 'orderedList' || type === 'listItem') {
      return parts.filter(Boolean).join('\n')
    }
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

type RichNode = {
  type?: string
  content?: RichNode[]
  [key: string]: JsonLike | RichNode[] | undefined
}

function asRichNode(value: unknown): RichNode | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as RichNode
}

function childNodes(node: RichNode | null | undefined): RichNode[] {
  return Array.isArray(node?.content) ? node.content : []
}

/** Lift cell contents out of a table; nested tables in cells stay as table nodes. */
function flattenOuterTable(table: RichNode): RichNode[] {
  const flattened: RichNode[] = []
  for (const row of childNodes(table)) {
    if (row.type !== 'tableRow') continue
    for (const cell of childNodes(row)) {
      if (cell.type !== 'tableCell' && cell.type !== 'tableHeader') continue
      for (const child of childNodes(cell)) {
        flattened.push(child)
      }
    }
  }
  return flattened
}

/**
 * Flatten outermost tables only (same idea as paste `strip_outside`).
 * Nested tables inside cells are preserved as tables.
 */
function transformStripOuterTables(node: RichNode): RichNode | RichNode[] {
  if (node.type === 'table') {
    return flattenOuterTable(node)
  }

  const children = childNodes(node)
  if (children.length === 0) return node

  const nextContent: RichNode[] = []
  for (const child of children) {
    const mapped = transformStripOuterTables(child)
    if (Array.isArray(mapped)) nextContent.push(...mapped)
    else nextContent.push(mapped)
  }
  return { ...node, content: nextContent }
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

/**
 * True when the doc has a table that {@link stripOuterTablesFromProseMirrorDoc} would flatten
 * (any table not nested inside another table — equivalent to any table in a well-formed doc).
 */
export function proseMirrorHasOuterTable(value: Json | null | undefined): boolean {
  const root = asRichNode(value)
  if (!root) return false

  const visit = (node: RichNode): boolean => {
    if (node.type === 'table') return true
    for (const child of childNodes(node)) {
      if (visit(child)) return true
    }
    return false
  }

  return visit(root)
}

/**
 * Strip the outermost tables from a ProseMirror JSON doc, keeping nested tables intact.
 * Matches paste behavior `strip_outside` for content already in the editor.
 */
export function stripOuterTablesFromProseMirrorDoc(
  value: Json | null | undefined,
): Json | null {
  const root = asRichNode(value)
  if (!root) return value ?? null

  const transformed = transformStripOuterTables(root)
  if (Array.isArray(transformed)) {
    return {
      type: 'doc',
      content: (transformed.length > 0
        ? transformed
        : [{ type: 'paragraph' }]) as Json[],
    }
  }

  if (transformed.type === 'doc') {
    const content = childNodes(transformed)
    return {
      type: 'doc',
      content: (content.length > 0 ? content : [{ type: 'paragraph' }]) as Json[],
    }
  }

  return transformed as Json
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
