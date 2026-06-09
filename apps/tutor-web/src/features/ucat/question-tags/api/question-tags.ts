import { getSupabaseClient } from '@/shared/lib/supabase/client'
import type { Database } from '@altitutor/shared'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { UcatTagLinkedQuestion } from '@/features/ucat/question-tags/types'

export type UcatQuestionTagPayload = {
  name: string
  description?: string
  parentTagId?: string | null
}

export const ucatQuestionTagsApi = {
  async list() {
    const supabase = getSupabaseClient() as SupabaseClient<Database>
    const { data, error } = await supabase.from('vtutor_ucat_question_tags').select('*').order('name')
    if (error) throw error
    return data ?? []
  },

  async create(payload: UcatQuestionTagPayload) {
    const response = await fetch('/api/ucat/question-tags', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const body = await response.json().catch(() => ({}))
      throw new Error(body.error ?? 'Failed to create tag')
    }

    return response.json() as Promise<{ id: string }>
  },

  async update(id: string, payload: UcatQuestionTagPayload) {
    const response = await fetch(`/api/ucat/question-tags/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const body = await response.json().catch(() => ({}))
      throw new Error(body.error ?? 'Failed to update tag')
    }

    return response.json() as Promise<{ id: string }>
  },

  async remove(id: string) {
    const response = await fetch(`/api/ucat/question-tags/${id}`, { method: 'DELETE' })
    if (!response.ok) {
      const body = await response.json().catch(() => ({}))
      throw new Error(body.error ?? 'Failed to delete tag')
    }
  },

  async listLinkedQuestions(tagId: string) {
    const response = await fetch(`/api/ucat/question-tags/${tagId}/questions`)
    if (!response.ok) {
      const body = await response.json().catch(() => ({}))
      throw new Error(body.error ?? 'Failed to load linked questions')
    }
    const body = (await response.json()) as { questions: UcatTagLinkedQuestion[] }
    return body.questions
  },
}
