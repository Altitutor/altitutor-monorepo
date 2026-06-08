/**
 * Parse pasted answer documents preserving rich-text explanation cells from ProseMirror JSON.
 */
import type { Json } from '@altitutor/shared'
import {
  buildAnswerPasteSpansForLine,
  getAnswerLineRowKindsFromLines,
  isAnswersHeaderRowCells,
  parseAnswersTable,
  parseDecisionMakingAnswers,
  splitLineWithFieldOffsets,
  type AnswerParseOptions,
  type ParsedAnswerRow,
} from '@/features/ucat/questions/lib/parseAnswersTable'
import {
  answerDocInlinePlainText,
  answerDocToPlainTsv,
  getAnswerDocPlainLinesFromJson,
} from '@/features/ucat/questions/lib/pmAnswerLineRanges'
import { nodeToText, type PMNode } from '@/features/ucat/questions/lib/parsers/core'
import {
  hasRichTextContent,
  tokenizedPlainTextToProseMirror,
} from '@/features/ucat/shared/lib/rich-text'

export type ParsedAnswerRowRich = ParsedAnswerRow & {
  explanationDoc: Json | null
}

type AnswerRowSource =
  | { kind: 'table'; cells: PMNode[]; plainLine: string }
  | { kind: 'block'; block: PMNode; plainLine: string }

type ContentPiece =
  | { kind: 'text'; text: string; marks?: PMNode['marks'] }
  | { kind: 'image'; node: PMNode; token: string }

function isTableCellNode(node: PMNode): boolean {
  return node.type === 'tableCell' || node.type === 'tableHeader'
}

function explanationCellStartIndex(cells: string[]): number {
  const trimmed = cells.map((c) => c.trim())
  if (trimmed.length >= 3) {
    const num = Number.parseInt(trimmed[0] ?? '', 10)
    if (!Number.isNaN(num) && num >= 1 && num <= 999) return 2
  }
  if (trimmed.length >= 2) return 1
  return -1
}

function tableCellsToExplanationDoc(cells: PMNode[]): Json | null {
  const blocks = cells.flatMap((cell) => {
    if (isTableCellNode(cell) && cell.content) return cell.content
    return []
  })
  if (blocks.length === 0) return null
  return { type: 'doc', content: blocks } as Json
}

function collectContentPieces(node: PMNode): ContentPiece[] {
  if (!node?.type) return []
  if (node.type === 'image') {
    const token = nodeToText(node)
    if (!token) return []
    return [{ kind: 'image', node: { type: 'image', attrs: node.attrs }, token }]
  }
  if (node.type === 'text' && typeof node.text === 'string') {
    return [{ kind: 'text', text: node.text, marks: node.marks }]
  }
  if (node.type === 'hardBreak') return [{ kind: 'text', text: '\n' }]
  if (!Array.isArray(node.content) || node.content.length === 0) return []
  return node.content.flatMap((child) => collectContentPieces(child as PMNode))
}

function contentPieceLength(piece: ContentPiece): number {
  return piece.kind === 'text' ? piece.text.length : piece.token.length
}

function sliceContentPieces(pieces: ContentPiece[], start: number, end: number): PMNode[] {
  const out: PMNode[] = []
  let pos = 0
  for (const piece of pieces) {
    const pieceStart = pos
    const pieceEnd = pos + contentPieceLength(piece)
    pos = pieceEnd
    const overlapStart = Math.max(start, pieceStart)
    const overlapEnd = Math.min(end, pieceEnd)
    if (overlapStart >= overlapEnd) continue

    if (piece.kind === 'image') {
      if (overlapStart <= pieceStart && overlapEnd >= pieceEnd) {
        out.push(piece.node)
      }
      continue
    }

    const sliceText = piece.text.slice(overlapStart - pieceStart, overlapEnd - pieceStart)
    if (!sliceText) continue
    if (sliceText.includes('\n')) {
      const segments = sliceText.split('\n')
      segments.forEach((segment, index) => {
        if (segment.length > 0) {
          const node: PMNode = { type: 'text', text: segment }
          if (Array.isArray(piece.marks) && piece.marks.length > 0) node.marks = piece.marks
          out.push(node)
        }
        if (index < segments.length - 1) out.push({ type: 'hardBreak' })
      })
      continue
    }
    const node: PMNode = { type: 'text', text: sliceText }
    if (Array.isArray(piece.marks) && piece.marks.length > 0) node.marks = piece.marks
    out.push(node)
  }
  return out
}

