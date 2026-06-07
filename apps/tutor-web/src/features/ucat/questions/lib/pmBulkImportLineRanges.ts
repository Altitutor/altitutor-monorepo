/**
 * ProseMirror {@link Node} text ranges for each logical line in {@link getBulkImportLogicalLines},
 * for in-editor parse highlight decorations.
 */
import type { Json } from '@altitutor/shared'
import type { Node } from '@tiptap/pm/model'
import { getBulkImportLogicalLines } from '@/features/ucat/questions/components/bulk-import/bulkImportLogicalLines'
import type { BulkImportParseSection } from '@/features/ucat/questions/components/bulk-import/bulkImportLogicalLines'
import {
  collectLogicalLinesFromDoc,
  type PMNode,
  extractOptionLinesFromTable,
  extractQuestionRowFromNestedTable,
  isOptionsTable,
  isQuestionTableWithNestedOptions,
  nodeToText,
} from '@/features/ucat/questions/lib/parsers/core'

type RSt = {
  lines: string[]
  ranges: { from: number; to: number }[]
  prefixForNextLine?: string
  detectNested?: boolean
}

function isBlank(s: string): boolean {
  return s.trim().length === 0
}

/** Position immediately before the child at `index` in `parent`. */
export function beforeChild(parent: Node, pBefore: number, index: number): number {
  let p = pBefore + 1
  for (let i = 0; i < index; i += 1) p += parent.child(i).nodeSize
  return p
}

/**
 * Text range covering this node's inline content (same as `doc.textBetween(from, to)`).
 * `pBefore` is the document position at the **start** of this node (first position inside
 * the node), as returned by {@link beforeChild}.
 */
export function inner(n: Node, pBefore: number): { from: number; to: number } {
  if (n.isTextblock) {
    return { from: pBefore, to: pBefore + n.nodeSize - 1 }
  }
  if (n.childCount === 0) return { from: pBefore + 1, to: pBefore + 1 }
  return { from: pBefore + 1, to: pBefore + n.nodeSize - 1 }
}

/**
 * Ranges for each logical import line, or `null` if the PM walk could not
 * match the same lines (then skip in-editor question highlights).
 */
export function collectQuestionLineTextRanges(
  root: Node,
  section: BulkImportParseSection,
  options?: { questionsOnly?: boolean }
): { from: number; to: number }[] | null {
  if (root.type.name !== 'doc' || !root.isBlock) {
    return null
  }
  const questionsOnly = options?.questionsOnly === true
  const j = root.toJSON() as unknown as Json
  const expect = questionsOnly
    ? collectLogicalLinesFromDoc(j, {
        detectNestedQuestionTables: section !== 'quantitative_reasoning',
      })
    : getBulkImportLogicalLines(j, section)
  if (expect.length === 0) return []

  const st: RSt = {
    lines: [],
    ranges: [],
    detectNested: questionsOnly
      ? section !== 'quantitative_reasoning'
      : section === 'verbal_reasoning' || section === 'situational_judgement',
  }

  if (!questionsOnly && section === 'quantitative_reasoning') {
    runQrFromDoc(root, st)
  } else {
    walkVrDmSj(root, 0, st)
  }

  if (st.lines.length !== expect.length) return null
  for (let i = 0; i < expect.length; i += 1) {
    if (st.lines[i] !== expect[i]) return null
  }
  return st.ranges
}

