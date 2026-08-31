import type { Json } from '@altitutor/shared'
import { proseMirrorToPlainText } from '@/features/ucat/shared/lib/rich-text'

export type SetTableNameInput = {
  name?: unknown
  display_name?: string | null
  compact_display_name?: string | null
  authoring_note?: string | null
}

export function resolveSetTableName(row: SetTableNameInput): string {
  return (
    (row.display_name ??
      row.compact_display_name ??
      row.authoring_note ??
      proseMirrorToPlainText((row.name ?? null) as Json | null)) ||
    '—'
  )
}
