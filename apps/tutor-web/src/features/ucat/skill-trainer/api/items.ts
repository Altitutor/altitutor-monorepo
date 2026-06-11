import type { Database } from '@altitutor/shared'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getSupabaseClient } from '@/shared/lib/supabase/client'

export type UcatSkillTrainerItemRow = {
  id: string
  skill_trainer_id: string
  trainer_key: string
  trainer_name: string
  content: Record<string, unknown>
  is_active: boolean
  approval_status: 'approved' | 'pending' | 'rejected'
  source_question_stem_id: string | null
  updated_at: string
}

export const ucatSkillTrainerItemsApi = {
  async list(options?: {
    trainerKey?: string
    approvalStatus?: 'approved' | 'pending' | 'rejected'
  }): Promise<UcatSkillTrainerItemRow[]> {
    const supabase = getSupabaseClient() as SupabaseClient<Database>
    let query = supabase
      .from('vtutor_ucat_skill_trainer_items')
      .select('*')
      .is('deleted_at', null)
      .order('updated_at', { ascending: false })

    if (options?.trainerKey) {
      query = query.eq('trainer_key', options.trainerKey)
    }
    if (options?.approvalStatus) {
      query = query.eq('approval_status', options.approvalStatus)
    }

    const { data, error } = await query
    if (error) throw error
    return (data ?? []) as UcatSkillTrainerItemRow[]
  },

  async get(itemId: string): Promise<UcatSkillTrainerItemRow | null> {
    const supabase = getSupabaseClient() as SupabaseClient<Database>
    const { data, error } = await supabase
      .from('vtutor_ucat_skill_trainer_items')
      .select('*')
      .eq('id', itemId)
      .maybeSingle()
    if (error) throw error
    return data as UcatSkillTrainerItemRow | null
  },

  async listTrainers() {
    const supabase = getSupabaseClient() as SupabaseClient<Database>
    const { data, error } = await supabase
      .from('vtutor_ucat_skill_trainers')
      .select('id, key, name')
      .order('sort_order')
    if (error) throw error
    return data ?? []
  },

  async upsert(payload: {
    itemId?: string | null
    skillTrainerId: string
    content: Record<string, unknown>
    sourceQuestionStemId?: string | null
    isActive?: boolean
  }): Promise<string> {
    const res = await fetch('/api/ucat/skill-trainer-items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        itemId: payload.itemId,
        skillTrainerId: payload.skillTrainerId,
        content: payload.content,
        sourceQuestionStemId: payload.sourceQuestionStemId,
        isActive: payload.isActive,
      }),
    })
    if (!res.ok) {
      const json = (await res.json()) as { error?: string }
      throw new Error(json.error ?? 'Failed to save item')
    }
    const json = (await res.json()) as { id: string }
    return json.id
  },

  async setApproval(itemId: string, approvalStatus: 'approved' | 'pending' | 'rejected') {
    const res = await fetch(`/api/ucat/skill-trainer-items/${itemId}/approval`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ approvalStatus }),
    })
    if (!res.ok) {
      const json = (await res.json()) as { error?: string }
      throw new Error(json.error ?? 'Failed to update approval')
    }
  },
}