function trimInlineNodes(nodes: PMNode[]): PMNode[] {
  let start = 0
  let end = nodes.length
  while (start < end) {
    const node = nodes[start]
    if (node?.type === 'text' && typeof node.text === 'string' && node.text.trim().length === 0) {
      start += 1
      continue
    }
    break
  }
  while (end > start) {
    const node = nodes[end - 1]
    if (node?.type === 'text' && typeof node.text === 'string' && node.text.trim().length === 0) {
      end -= 1
      continue
    }
    break
  }
  return nodes.slice(start, end)
}

function extractExplanationDocFromBlock(
  block: PMNode,
  plainLine: string,
  options?: AnswerParseOptions
): Json | null {
  const spans = buildAnswerPasteSpansForLine(plainLine, 'data', options)
  const explanationSpan = spans.find((span) => span.kind === 'explanation')
  if (!explanationSpan) return null
  const inlineNodes = trimInlineNodes(
    sliceContentPieces(collectContentPieces(block), explanationSpan.start, explanationSpan.end)
  )
  if (inlineNodes.length === 0) return null
  return { type: 'doc', content: [{ type: 'paragraph', content: inlineNodes }] } as Json
}

function extractExplanationDocFromSource(
  source: AnswerRowSource,
  options?: AnswerParseOptions
): Json | null {
  const cells = splitLineWithFieldOffsets(source.plainLine, options?.fieldSeparator)
  const cellTexts = cells.map((c) => c.text)
  const startIndex = explanationCellStartIndex(cellTexts)
  if (startIndex < 0) return null

  if (source.kind === 'table') {
    const explanationCells = source.cells.slice(startIndex)
    return tableCellsToExplanationDoc(explanationCells)
  }

  return extractExplanationDocFromBlock(source.block, source.plainLine, options)
}

function walkForAnswerRowSources(node: PMNode, rows: AnswerRowSource[]): void {
  if (!node?.type) return
  const t = node.type
  if (t === 'table' && node.content) {
    for (const row of node.content) {
      if (row.type !== 'tableRow' || !row.content) continue
      const cells = row.content.filter(isTableCellNode)
      const parts = cells.map((cell) =>
        answerDocInlinePlainText(cell).replace(/\r\n/g, ' ').replace(/\n/g, ' ').replace(/\r/g, ' ')
      )
      if (parts.length > 0) {
        rows.push({ kind: 'table', cells, plainLine: parts.join('\t') })
      }
    }
    return
  }
  if (t === 'paragraph' || t === 'heading' || t === 'codeBlock') {
    const plainLine = answerDocInlinePlainText(node).replace(/\r\n/g, '\n').replace(/\r/g, '\n')
    rows.push({ kind: 'block', block: node, plainLine })
    return
  }
  if (t === 'orderedList' || t === 'bulletList' || t === 'blockquote' || t === 'listItem') {
    if (node.content) {
      for (const child of node.content) walkForAnswerRowSources(child as PMNode, rows)
    }
    return
  }
  if (node.content && Array.isArray(node.content)) {
    for (const child of node.content) walkForAnswerRowSources(child as PMNode, rows)
  }
}

function collectAnswerRowSources(doc: Json | null | undefined): AnswerRowSource[] {
  if (!doc || typeof doc !== 'object' || (doc as PMNode).type !== 'doc') return []
  const root = doc as PMNode
  if (!root.content) return []
  const rows: AnswerRowSource[] = []
  for (const child of root.content) {
    walkForAnswerRowSources(child as PMNode, rows)
  }
  return rows
}

function explanationDocFromPlainFallback(explanation: string): Json | null {
  const trimmed = explanation.trim()
  if (!trimmed) return null
  return tokenizedPlainTextToProseMirror(trimmed) as Json
}

function resolveExplanationDoc(
  richDoc: Json | null,
  plainExplanation: string
): Json | null {
  if (richDoc && hasRichTextContent(richDoc)) return richDoc
  return explanationDocFromPlainFallback(plainExplanation)
}

/** Data-row explanation docs aligned with {@link parseAnswersTable} output order. */
export function extractAnswerExplanationDocsFromDoc(
  doc: Json | null | undefined,
  options?: AnswerParseOptions
): (Json | null)[] {
  const lines = getAnswerDocPlainLinesFromJson(doc)
  const rowKinds = getAnswerLineRowKindsFromLines(lines, options)
  const sources = collectAnswerRowSources(doc)
  if (sources.length !== lines.length) {
    return []
  }

  const docs: (Json | null)[] = []
  for (let i = 0; i < lines.length; i += 1) {
    if (rowKinds[i] !== 'data') continue
    const line = lines[i] ?? ''
    const cells = splitLineWithFieldOffsets(line, options?.fieldSeparator).map((c) => c.text)
    if (isAnswersHeaderRowCells(cells)) continue
    const source = sources[i]
    if (!source) continue
    docs.push(extractExplanationDocFromSource(source, options))
  }
  return docs
}

