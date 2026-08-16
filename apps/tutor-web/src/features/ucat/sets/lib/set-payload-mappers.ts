import type { Json } from '@altitutor/shared'
import type { UcatQuestionSetPayload } from '@/features/ucat/shared/types'
import { plainTextToProseMirror, proseMirrorToPlainText } from '@/features/ucat/shared/lib/rich-text'

export type SetDetailLike = {
  name?: Json | null
  description?: Json | null
  time_limit_seconds?: number | null
  access_scope?: 'public' | 'private' | null
  section_id?: string | null
  stems?: unknown
}

export function parseSetStemIds(stems: unknown): string[] {
  const arr = (stems as Array<{ stem_id: string }> | null) ?? []
  return arr.map((stem) => stem.stem_id)
}

export function setDetailToUpdatePayload(
  detail: SetDetailLike,
  overrides?: Partial<Pick<UcatQuestionSetPayload, 'accessScope' | 'stemIds' | 'timeLimitSeconds' | 'description' | 'sectionId'>>,
): UcatQuestionSetPayload {
  const sectionId = overrides?.sectionId ?? detail.section_id
  if (!sectionId) throw new Error('Set section is required')
  return {
    name: detail.name ?? plainTextToProseMirror(''),
    description: overrides?.description ?? proseMirrorToPlainText(detail.description ?? null) ?? '',
    timeLimitSeconds: overrides?.timeLimitSeconds ?? detail.time_limit_seconds ?? null,
    accessScope: overrides?.accessScope ?? detail.access_scope ?? 'public',
    sectionId,
    stemIds: overrides?.stemIds ?? parseSetStemIds(detail.stems),
  }
}
