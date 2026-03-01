import { getSupabaseClient } from '@/shared/lib/supabase/client'
import type { Database } from '@altitutor/shared'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { UcatQuestionSetPayload } from '@/features/ucat/shared/types'
import { plainTextToProseMirror } from '@/features/ucat/shared/lib/rich-text'

export const ucatSetsApi = {
  async list() {
    const supabase = getSupabaseClient() as SupabaseClient<Database>
    const { data, error } = await supabase.from('vtutor_ucat_question_sets').select('*').order('updated_at', { ascending: false })
    if (error) throw error
    return data ?? []
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
}

function serialize(payload: UcatQuestionSetPayload) {
  return {
    id: payload.id ?? null,
    name: payload.name ?? null,
    description: plainTextToProseMirror(payload.description),
    timeLimitSeconds: payload.timeLimitSeconds ?? null,
    isPrivate: payload.isPrivate,
    isStudentGenerated: payload.isStudentGenerated,
    stemIds: payload.stemIds,
  }
}
