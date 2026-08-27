import type { Json } from '@altitutor/shared'
import { proseMirrorToPlainText } from '@/features/ucat/shared/lib/rich-text'

export type ContentChangeDiffRow = {
  field: string
  before: string
  after: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value)
}

function isProseMirrorDocument(value: unknown): boolean {
  return isRecord(value) && value.type === 'doc' && Array.isArray(value.content)
}

function displayValue(value: unknown): string {
  if (value == null || value === '') return 'Empty'
  if (isProseMirrorDocument(value)) return proseMirrorToPlainText(value as Json).trim() || 'Empty'
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  return JSON.stringify(value, null, 2)
}

function labelFor(path: string): string {
  return path
    .replaceAll(/\.([0-9]+)(?=\.|$)/g, ' #$1')
    .replaceAll('.', ' › ')
    .replaceAll('_', ' ')
    .replaceAll(/([a-z])([A-Z])/g, '$1 $2')
}

function valuesEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

function collectRows(
  before: unknown,
  after: unknown,
  path: string,
  rows: ContentChangeDiffRow[],
): void {
  if (valuesEqual(before, after)) return
  if (isProseMirrorDocument(before) || isProseMirrorDocument(after)) {
    rows.push({ field: labelFor(path), before: displayValue(before), after: displayValue(after) })
    return
  }
  if (isRecord(before) && isRecord(after)) {
    const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort()
    for (const key of keys) collectRows(before[key], after[key], path ? `${path}.${key}` : key, rows)
    return
  }
  if (Array.isArray(before) && Array.isArray(after)) {
    const maxLength = Math.max(before.length, after.length)
    for (let index = 0; index < maxLength; index += 1) {
      collectRows(before[index], after[index], path ? `${path}.${index + 1}` : String(index + 1), rows)
    }
    return
  }
  rows.push({ field: labelFor(path), before: displayValue(before), after: displayValue(after) })
}

export function contentChangeDiff(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): ContentChangeDiffRow[] {
  const rows: ContentChangeDiffRow[] = []
  collectRows(before, after, '', rows)
  return rows
}
