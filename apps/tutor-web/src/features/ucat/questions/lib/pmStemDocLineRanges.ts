import type { Json } from '@altitutor/shared'
import type { Node } from '@tiptap/pm/model'
import {
  collectLogicalLinesFromDoc,
  nodeToText,
  type PMNode,
} from '@/features/ucat/questions/lib/parsers/core'
import { beforeChild, inner } from '@/features/ucat/questions/lib/pmBulkImportLineRanges'

/** One range per top-level block (paragraph) in document order. */
export function collectPlainDocParagraphRanges(root: Node): { from: number; to: number }[] {
  if (root.type.name !== 'doc' || !root.isBlock) return []
  const ranges: { from: number; to: number }[] = []
  for (let i = 0; i < root.childCount; i += 1) {
    const child = root.child(i)
    const start = beforeChild(root, 0, i)
    ranges.push(inner(child, start))
  }
  return ranges
}

type StemLineWalkState = {
  lines: string[]
  ranges: { from: number; to: number }[]
  prefixForNextLine?: string
}

function walkStemDocNode(n: Node, pBefore: number, st: StemLineWalkState): void {
  const t = n.type.name
  const j = n.toJSON() as PMNode

  if (t === 'image') {
    const text = nodeToText(j).trim()
    if (text.length > 0) {
      st.lines.push((st.prefixForNextLine ?? '') + text)
      st.ranges.push({ from: pBefore, to: pBefore + n.nodeSize })
      st.prefixForNextLine = undefined
    }
    return
  }

  if (t === 'table') {
    for (let r = 0; r < n.childCount; r += 1) {
      const tr = n.child(r)
      const pRow = beforeChild(n, pBefore, r)
      const rowJ = (j.content as PMNode[] | undefined)?.[r] as PMNode | undefined
      for (let c = 0; c < tr.childCount; c += 1) {
        const cell = tr.child(c)
        const cellJ = rowJ?.content?.[c] as PMNode | undefined
        const tx = (cellJ ? nodeToText(cellJ) : cell.textContent).trim()
        if (tx.length > 0) {
          st.lines.push((st.prefixForNextLine ?? '') + tx)
          st.ranges.push(inner(cell, beforeChild(tr, pRow, c)))
          st.prefixForNextLine = undefined
        }
      }
    }
    return
  }

  if (t === 'orderedList') {
    for (let i = 0; i < n.childCount; i += 1) {
      const it = n.child(i)
      const pIt = beforeChild(n, pBefore, i)
      st.prefixForNextLine = `${i + 1}. `
      walkStemDocNode(it, pIt, st)
    }
    return
  }

  if (t === 'paragraph') {
    const tx = nodeToText(j).trim()
    if (tx.length > 0) {
      st.lines.push((st.prefixForNextLine ?? '') + tx)
      st.ranges.push(inner(n, pBefore))
      st.prefixForNextLine = undefined
    } else {
      st.lines.push('')
      st.ranges.push(inner(n, pBefore))
      st.prefixForNextLine = undefined
    }
    return
  }

  for (let i = 0; i < n.childCount; i += 1) {
    walkStemDocNode(n.child(i), beforeChild(n, pBefore, i), st)
  }
}

/**
 * ProseMirror text ranges for each logical stem line (matches
 * {@link collectLogicalLinesFromDoc} with `preserveBlankLines: true`).
 */
export function collectStemLogicalLineRanges(
  root: Node
): { from: number; to: number }[] | null {
  if (root.type.name !== 'doc' || !root.isBlock) return null

  const j = root.toJSON() as unknown as Json
  const expect = collectLogicalLinesFromDoc(j, {
    detectNestedQuestionTables: false,
    preserveBlankLines: true,
  })
  if (expect.length === 0) return []

  const st: StemLineWalkState = { lines: [], ranges: [] }
  for (let i = 0; i < root.childCount; i += 1) {
    walkStemDocNode(root.child(i), beforeChild(root, 0, i), st)
  }

  if (st.lines.length !== expect.length) return null
  for (let i = 0; i < expect.length; i += 1) {
    if (st.lines[i] !== expect[i]) return null
  }
  return st.ranges
}
