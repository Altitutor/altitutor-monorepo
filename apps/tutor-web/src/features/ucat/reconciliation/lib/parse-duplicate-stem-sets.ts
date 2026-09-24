import type { Json } from '@altitutor/shared'
import { proseMirrorToPlainText } from '@/features/ucat/shared/lib/rich-text'

export type DuplicateStemSetRef = {
  id: string | null
  name: string
}

export function parseDuplicateStemSets(
  setNamesRaw: unknown,
  setIdsRaw: unknown,
): DuplicateStemSetRef[] {
  const setIds = Array.isArray(setIdsRaw)
    ? setIdsRaw.filter((id): id is string => typeof id === 'string' && id.length > 0)
    : []
  const setNames = Array.isArray(setNamesRaw) ? setNamesRaw : []

  if (setIds.length > 0) {
    return setIds.map((id, index) => ({
      id,
      name: proseMirrorToPlainText(setNames[index] as Json) || 'Untitled',
    }))
  }

  return setNames
    .map((name) => proseMirrorToPlainText(name as Json)?.trim() || '')
    .filter(Boolean)
    .map((name) => ({
      id: null,
      name,
    }))
}
