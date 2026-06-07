import type { Node } from '@tiptap/pm/model'
import { beforeChild, inner } from '@/features/ucat/questions/lib/pmBulkImportLineRanges'

/** One range per top-level block (paragraph) in document order. */
export function collectPlainDocParagraphRanges(root: Node): { from: number; to: number }[] {
  if (root.type.name !== 'doc' || !root.isBlock) return []
  const ranges: { from: number; to: number }[] = []
  let pBefore = 0
  for (let i = 0; i < root.childCount; i += 1) {
    const child = root.child(i)
    const start = beforeChild(root, pBefore, i)
    ranges.push(inner(child, start))
    pBefore = start
  }
  return ranges
}
