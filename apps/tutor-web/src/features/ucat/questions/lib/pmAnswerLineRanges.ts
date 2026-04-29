/**
 * ProseMirror line ranges for pasted "answer TSV" documents (parallel to
 * {@link getAnswerDocPlainLinesFromJson} and {@link parseAnswersTable} input).
 */
import type { Json } from '@altitutor/shared'
import type { Node } from '@tiptap/pm/model'
import {
  type PMNode,
  nodeToText,
} from '@/features/ucat/questions/lib/parsers/core'
import { splitLineWithTabOffsets } from '@/features/ucat/questions/lib/parseAnswersTable'
import { beforeChild, inner } from '@/features/ucat/questions/lib/pmBulkImportLineRanges'

/**
 * Flatten PM JSON nodes for answer TSV export without inserting spaces between siblings.
 * {@link nodeToText} joins inline children with spaces (join(' ')), which destroys pasted
 * tab characters when TipTap represents one logical TSV row as multiple adjacent text nodes.
 */
export function answerDocInlinePlainText(node: PMNode | null | undefined): string {
  if (!node?.type) return ''
  if (node.type === 'image') return nodeToText(node)
  if (typeof node.text === 'string') return node.text
  if (node.type === 'hardBreak') return '\n'
  if (!Array.isArray(node.content) || node.content.length === 0) return ''
  return node.content.map((child) => answerDocInlinePlainText(child as PMNode)).join('')
}

/** How one logical TSV line maps into the ProseMirror doc (paragraph block vs HTML table row). */
export type AnswerLineRange =
  | { mode: 'block'; from: number; to: number }
  | { mode: 'tableRow'; row: Node; pRow: number }

/**
 * Map a character span in the flattened TSV `line` to one or more PM text ranges.
 * Table rows need per-cell mapping; single paragraphs use one contiguous block range.
 */
export function mapAnswerPasteSpanToDocRanges(
  mapping: AnswerLineRange,
  line: string,
  span: { start: number; end: number }
): { from: number; to: number }[] {
  const ss = Math.max(0, span.start)
  const se = Math.min(line.length, span.end)
  if (ss >= se) return []

  if (mapping.mode === 'block') {
    const from = mapping.from + ss
    const to = mapping.from + se
    if (from >= to) return []
    return [{ from, to }]
  }

  const { row, pRow } = mapping
  const tabCells = splitLineWithTabOffsets(line)
  const n = Math.min(tabCells.length, row.childCount)
  const out: { from: number; to: number }[] = []
  for (let ci = 0; ci < n; ci += 1) {
    const c = tabCells[ci]!
    const overlapFrom = Math.max(ss, c.start)
    const overlapTo = Math.min(se, c.end)
    if (overlapFrom >= overlapTo) continue

    const cellPm = row.child(ci)
    const pCell = beforeChild(row, pRow, ci)
    const ir = inner(cellPm, pCell)
    const relStart = overlapFrom - c.start
    const relEnd = overlapTo - c.start
    const docFrom = ir.from + relStart
    const docTo = ir.from + relEnd
    if (docFrom < docTo && docFrom >= ir.from && docTo <= ir.to) {
      out.push({ from: docFrom, to: docTo })
    }
  }
  return out
}

/**
 * One logical TSV line per import row (used with {@link parseAnswersTable}).
 * Mirrors the PM walk in {@link collectAnswerLineTextRanges}.
 */
export function getAnswerDocPlainLinesFromJson(doc: Json | null | undefined): string[] {
  if (!doc || typeof doc !== 'object' || (doc as PMNode).type !== 'doc') {
    return []
  }
  const j = doc as PMNode
  if (!j.content) return []
  const lines: string[] = []
  for (const c of j.content) {
    walkJsonForAnswerLines(c as PMNode, lines)
  }
  return lines
}

