import type { Json } from '@altitutor/shared'
import type { UcatQuestionSetPayload } from '@/features/ucat/shared/types'
import { proseMirrorToPlainText } from '@/features/ucat/shared/lib/rich-text'

export type SetDetailLike = {
  authoring_note?: string | null
  description?: Json | null
  timing_mode?: UcatQuestionSetPayload['timingMode'] | null
  pace_multiplier?: number | null
  fixed_time_limit_seconds?: number | null
  set_format?: UcatQuestionSetPayload['setFormat'] | null
  access_scope?: 'public' | 'private' | null
  section_id?: string | null
  reference_blueprint_id?: string | null
  stems?: unknown
}

export function parseSetStemIds(stems: unknown): string[] {
  const arr = (stems as Array<{ stem_id: string }> | null) ?? []
  return arr.map((stem) => stem.stem_id)
}

export function setDetailToUpdatePayload(
  detail: SetDetailLike,
  overrides?: Partial<Pick<UcatQuestionSetPayload,
    'authoringNote' | 'accessScope' | 'stemIds' | 'timingMode' | 'paceMultiplier' |
    'fixedTimeLimitSeconds' | 'setFormat' | 'description' | 'sectionId' |
    'referenceBlueprintId'>>,
): UcatQuestionSetPayload {
  const sectionId = overrides?.sectionId ?? detail.section_id
  if (!sectionId) throw new Error('Set section is required')
  const referenceBlueprintId = overrides?.referenceBlueprintId ?? detail.reference_blueprint_id
  if (!referenceBlueprintId) throw new Error('Set reference blueprint is required')
  return {
    authoringNote: overrides?.authoringNote ?? detail.authoring_note ?? null,
    description: overrides?.description ?? proseMirrorToPlainText(detail.description ?? null) ?? '',
    timingMode: overrides?.timingMode ?? detail.timing_mode ?? 'pace',
    paceMultiplier: overrides?.paceMultiplier ?? detail.pace_multiplier ?? null,
    fixedTimeLimitSeconds:
      overrides?.fixedTimeLimitSeconds ?? detail.fixed_time_limit_seconds ?? null,
    setFormat: overrides?.setFormat ?? detail.set_format ?? 'partial_section',
    accessScope: overrides?.accessScope ?? detail.access_scope ?? 'public',
    sectionId,
    referenceBlueprintId,
    stemIds: overrides?.stemIds ?? parseSetStemIds(detail.stems),
  }
}
