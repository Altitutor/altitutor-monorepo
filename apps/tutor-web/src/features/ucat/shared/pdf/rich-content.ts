import type { Json } from '@altitutor/shared'

type RichNode = Record<string, unknown>

export function hasRichContent(value: Json | null | undefined): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const node = value as RichNode
  if (typeof node.text === 'string' && node.text.trim().length > 0) return true
  if (node.type === 'image' && typeof (node.attrs as RichNode | undefined)?.src === 'string') {
    return true
  }
  if (node.type === 'inlineMath' || node.type === 'blockMath') {
    const latex = (node.attrs as RichNode | undefined)?.latex
    return typeof latex === 'string' && latex.trim().length > 0
  }
  if (!Array.isArray(node.content)) return false
  return node.content.some((child) => hasRichContent(child as Json))
}