function walkJsonForAnswerLines(n: PMNode, lines: string[]): void {
  if (!n?.type) return
  const t = n.type
  if (t === 'table' && n.content) {
    for (const row of n.content) {
      if (row.type !== 'tableRow' || !row.content) continue
      const parts: string[] = []
      for (const cell of row.content) {
        if (cell.type === 'tableCell' || cell.type === 'tableHeader') {
          parts.push(
            answerDocInlinePlainText(cell).replace(/\r\n/g, ' ').replace(/\n/g, ' ').replace(/\r/g, ' ')
          )
        }
      }
      if (parts.length > 0) {
        lines.push(parts.join('\t'))
      }
    }
    return
  }
  if (t === 'paragraph' || t === 'heading' || t === 'codeBlock') {
    const tx = answerDocInlinePlainText(n)
    lines.push(tx.replace(/\r\n/g, '\n').replace(/\r/g, '\n'))
    return
  }
  if (t === 'orderedList' || t === 'bulletList' || t === 'blockquote' || t === 'listItem') {
    if (n.content) {
      for (const c of n.content) walkJsonForAnswerLines(c, lines)
    }
    return
  }
  if (n.content && Array.isArray(n.content)) {
    for (const c of n.content) {
      walkJsonForAnswerLines(c, lines)
    }
  }
}

/**
 * Pasted-answers document to plain TSV string for {@link parseAnswersTable} (trimmed the same
 * as direct textarea input: outer trim is applied by the parser, not here).
 */
export function answerDocToPlainTsv(doc: Json | null | undefined): string {
  return getAnswerDocPlainLinesFromJson(doc).join('\n')
}

/**
 * Ranges in `root` for each TSV line, or `null` if the document walk and JSON
 * flattening disagree (no highlights, import still works via {@link answerDocToPlainTsv}).
 */
export function collectAnswerLineTextRanges(root: Node): AnswerLineRange[] | null {
  if (root.type.name !== 'doc' || !root.isBlock) {
    return null
  }
  const expect = getAnswerDocPlainLinesFromJson(root.toJSON() as Json)
  if (expect.length === 0) return []
  const st: { lines: string[]; ranges: AnswerLineRange[] } = {
    lines: [],
    ranges: [],
  }
  for (let i = 0; i < root.childCount; i += 1) {
    walkAnswerBlock(root.child(i), beforeChild(root, 0, i), st)
  }
  if (st.lines.length !== expect.length) return null
  for (let i = 0; i < expect.length; i += 1) {
    if (st.lines[i] !== expect[i]) return null
  }
  return st.ranges
}

function walkAnswerBlock(n: Node, pBefore: number, st: { lines: string[]; ranges: AnswerLineRange[] }): void {
  const t = n.type.name
  if (t === 'table') {
    for (let r = 0; r < n.childCount; r += 1) {
      const tr = n.child(r)
      const pRow = beforeChild(n, pBefore, r)
      const rowJ = tr.toJSON() as PMNode
      const parts: string[] = []
      if (rowJ.type === 'tableRow' && rowJ.content) {
        for (const cell of rowJ.content) {
          if (cell.type === 'tableCell' || cell.type === 'tableHeader') {
            const tx = answerDocInlinePlainText(cell).replace(/\r\n/g, ' ').replace(/\n/g, ' ').replace(/\r/g, ' ')
            parts.push(tx)
          }
        }
      } else {
        for (let c = 0; c < tr.childCount; c += 1) {
          const cell = tr.child(c)
          const tx = answerDocInlinePlainText(cell.toJSON() as PMNode)
            .replace(/\r\n/g, ' ')
            .replace(/\n/g, ' ')
            .replace(/\r/g, ' ')
          parts.push(tx)
        }
      }
      st.lines.push(parts.join('\t'))
      st.ranges.push({ mode: 'tableRow', row: tr, pRow })
    }
    return
  }
  if (t === 'paragraph' || t === 'heading' || t === 'codeBlock') {
    const tx = answerDocInlinePlainText(n.toJSON() as PMNode).replace(/\r\n/g, '\n').replace(/\r/g, '\n')
    st.lines.push(tx)
    st.ranges.push({ mode: 'block', ...inner(n, pBefore) })
    return
  }
  if (t === 'orderedList' || t === 'bulletList' || t === 'blockquote' || t === 'listItem') {
    for (let i = 0; i < n.childCount; i += 1) {
      walkAnswerBlock(n.child(i), beforeChild(n, pBefore, i), st)
    }
    return
  }
  for (let i = 0; i < n.childCount; i += 1) {
    walkAnswerBlock(n.child(i), beforeChild(n, pBefore, i), st)
  }
}
