import type { Database } from '@altitutor/shared'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getSupabaseClient } from '@/shared/lib/supabase/client'
import type {
  UcatSkillTrainerSetItemRow,
  UcatSkillTrainerSetRow,
  UcatSkillTrainerSetUpsertPayload,
} from '@/features/ucat/skill-trainer-sets/types'

function mapSetRow(row: Record<string, unknown>): UcatSkillTrainerSetRow {
  return {
    id: row.id as string,
    skill_trainer_id: row.skill_trainer_id as string,
    trainer_key: (row.trainer_key as string) ?? '',
    trainer_name: (row.trainer_name as string) ?? '',
    name: (row.name as string) ?? '',
    description: (row.description as string | null) ?? null,
    is_private: !!row.is_private,
    item_count: (row.item_count as number) ?? 0,
    updated_at: (row.updated_at as string) ?? '',
  }
}

function mapItemRow(row: Record<string, unknown>): UcatSkillTrainerSetItemRow {
  return {
    id: row.id as string,
    skill_trainer_set_id: row.skill_trainer_set_id as string,
    skill_trainer_item_id: row.skill_trainer_item_id as string,
    index: (row.index as number) ?? 0,
    item_content: (row.item_content ?? {}) as Record<string, unknown>,
    approval_status: (row.approval_status as UcatSkillTrainerSetItemRow['approval_status']) ?? 'pending',
    item_is_active: !!row.item_is_active,
  }
}

export const ucatSkillTrainerSetsApi = {
  async list(options?: { trainerKey?: string }): Promise<UcatSkillTrainerSetRow[]> {
    const supabase = getSupabaseClient() as SupabaseClient<Database>
    let query = supabase
      .from('vtutor_ucat_skill_trainer_sets')
      .select('*')
      .is('deleted_at', null)
      .order('updated_at', { ascending: false })

    if (options?.trainerKey) {
      query = query.eq('trainer_key', options.trainerKey)
    }

    const { data, error } = await query
    if (error) throw error
    return (data ?? [])
      .filter((row) => row.id != null)
      .map((row) => mapSetRow(row as Record<string, unknown>))
  },

  async get(setId: string): Promise<UcatSkillTrainerSetRow | null> {
    const supabase = getSupabaseClient() as SupabaseClient<Database>
    const { data, error } = await supabase
      .from('vtutor_ucat_skill_trainer_sets')
      .select('*')
      .eq('id', setId)
      .is('deleted_at', null)
      .maybeSingle()
    if (error) throw error
    if (!data?.id) return null
    return mapSetRow(data as Record<string, unknown>)
  },

  async listItems(setId: string): Promise<UcatSkillTrainerSetItemRow[]> {
    const supabase = getSupabaseClient() as SupabaseClient<Database>
    const { data, error } = await supabase
      .from('vtutor_ucat_skill_trainer_set_items')
      .select('*')
      .eq('skill_trainer_set_id', setId)
      .order('index', { ascending: true })
    if (error) throw error
    return (data ?? [])
      .filter((row) => row.id != null)
      .map((row) => mapItemRow(row as Record<string, unknown>))
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

  async upsert(payload: UcatSkillTrainerSetUpsertPayload): Promise<string> {
    const res = await fetch('/api/ucat/skill-trainer-sets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const json = (await res.json()) as { error?: string }
      throw new Error(json.error ?? 'Failed to save skill trainer set')
    }
    const json = (await res.json()) as { id: string }
    return json.id
  },

  async replaceItems(setId: string, itemIds: string[]): Promise<void> {
    const res = await fetch(`/api/ucat/skill-trainer-sets/${setId}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemIds }),
    })
    if (!res.ok) {
      const json = (await res.json()) as { error?: string }
      throw new Error(json.error ?? 'Failed to save set items')
    }
  },

  async remove(setId: string): Promise<void> {
    const res = await fetch(`/api/ucat/skill-trainer-sets/${setId}`, { method: 'DELETE' })
    if (!res.ok) {
      const json = (await res.json()) as { error?: string }
      throw new Error(json.error ?? 'Failed to delete skill trainer set')
    }
  },
}