/** Per-token explanation docs for Decision Making table rows (Y/N or letter + explanation). */
export function extractDecisionMakingTokenExplanationDocsFromDoc(
  doc: Json | null | undefined,
  options?: AnswerParseOptions
): { questionNumber: number; explanationDoc: Json | null; plainExplanation: string }[] {
  const lines = getAnswerDocPlainLinesFromJson(doc)
  const rowKinds = getAnswerLineRowKindsFromLines(lines, options)
  const sources = collectAnswerRowSources(doc)
  if (sources.length !== lines.length) return []

  const out: { questionNumber: number; explanationDoc: Json | null; plainExplanation: string }[] = []
  for (let i = 0; i < lines.length; i += 1) {
    if (rowKinds[i] !== 'data') continue
    const line = lines[i] ?? ''
    const cells = splitLineWithFieldOffsets(line, options?.fieldSeparator).map((c) => c.text)
    if (isAnswersHeaderRowCells(cells)) continue
    const trimmed = cells.map((c) => c.trim())
    const num = Number.parseInt(trimmed[0] ?? '', 10)
    if (Number.isNaN(num) || num < 1 || num > 999) continue
    const source = sources[i]
    if (!source) continue
    const richDoc = extractExplanationDocFromSource(source, options)
    const plainExplanation =
      trimmed.length >= 3 ? trimmed.slice(2).join('\t').trim() : trimmed.slice(1).join('\t').trim()
    out.push({ questionNumber: num, explanationDoc: richDoc, plainExplanation })
  }
  return out
}

export function parseAnswersTableFromDoc(
  doc: Json | null | undefined,
  options?: AnswerParseOptions
): ParsedAnswerRowRich[] {
  const plain = answerDocToPlainTsv(doc)
  const parsed = parseAnswersTable(plain, options)
  const explanationDocs = extractAnswerExplanationDocsFromDoc(doc, options)
  return parsed.map((row, index) => ({
    ...row,
    explanationDoc: resolveExplanationDoc(explanationDocs[index] ?? null, row.explanation),
  }))
}

export type ParsedDecisionMakingAnswerRich = {
  letter?: string
  pattern?: string
  explanation?: string
  explanationDoc?: Json | null
  optionExplanations?: string[]
  optionExplanationDocs?: (Json | null)[]
}

export function parseDecisionMakingAnswersFromDoc(
  doc: Json | null | undefined,
  questionTypes: ('syllogism' | 'multiple_choice')[],
  options?: AnswerParseOptions
): ParsedDecisionMakingAnswerRich[] {
  const plain = answerDocToPlainTsv(doc)
  const parsed = parseDecisionMakingAnswers(plain, questionTypes, options)
  const tokenDocs = extractDecisionMakingTokenExplanationDocsFromDoc(doc, options)

  const docsByQuestion = new Map<number, { explanationDoc: Json | null; plainExplanation: string }[]>()
  for (const token of tokenDocs) {
    const list = docsByQuestion.get(token.questionNumber) ?? []
    list.push({ explanationDoc: token.explanationDoc, plainExplanation: token.plainExplanation })
    docsByQuestion.set(token.questionNumber, list)
  }

  const sortedQuestions = Array.from(docsByQuestion.keys()).sort((a, b) => a - b)

  return parsed.map((row, index) => {
    const qNum = sortedQuestions[index]
    const tokenEntries = qNum != null ? docsByQuestion.get(qNum) ?? [] : []
    const type = questionTypes[index]

    if (type === 'syllogism' && row.optionExplanations) {
      const optionExplanationDocs = row.optionExplanations.map((plain, optIndex) =>
        resolveExplanationDoc(
          tokenEntries[optIndex]?.explanationDoc ?? null,
          plain
        )
      )
      return { ...row, optionExplanationDocs }
    }

    if (row.explanation != null) {
      const explanationDoc = resolveExplanationDoc(
        tokenEntries.find((entry) => entry.plainExplanation.trim().length > 0)?.explanationDoc ??
          tokenEntries[0]?.explanationDoc ??
          null,
        row.explanation
      )
      return { ...row, explanationDoc }
    }

    return row
  })
}