function walkVrDmSj(n: Node, pBefore: number, st: RSt): void {
  const t = n.type.name
  const j = n.toJSON() as PMNode

  if (t === 'image') {
    if (!isBlank(nodeToText(j).trim() ?? '')) {
      st.lines.push((st.prefixForNextLine ?? '') + (nodeToText(j).trim() as string))
      st.ranges.push({ from: pBefore, to: pBefore + n.nodeSize })
      st.prefixForNextLine = undefined
    }
    return
  }

  if (t === 'table' && st.detectNested) {
    for (let r = 0; r < n.childCount; r += 1) {
      const rowPm = n.child(r)
      const pRow = beforeChild(n, pBefore, r)
      const rowJ = (j.content as PMNode[] | undefined)?.[r] as PMNode
      if (!rowJ) continue
      const extracted = extractQuestionRowFromNestedTable(rowJ)
      if (extracted) {
        const { qNum, qText, optionLines } = extracted
        st.lines.push((st.prefixForNextLine ?? '') + `${qNum}.`)
        const c0 = rowPm.child(0)
        st.ranges.push(inner(c0, beforeChild(rowPm, pRow, 0)))
        st.prefixForNextLine = undefined
        if (qText.length > 0) {
          st.lines.push(qText)
          const c1 = rowPm.child(1)
          const pC1 = beforeChild(rowPm, pRow, 1)
          st.ranges.push(textBeforeNestedTableInCell2(c1, pC1))
        }
        const nestedT = findNestedTableInCell1(rowPm)
        if (nestedT) {
          const pNt = beforeChildInParent(rowPm, pRow, 1, nestedT.index)
          for (let oi = 0; oi < optionLines.length; oi += 1) {
            st.lines.push(optionLines[oi] ?? '')
            const ntr = nestedT.table.child(oi)
            const pTr = beforeChild(nestedT.table, pNt, oi)
            st.ranges.push({ from: pTr, to: pTr + ntr.nodeSize })
          }
        } else {
          const c1b = rowPm.child(1)
          const pC1b = beforeChild(rowPm, pRow, 1)
          for (const opt of optionLines) {
            st.lines.push(opt)
            st.ranges.push(inner(c1b, pC1b))
          }
        }
        continue
      }
      const cells = Array.isArray(rowJ?.content) ? rowJ.content : []
      for (let ci = 0; ci < rowPm.childCount; ci += 1) {
        const cellPm = rowPm.child(ci)
        const cellJ = cells[ci] as PMNode | undefined
        appendPmLinesFromTableCell(cellPm, cellJ, beforeChild(rowPm, pRow, ci), st)
      }
    }
    return
  }

  if (t === 'table' && !st.detectNested) {
    for (let r = 0; r < n.childCount; r += 1) {
      const tr = n.child(r)
      const pRow = beforeChild(n, pBefore, r)
      for (let c = 0; c < tr.childCount; c += 1) {
        const cell = tr.child(c)
        const cellJ = ((j.content as PMNode[] | undefined)?.[r] as PMNode | undefined)
          ?.content?.[c] as PMNode
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
      walkVrDmSj(it, pIt, st)
    }
    return
  }

  if (t === 'paragraph') {
    const tx = nodeToText(j).trim()
    if (tx.length > 0) {
      st.lines.push((st.prefixForNextLine ?? '') + tx)
      st.ranges.push(inner(n, pBefore))
      st.prefixForNextLine = undefined
    }
    return
  }

  for (let i = 0; i < n.childCount; i += 1) {
    walkVrDmSj(n.child(i), beforeChild(n, pBefore, i), st)
  }
}

/** Mirror {@link appendLinesFromTableCell} so PM ranges stay aligned with logical lines. */
function appendPmLinesFromTableCell(
  cellPm: Node,
  cellJ: PMNode | undefined,
  pCell: number,
  st: RSt
): void {
  if (!cellJ) {
    const tx = cellPm.textContent.trim()
    if (tx.length > 0) {
      st.lines.push((st.prefixForNextLine ?? '') + tx)
      st.ranges.push(inner(cellPm, pCell))
      st.prefixForNextLine = undefined
    }
    return
  }

  if (cellJ.type === 'table') {
    walkVrDmSj(cellPm, pCell, st)
    return
  }

  const content = Array.isArray(cellJ.content) ? cellJ.content : []
  let pushed = false
  for (let i = 0; i < content.length; i += 1) {
    const cJ = content[i] as PMNode
    if (i >= cellPm.childCount) break
    const cPm = cellPm.child(i)
    const pChild = beforeChild(cellPm, pCell, i)

    if (cJ.type === 'table') {
      walkVrDmSj(cPm, pChild, st)
      pushed = true
    } else if (cJ.type === 'paragraph') {
      const tx = nodeToText(cJ).trim()
      if (tx.length > 0) {
        st.lines.push((st.prefixForNextLine ?? '') + tx)
        st.ranges.push(inner(cPm, pChild))
        st.prefixForNextLine = undefined
        pushed = true
      }
    } else if (Array.isArray(cJ.content) && cJ.content.length > 0) {
      appendPmLinesFromTableCell(cPm, cJ, pChild, st)
      pushed = true
    }
  }

  if (!pushed) {
    const tx = nodeToText(cellJ).trim()
    if (tx.length > 0) {
      st.lines.push((st.prefixForNextLine ?? '') + tx)
      st.ranges.push(inner(cellPm, pCell))
      st.prefixForNextLine = undefined
    }
  }
}

function findNestedTableInCell1(
  tr: Node
): { table: Node; index: number } | null {
  if (tr.childCount < 2) return null
  const c1 = tr.child(1)
  for (let i = 0; i < c1.childCount; i += 1) {
    const ch = c1.child(i)
    if (ch.type.name === 'table') return { table: ch, index: i }
  }
  return null
}

function beforeChildInParent(
  rowPm: Node,
  pRow: number,
  cell1Index: number,
  childIndexInCell: number
): number {
  const c1 = rowPm.child(cell1Index)
  const pC1 = beforeChild(rowPm, pRow, cell1Index)
  return beforeChild(c1, pC1, childIndexInCell)
}

function textBeforeNestedTableInCell2(cell: Node, pCell: number): { from: number; to: number } {
  if (cell.type.name !== 'tableCell' && cell.type.name !== 'tableHeader') {
    return inner(cell, pCell)
  }
  let first = -1
  let last = -1
  for (let i = 0; i < cell.childCount; i += 1) {
    const ch = cell.child(i)
    if (ch.type.name === 'table') break
    if (ch.isTextblock) {
      const r = inner(ch, beforeChild(cell, pCell, i))
      if (first < 0) first = r.from
      last = r.to
    }
  }
  if (first >= 0) return { from: first, to: last }
  return inner(cell, pCell)
}

let qrTableN = 0

function runQrFromDoc(root: Node, st: RSt): void {
  qrTableN = 0
  for (let i = 0; i < root.childCount; i += 1) {
    walkQrNode(root.child(i), beforeChild(root, 0, i), st)
  }
}

function walkQrNode(n: Node, pBefore: number, st: RSt): void {
  const t = n.type.name
  const j = n.toJSON() as PMNode

  if (t === 'image') {
    if (nodeToText(j).trim().length > 0) {
      st.lines.push((st.prefixForNextLine ?? '') + nodeToText(j).trim())
      st.ranges.push({ from: pBefore, to: pBefore + n.nodeSize })
      st.prefixForNextLine = undefined
    }
    return
  }

  if (t === 'table') {
    if (isQuestionTableWithNestedOptions(j as PMNode)) {
      for (let r = 0; r < n.childCount; r += 1) {
        const tr = n.child(r)
        const pRow = beforeChild(n, pBefore, r)
        const ext = extractQuestionRowFromNestedTable(
          (j.content as PMNode[])[r] as PMNode
        )
        if (!ext) continue
        const { qText, optionLines, qNum } = ext
        st.lines.push((st.prefixForNextLine ?? '') + `${qNum}.`)
        st.ranges.push(
          inner(tr.child(0), beforeChild(tr, pRow, 0))
        )
        st.prefixForNextLine = undefined
        if (qText.length > 0) {
          st.lines.push(qText)
          st.ranges.push(
            textBeforeNestedTableInCell2(tr.child(1), beforeChild(tr, pRow, 1))
          )
        }
        const nest = findNestedTableInCell1(tr)
        if (nest) {
          const pNt = beforeChildInParent(tr, pRow, 1, nest.index)
          for (let oi = 0; oi < optionLines.length; oi += 1) {
            st.lines.push(optionLines[oi] ?? '')
            const ntr = nest.table.child(oi)
            const pTr = beforeChild(nest.table, pNt, oi)
            st.ranges.push({ from: pTr, to: pTr + ntr.nodeSize })
          }
        } else {
          for (const o of optionLines) {
            st.lines.push(o)
            st.ranges.push(inner(tr.child(1), beforeChild(tr, pRow, 1)))
          }
        }
      }
      return
    }

    const rowGrid = (Array.isArray(j.content) ? j.content : []).map((row) => {
      const rContent = (row as PMNode)?.content
      const cells = Array.isArray(rContent) ? rContent : []
      return cells.map((c) => nodeToText(c as PMNode).trim())
    })
    if (isOptionsTable(rowGrid)) {
      const optLines = extractOptionLinesFromTable(rowGrid)
      for (let i = 0; i < optLines.length; i += 1) {
        const line = optLines[i] ?? ''
        if (i === 0 && st.prefixForNextLine) {
          st.lines.push(st.prefixForNextLine + line)
          st.prefixForNextLine = undefined
        } else {
          st.lines.push(line)
        }
        if (i < n.childCount) {
          const tr = n.child(i)
          const pR = beforeChild(n, pBefore, i)
          st.ranges.push({ from: pR, to: pR + tr.nodeSize })
        } else {
          st.ranges.push({ from: pBefore, to: pBefore + n.nodeSize })
        }
      }
      return
    }

    qrTableN += 1
    const id = `t${qrTableN}`
    st.lines.push((st.prefixForNextLine ?? '') + `[[TABLE:${id}]]`)
    st.ranges.push({ from: pBefore, to: pBefore + n.nodeSize })
    st.prefixForNextLine = undefined
    return
  }

  if (t === 'orderedList') {
    for (let i = 0; i < n.childCount; i += 1) {
      walkQrNode(n.child(i), beforeChild(n, pBefore, i), st)
    }
    return
  }

  if (t === 'paragraph') {
    const tx = nodeToText(j).trim()
    if (tx.length > 0) {
      st.lines.push((st.prefixForNextLine ?? '') + tx)
      st.ranges.push(inner(n, pBefore))
      st.prefixForNextLine = undefined
    }
    return
  }

  for (let i = 0; i < n.childCount; i += 1) {
    walkQrNode(n.child(i), beforeChild(n, pBefore, i), st)
  }
}