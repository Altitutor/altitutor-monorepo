import type { Database } from '@altitutor/shared'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getSupabaseClient } from '@/shared/lib/supabase/client'
import type {
  UcatLearningModuleBlockPayload,
  UcatLearningModuleBlockRow,
  UcatLearningModuleRow,
  UcatLearningModuleUpsertPayload,
} from '@/features/ucat/learning-modules/types'
import { isLearningModuleIconKey } from '@/features/ucat/learning-modules/lib/learning-module-icons'

function mapModuleRow(row: Record<string, unknown>): UcatLearningModuleRow {
  return {
    id: row.id as string,
    kind: row.kind as UcatLearningModuleRow['kind'],
    title: (row.title as string) ?? '',
    description: (row.description as string | null) ?? null,
    icon_key: isLearningModuleIconKey(row.icon_key) ? row.icon_key : 'book-open',
    estimated_minutes: (row.estimated_minutes as number | null) ?? null,
    ucat_section_id: (row.ucat_section_id as string | null) ?? null,
    parent_ucat_learning_module_id: (row.parent_ucat_learning_module_id as string | null) ?? null,
    index: (row.index as number) ?? 0,
    is_private: !!row.is_private,
    section_name: (row.section_name as string | null) ?? null,
    section_number: (row.section_number as number | null) ?? null,
    child_count: (row.child_count as number) ?? 0,
    block_count: (row.block_count as number) ?? 0,
    updated_at: (row.updated_at as string) ?? '',
    study_plan_priority: (row.study_plan_priority as UcatLearningModuleRow['study_plan_priority']) ?? 'recommended',
    study_plan_category_ids: Array.isArray(row.study_plan_category_ids)
      ? row.study_plan_category_ids.filter((id): id is string => typeof id === 'string')
      : [],
    study_plan_tag_ids: Array.isArray(row.study_plan_tag_ids)
      ? row.study_plan_tag_ids.filter((id): id is string => typeof id === 'string')
      : [],
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
    skill_trainer_id: (row.skill_trainer_id as string | null) ?? null,
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
    const [categoryLinks, tagLinks] = await Promise.all([
      supabase
        .from('vtutor_ucat_learning_module_question_stem_categories')
        .select('question_stem_category_id')
        .eq('learning_module_id', moduleId),
      supabase
        .from('vtutor_ucat_learning_module_question_tags')
        .select('question_tag_id')
        .eq('learning_module_id', moduleId),
    ])
    if (categoryLinks.error) throw categoryLinks.error
    if (tagLinks.error) throw tagLinks.error
    return mapModuleRow({
      ...(data as Record<string, unknown>),
      study_plan_category_ids: (categoryLinks.data ?? []).map((link) => link.question_stem_category_id),
      study_plan_tag_ids: (tagLinks.data ?? []).map((link) => link.question_tag_id),
    })
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

  async reorder(items: Array<{ id: string; index: number }>): Promise<void> {
    const res = await fetch('/api/ucat/learning-modules/reorder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items }),
    })
    if (!res.ok) {
      const json = (await res.json()) as { error?: string }
      throw new Error(json.error ?? 'Failed to reorder learning modules')
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
