import { getSupabaseClient } from '@/shared/lib/supabase/client'
import type { Database } from '@altitutor/shared'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { UcatContentStatus, UcatQuestionSetPayload } from '@/features/ucat/shared/types'
import { plainTextToProseMirror, proseMirrorToPlainText } from '@/features/ucat/shared/lib/rich-text'
import { fetchAllSupabaseRows } from '@/features/ucat/shared/lib/fetch-all-supabase-rows'
import {
  throwFirstUcatBulkStatusFailure,
  throwUcatLifecycleResponseError,
} from '@/features/ucat/shared/lifecycle-errors'
import { patchUcatContentStatus } from '@/features/ucat/shared/lib/content-status-request'

export const ucatSetsApi = {
  async list() {
    const supabase = getSupabaseClient() as SupabaseClient<Database>
    return fetchAllSupabaseRows((from, to) =>
      supabase
        .from('vtutor_ucat_question_sets')
        .select('*')
        .order('section_number')
        .order('set_format')
        .order('catalog_index', { nullsFirst: false })
        .order('id')
        .range(from, to)
    )
  },

  async detail(setId: string) {
    const supabase = getSupabaseClient() as SupabaseClient<Database>
    const { data, error } = await supabase
      .from('vtutor_ucat_question_set_detail')
      .select('*')
      .eq('id', setId)
      .maybeSingle()
    if (error) throw error
    return data
  },

  async create(payload: UcatQuestionSetPayload) {
    const response = await fetch('/api/ucat/question-sets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(serialize(payload)),
    })
    if (!response.ok) await throwUcatLifecycleResponseError(response, 'Failed to create set')
    return response.json() as Promise<{ id: string }>
  },

  async update(setId: string, payload: UcatQuestionSetPayload) {
    const response = await fetch(`/api/ucat/question-sets/${setId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(serialize({ ...payload, id: setId })),
    })
    if (!response.ok) await throwUcatLifecycleResponseError(response, 'Failed to update set')
    return response.json() as Promise<{ id: string }>
  },

  async reorder(sectionId: string, setFormat: UcatQuestionSetPayload['setFormat'], setIds: string[]) {
    const response = await fetch('/api/ucat/question-sets/order', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sectionId, setFormat, setIds }),
    })
    if (!response.ok) await throwUcatLifecycleResponseError(response, 'Failed to reorder sets')
  },

  async setStatus(setId: string, status: UcatContentStatus) {
    const result = await this.bulkSetStatus([setId], status)
    throwFirstUcatBulkStatusFailure(result)
    return result
  },

  async bulkSetStatus(setIds: string[], status: UcatContentStatus) {
    return patchUcatContentStatus({
      contentType: 'set',
      contentIds: setIds,
      status,
      fallback: 'Failed to update set status',
    })
  },

  async bulkRestoreStatus(setIds: string[], currentStatus: UcatContentStatus, previousStatus: UcatContentStatus) {
    return patchUcatContentStatus({
      contentType: 'set',
      contentIds: setIds,
      status: currentStatus,
      previousStatus,
      fallback: 'Failed to restore set status',
    })
  },

  async remove(setId: string) {
    const response = await fetch(`/api/ucat/question-sets/${setId}`, { method: 'DELETE' })
    if (!response.ok) await throwUcatLifecycleResponseError(response, 'Failed to delete set')
  },

  async bulkRemove(setIds: string[]) {
    const response = await fetch('/api/ucat/question-sets/bulk-delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ setIds }),
    })
    if (!response.ok) await throwUcatLifecycleResponseError(response, 'Failed to bulk delete sets')
    return response.json() as Promise<{ ok: true }>
  },

  async restore(setId: string) {
    const response = await fetch(`/api/ucat/question-sets/${setId}/restore`, { method: 'POST' })
    if (!response.ok) {
      const body = await response.json().catch(() => ({}))
      throw new Error(body.error ?? 'Failed to restore set')
    }
  },

  async assignSessions(setId: string, sessionIds: string[]) {
    const response = await fetch(`/api/ucat/question-sets/${setId}/sessions`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionIds }),
    })
    if (!response.ok) {
      const body = await response.json().catch(() => ({}))
      throw new Error(body.error ?? 'Failed to assign sessions')
    }
  },

  async addStemsToSet(setId: string, stemIds: string[]) {
    const detail = await this.detail(setId)
    if (!detail) throw new Error('Set not found')
    const stems = (detail.stems as Array<{ stem_id: string }> | null) ?? []
    const existingStemIds = stems.map((s) => s.stem_id)
    const merged = [...new Set([...existingStemIds, ...stemIds])]
    const payload: UcatQuestionSetPayload = {
      authoringNote: detail.authoring_note,
      description: proseMirrorToPlainText(detail.description) ?? '',
      timingMode: detail.timing_mode ?? 'pace',
      paceMultiplier: detail.pace_multiplier,
      fixedTimeLimitSeconds: detail.fixed_time_limit_seconds,
      setFormat: detail.set_format ?? 'partial_section',
      accessScope: detail.access_scope ?? 'public',
      sectionId: requireSetSectionId(detail),
      referenceBlueprintId: requireReferenceBlueprintId(detail),
      stemIds: merged,
    }
    return this.update(setId, payload)
  },

  async removeStemsFromSet(setId: string, stemIds: string[]) {
    const detail = await this.detail(setId)
    if (!detail) throw new Error('Set not found')
    const stems = (detail.stems as Array<{ stem_id: string }> | null) ?? []
    const removeIds = new Set(stemIds)
    const nextStemIds = stems.map((s) => s.stem_id).filter((stemId) => !removeIds.has(stemId))
    const payload: UcatQuestionSetPayload = {
      authoringNote: detail.authoring_note,
      description: proseMirrorToPlainText(detail.description) ?? '',
      timingMode: detail.timing_mode ?? 'pace',
      paceMultiplier: detail.pace_multiplier,
      fixedTimeLimitSeconds: detail.fixed_time_limit_seconds,
      setFormat: detail.set_format ?? 'partial_section',
      accessScope: detail.access_scope ?? 'public',
      sectionId: requireSetSectionId(detail),
      referenceBlueprintId: requireReferenceBlueprintId(detail),
      stemIds: nextStemIds,
    }
    return this.update(setId, payload)
  },
}

function serialize(payload: UcatQuestionSetPayload) {
  const description =
    typeof payload.description === 'string'
      ? plainTextToProseMirror(payload.description)
      : (payload.description ?? plainTextToProseMirror(''))

  return {
    id: payload.id ?? null,
    authoringNote: payload.authoringNote ?? null,
    description,
    timingMode: payload.timingMode,
    paceMultiplier: payload.paceMultiplier ?? null,
    fixedTimeLimitSeconds: payload.fixedTimeLimitSeconds ?? null,
    setFormat: payload.setFormat,
    accessScope: payload.accessScope,
    sectionId: payload.sectionId,
    referenceBlueprintId: payload.referenceBlueprintId,
    stemIds: payload.stemIds,
  }
}

function requireSetSectionId(detail: { section_id?: string | null }): string {
  if (!detail.section_id) throw new Error('Set section is required')
  return detail.section_id
}

function requireReferenceBlueprintId(detail: { reference_blueprint_id?: string | null }): string {
  if (!detail.reference_blueprint_id) throw new Error('Set reference blueprint is required')
  return detail.reference_blueprint_id
}
