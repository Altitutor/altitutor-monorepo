import type { Json } from '@altitutor/shared'
import type { UcatQuestionSetPayload } from '@/features/ucat/shared/types'
import { ucatSetsApi } from '@/features/ucat/sets/api/sets'
import { plainTextToProseMirror, proseMirrorToPlainText } from '@/features/ucat/shared/lib/rich-text'

export type SetDetailLike = {
  name?: Json | null
  description?: Json | null
  time_limit_seconds?: number | null
  access_scope?: 'public' | 'private' | null
  stems?: unknown
}

export function parseSetStemIds(stems: unknown): string[] {
  const arr = (stems as Array<{ stem_id: string }> | null) ?? []
  return arr.map((stem) => stem.stem_id)
}

export function setDetailToUpdatePayload(
  detail: SetDetailLike,
  overrides?: Partial<Pick<UcatQuestionSetPayload, 'accessScope' | 'stemIds' | 'timeLimitSeconds' | 'description'>>,
): UcatQuestionSetPayload {
  return {
    name: detail.name ?? plainTextToProseMirror(''),
    description: overrides?.description ?? proseMirrorToPlainText(detail.description ?? null) ?? '',
    timeLimitSeconds: overrides?.timeLimitSeconds ?? detail.time_limit_seconds ?? null,
    accessScope: overrides?.accessScope ?? detail.access_scope ?? 'public',
    stemIds: overrides?.stemIds ?? parseSetStemIds(detail.stems),
  }
}

export async function removeStemsFromSets(
  stemIds: string[],
  setIds: string[],
  updateSet: (args: { setId: string; payload: UcatQuestionSetPayload }) => Promise<unknown>,
): Promise<void> {
  const removeSet = new Set(stemIds)
  await Promise.all(
    setIds.map(async (setId) => {
      const setDetail = await ucatSetsApi.detail(setId)
      if (!setDetail) return
      const currentIds = parseSetStemIds(setDetail.stems)
      const newStemIds = currentIds.filter((id) => !removeSet.has(id))
      if (newStemIds.length === currentIds.length) return
      await updateSet({
        setId,
        payload: setDetailToUpdatePayload(setDetail, { stemIds: newStemIds }),
      })
    }),
  )
}
