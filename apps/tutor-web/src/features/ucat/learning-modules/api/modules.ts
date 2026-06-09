import type { Database } from '@altitutor/shared'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getSupabaseClient } from '@/shared/lib/supabase/client'
import type {
  UcatLearningModuleBlockPayload,
  UcatLearningModuleBlockRow,
  UcatLearningModuleRow,
  UcatLearningModuleUpsertPayload,
} from '@/features/ucat/learning-modules/types'

function mapModuleRow(row: Record<string, unknown>): UcatLearningModuleRow {
  return {
    id: row.id as string,
    kind: row.kind as UcatLearningModuleRow['kind'],
    title: (row.title as string) ?? '',
    description: (row.description as string | null) ?? null,
    ucat_section_id: (row.ucat_section_id as string | null) ?? null,
    parent_ucat_learning_module_id: (row.parent_ucat_learning_module_id as string | null) ?? null,
    index: (row.index as number) ?? 0,
    is_private: !!row.is_private,
    display_mode: (row.display_mode as UcatLearningModuleRow['display_mode']) ?? null,
    section_name: (row.section_name as string | null) ?? null,
    section_number: (row.section_number as number | null) ?? null,
    child_count: (row.child_count as number) ?? 0,
    block_count: (row.block_count as number) ?? 0,
    updated_at: (row.updated_at as string) ?? '',
  }
}

function mapBlockRow(row: Record<string, unknown>): UcatLearningModuleBlockRow {
  return {
    id: row.id as string,
    learning_module_id: row.learning_module_id as string,
    block_type: row.block_type as UcatLearningModuleBlockRow['block_type'],
    index: (row.index as number) ?? 0,
    require_completion_before_next: row.require_completion_before_next !== false,
    content: (row.content ?? {}) as UcatLearningModuleBlockRow['content'],
    question_stem_id: (row.question_stem_id as string | null) ?? null,
    question_id: (row.question_id as string | null) ?? null,
    file_id: (row.file_id as string | null) ?? null,
    skill_trainer_set_id: (row.skill_trainer_set_id as string | null) ?? null,
  }
}

export const ucatLearningModulesApi = {
  async list(options?: { kind?: 'folder' | 'lesson' }): Promise<UcatLearningModuleRow[]> {
    const supabase = getSupabaseClient() as SupabaseClient<Database>
    let query = supabase
      .from('vtutor_ucat_learning_modules')
      .select('*')
      .is('deleted_at', null)
      .order('index', { ascending: true })

    if (options?.kind) {
      query = query.eq('kind', options.kind)
    }

    const { data, error } = await query
    if (error) throw error
    return (data ?? [])
      .filter((row) => row.id != null)
      .map((row) => mapModuleRow(row as Record<string, unknown>))
  },

  async get(moduleId: string): Promise<UcatLearningModuleRow | null> {
    const supabase = getSupabaseClient() as SupabaseClient<Database>
    const { data, error } = await supabase
      .from('vtutor_ucat_learning_modules')
      .select('*')
      .eq('id', moduleId)
      .is('deleted_at', null)
      .maybeSingle()
    if (error) throw error
    if (!data?.id) return null
    return mapModuleRow(data as Record<string, unknown>)
  },

  async listBlocks(moduleId: string): Promise<UcatLearningModuleBlockRow[]> {
    const supabase = getSupabaseClient() as SupabaseClient<Database>
    const { data, error } = await supabase
      .from('vtutor_ucat_learning_module_blocks')
      .select('*')
      .eq('learning_module_id', moduleId)
      .order('index', { ascending: true })
    if (error) throw error
    return (data ?? [])
      .filter((row) => row.id != null)
      .map((row) => mapBlockRow(row as Record<string, unknown>))
  },

  async upsert(payload: UcatLearningModuleUpsertPayload): Promise<string> {
    const res = await fetch('/api/ucat/learning-modules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const json = (await res.json()) as { error?: string }
      throw new Error(json.error ?? 'Failed to save learning module')
    }
    const json = (await res.json()) as { id: string }
    return json.id
  },

  async replaceBlocks(moduleId: string, blocks: UcatLearningModuleBlockPayload[]): Promise<void> {
    const res = await fetch(`/api/ucat/learning-modules/${moduleId}/blocks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ blocks }),
    })
    if (!res.ok) {
      const json = (await res.json()) as { error?: string }
      throw new Error(json.error ?? 'Failed to save blocks')
    }
  },

  async remove(moduleId: string): Promise<void> {
    const res = await fetch(`/api/ucat/learning-modules/${moduleId}`, { method: 'DELETE' })
    if (!res.ok) {
      const json = (await res.json()) as { error?: string }
      throw new Error(json.error ?? 'Failed to delete learning module')
    }
  },
}
