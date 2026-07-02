import type { Json } from '@altitutor/shared'

/** Matches ucat-web RichContentBlock paragraph spacing for engine passages. */
export const UCAT_ENGINE_PARAGRAPH_SPACING_CLASSNAME =
  '[&_p]:!my-2 [&_p:first-child]:!mt-0 [&_p:last-child]:!mb-0'

type PmNode = {
  type?: string
  text?: string
  marks?: unknown
  content?: PmNode[]
  attrs?: Record<string, unknown>
}

function isBlockNode(node: PmNode): boolean {
  const type = node.type ?? ''
  return type === 'table' || type === 'bulletList' || type === 'orderedList' || type === 'heading'
}

/**
 * Splits paragraph nodes at hard breaks and newline characters so single line breaks
 * render as separate paragraphs (parity with ucat-web paragraphSpacing plain-text path).
 */
export function expandParagraphBreaksInDoc(doc: Json | Record<string, unknown> | null | undefined): Json {
  if (!doc || typeof doc !== 'object') {
    return { type: 'doc', content: [{ type: 'paragraph', content: [] }] }
  }

  const root = doc as PmNode
  if (root.type !== 'doc' || !Array.isArray(root.content)) {
    return doc as Json
  }

  const expandedContent: PmNode[] = []

  for (const block of root.content) {
    if (!block || typeof block !== 'object') continue
    if (isBlockNode(block) || block.type !== 'paragraph' || !Array.isArray(block.content)) {
      expandedContent.push(block)
      continue
    }

    const paragraphGroups: PmNode[][] = [[]]

    for (const inline of block.content) {
      if (!inline || typeof inline !== 'object') continue

      if (inline.type === 'hardBreak') {
        paragraphGroups.push([])
        continue
      }

      if (inline.type === 'text' && typeof inline.text === 'string' && inline.text.includes('\n')) {
        const segments = inline.text.split('\n')
        segments.forEach((segment, index) => {
          if (segment.length > 0) {
            const textNode: PmNode = { type: 'text', text: segment }
            if (inline.marks) textNode.marks = inline.marks
            paragraphGroups[paragraphGroups.length - 1]!.push(textNode)
          }
          if (index < segments.length - 1) {
            paragraphGroups.push([])
          }
        })
        continue
      }

      paragraphGroups[paragraphGroups.length - 1]!.push(inline)
    }

    if (paragraphGroups.length === 1 && paragraphGroups[0]!.length === block.content.length) {
      expandedContent.push(block)
      continue
    }

    for (const inlineContent of paragraphGroups) {
      expandedContent.push({
        type: 'paragraph',
        content: inlineContent.length > 0 ? inlineContent : [],
      })
    }
  }

  return { type: 'doc', content: expandedContent } as Json
}
