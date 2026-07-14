import { getSupabaseClient } from '@/shared/lib/supabase/client'
import type { Database } from '@altitutor/shared'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { UcatContentStatus, UcatQuestionSetPayload } from '@/features/ucat/shared/types'
import { plainTextToProseMirror, proseMirrorToPlainText } from '@/features/ucat/shared/lib/rich-text'
import { fetchAllSupabaseRows } from '@/features/ucat/shared/lib/fetch-all-supabase-rows'

export const ucatSetsApi = {
  async list() {
    const supabase = getSupabaseClient() as SupabaseClient<Database>
    return fetchAllSupabaseRows((from, to) =>
      supabase
        .from('vtutor_ucat_question_sets')
        .select('*')
        .order('updated_at', { ascending: false })
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
    if (!response.ok) {
      const body = await response.json().catch(() => ({}))
      throw new Error(body.error ?? 'Failed to create set')
    }
    return response.json() as Promise<{ id: string }>
  },

  async update(setId: string, payload: UcatQuestionSetPayload) {
    const response = await fetch(`/api/ucat/question-sets/${setId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(serialize({ ...payload, id: setId })),
    })
    if (!response.ok) {
      const body = await response.json().catch(() => ({}))
      throw new Error(body.error ?? 'Failed to update set')
    }
    return response.json() as Promise<{ id: string }>
  },

  async setStatus(setId: string, status: UcatContentStatus) {
    const response = await fetch(`/api/ucat/question-sets/${setId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (!response.ok) {
      const body = await response.json().catch(() => ({}))
      throw new Error(body.error ?? 'Failed to update set status')
    }
  },

  async remove(setId: string) {
    const response = await fetch(`/api/ucat/question-sets/${setId}`, { method: 'DELETE' })
    if (!response.ok) {
      const body = await response.json().catch(() => ({}))
      throw new Error(body.error ?? 'Failed to delete set')
    }
  },

  async bulkRemove(setIds: string[]) {
    const response = await fetch('/api/ucat/question-sets/bulk-delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ setIds }),
    })
    if (!response.ok) {
      const body = await response.json().catch(() => ({}))
      throw new Error(body.error ?? 'Failed to bulk delete sets')
    }
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
      name: detail.name,
      description: proseMirrorToPlainText(detail.description) ?? '',
      timeLimitSeconds: detail.time_limit_seconds ?? null,
      accessScope: detail.access_scope ?? 'public',
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
      name: detail.name,
      description: proseMirrorToPlainText(detail.description) ?? '',
      timeLimitSeconds: detail.time_limit_seconds ?? null,
      accessScope: detail.access_scope ?? 'public',
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
    name: payload.name ?? null,
    description,
    timeLimitSeconds: payload.timeLimitSeconds ?? null,
    accessScope: payload.accessScope,
    stemIds: payload.stemIds,
  }
}
