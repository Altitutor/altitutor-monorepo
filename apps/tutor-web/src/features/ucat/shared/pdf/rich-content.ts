import type { Json } from '@altitutor/shared'

type RichNode = Record<string, unknown>

export function hasRichContent(value: Json | null | undefined): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const node = value as RichNode
  if (typeof node.text === 'string' && node.text.trim().length > 0) return true
  if (node.type === 'image' && typeof (node.attrs as RichNode | undefined)?.src === 'string') {
    return true
  }
  if (!Array.isArray(node.content)) return false
  return node.content.some((child) => hasRichContent(child as Json))
}
