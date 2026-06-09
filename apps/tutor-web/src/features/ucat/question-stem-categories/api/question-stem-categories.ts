import { getSupabaseClient } from '@/shared/lib/supabase/client'
import type { Database } from '@altitutor/shared'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { UcatCategoryLinkedStem } from '@/features/ucat/question-stem-categories/types'

export type UcatQuestionStemCategoryPayload = {
  name?: string
  description?: string
  sectionId?: string | null
  parentCategoryId?: string | null
  reparentOnly?: boolean
}

export const ucatQuestionStemCategoriesApi = {
  async list() {
    const supabase = getSupabaseClient() as SupabaseClient<Database>
    const { data, error } = await supabase.from('vtutor_ucat_question_stem_categories').select('*').order('name')
    if (error) throw error
    return data ?? []
  },

  async create(payload: UcatQuestionStemCategoryPayload) {
    const response = await fetch('/api/ucat/question-stem-categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const body = await response.json().catch(() => ({}))
      throw new Error(body.error ?? 'Failed to create category')
    }

    return response.json() as Promise<{ id: string }>
  },

  async update(id: string, payload: UcatQuestionStemCategoryPayload) {
    const response = await fetch(`/api/ucat/question-stem-categories/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const body = await response.json().catch(() => ({}))
      throw new Error(body.error ?? 'Failed to update category')
    }

    return response.json() as Promise<{ id: string }>
  },

  async remove(id: string) {
    const response = await fetch(`/api/ucat/question-stem-categories/${id}`, { method: 'DELETE' })
    if (!response.ok) {
      const body = await response.json().catch(() => ({}))
      throw new Error(body.error ?? 'Failed to delete category')
    }
  },

  async listLinkedStems(categoryId: string) {
    const response = await fetch(`/api/ucat/question-stem-categories/${categoryId}/stems`)
    if (!response.ok) {
      const body = await response.json().catch(() => ({}))
      throw new Error(body.error ?? 'Failed to load linked stems')
    }
    const body = (await response.json()) as { stems: UcatCategoryLinkedStem[] }
    return body.stems
  },
}
