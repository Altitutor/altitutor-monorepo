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
import type { UcatAccessScope, UcatContentStatus } from '@/features/ucat/shared/types'
import {
  readUcatBulkStatusResponse,
  throwFirstUcatBulkStatusFailure,
  throwUcatLifecycleResponseError,
} from '@/features/ucat/shared/lifecycle-errors'

export type UcatStemLearningModuleMembership = {
  moduleId: string
  title: string
  status: UcatContentStatus
  blockCount: number
  attachedBlockCount: number
}

function mapModuleRow(row: Record<string, unknown>): UcatLearningModuleRow {
  const status = (row.status as UcatContentStatus | null) ?? 'draft'
  const accessScope = (row.access_scope as UcatAccessScope | null) ?? 'public'
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
    status,
    access_scope: accessScope,
    section_name: (row.section_name as string | null) ?? null,
    section_number: (row.section_number as number | null) ?? null,
    child_count: (row.child_count as number) ?? 0,
    block_count: (row.block_count as number) ?? 0,
    created_at: (row.created_at as string) ?? '',
    updated_at: (row.updated_at as string) ?? '',
    created_by: (row.created_by as string | null) ?? null,
    created_by_first_name: (row.created_by_first_name as string | null) ?? null,
    created_by_last_name: (row.created_by_last_name as string | null) ?? null,
    deleted_at: (row.deleted_at as string | null) ?? null,
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
  async list(options?: {
    kind?: 'folder' | 'lesson'
    status?: UcatContentStatus
    includeDeleted?: boolean
  }): Promise<UcatLearningModuleRow[]> {
    const supabase = getSupabaseClient() as SupabaseClient<Database>
    let query = supabase
      .from('vtutor_ucat_learning_modules')
      .select('*')
      .order('index', { ascending: true })

    if (options?.kind) {
      query = query.eq('kind', options.kind)
    }
    if (options?.status) {
      query = query.eq('status', options.status)
    }
    if (options?.includeDeleted) {
      query = query.not('deleted_at', 'is', null)
    } else {
      query = query.is('deleted_at', null)
    }

    const [{ data, error }, categoryLinks, tagLinks] = await Promise.all([
      query,
      supabase
        .from('vtutor_ucat_learning_module_question_stem_categories')
        .select('learning_module_id, question_stem_category_id'),
      supabase
        .from('vtutor_ucat_learning_module_question_tags')
        .select('learning_module_id, question_tag_id'),
    ])
    if (error) throw error
    if (categoryLinks.error) throw categoryLinks.error
    if (tagLinks.error) throw tagLinks.error

    const categoryIdsByModuleId = new Map<string, string[]>()
    for (const link of categoryLinks.data ?? []) {
      if (!link.learning_module_id || !link.question_stem_category_id) continue
      const existing = categoryIdsByModuleId.get(link.learning_module_id) ?? []
      existing.push(link.question_stem_category_id)
      categoryIdsByModuleId.set(link.learning_module_id, existing)
    }

    const tagIdsByModuleId = new Map<string, string[]>()
    for (const link of tagLinks.data ?? []) {
      if (!link.learning_module_id || !link.question_tag_id) continue
      const existing = tagIdsByModuleId.get(link.learning_module_id) ?? []
      existing.push(link.question_tag_id)
      tagIdsByModuleId.set(link.learning_module_id, existing)
    }

    return (data ?? [])
      .filter((row) => row.id != null)
      .map((row) =>
        mapModuleRow({
          ...(row as Record<string, unknown>),
          study_plan_category_ids: categoryIdsByModuleId.get(row.id as string) ?? [],
          study_plan_tag_ids: tagIdsByModuleId.get(row.id as string) ?? [],
        }),
      )
  },

  async get(moduleId: string): Promise<UcatLearningModuleRow | null> {
    const supabase = getSupabaseClient() as SupabaseClient<Database>
    const { data, error } = await supabase
      .from('vtutor_ucat_learning_modules')
      .select('*')
      .eq('id', moduleId)
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

  async listStemMembership(stemId: string): Promise<UcatStemLearningModuleMembership[]> {
    const supabase = getSupabaseClient() as SupabaseClient<Database>
    const questionIds = await listQuestionIdsForStem(supabase, stemId)

    const stemBlocksQuery = supabase
      .from('vtutor_ucat_learning_module_blocks')
      .select('id, learning_module_id, question_stem_id, question_id')
      .eq('question_stem_id', stemId)

    const questionBlocksQuery =
      questionIds.length > 0
        ? supabase
            .from('vtutor_ucat_learning_module_blocks')
            .select('id, learning_module_id, question_stem_id, question_id')
            .in('question_id', questionIds)
        : Promise.resolve({ data: [] as Array<Record<string, unknown>>, error: null })

    const [stemBlocksResult, questionBlocksResult] = await Promise.all([
      stemBlocksQuery,
      questionBlocksQuery,
    ])
    if (stemBlocksResult.error) throw stemBlocksResult.error
    if (questionBlocksResult.error) throw questionBlocksResult.error

    const attachedByModuleId = new Map<string, Set<string>>()
    for (const row of [...(stemBlocksResult.data ?? []), ...(questionBlocksResult.data ?? [])]) {
      const moduleId = row.learning_module_id
      const blockId = row.id
      if (typeof moduleId !== 'string' || typeof blockId !== 'string') continue
      const existing = attachedByModuleId.get(moduleId) ?? new Set<string>()
      existing.add(blockId)
      attachedByModuleId.set(moduleId, existing)
    }

    if (attachedByModuleId.size === 0) return []

    const moduleIds = Array.from(attachedByModuleId.keys())
    const { data: modules, error: modulesError } = await supabase
      .from('vtutor_ucat_learning_modules')
      .select('id, title, status, block_count, kind, deleted_at')
      .in('id', moduleIds)
      .eq('kind', 'lesson')
      .is('deleted_at', null)
    if (modulesError) throw modulesError

    return (modules ?? [])
      .filter((row): row is typeof row & { id: string } => typeof row.id === 'string')
      .map((row) => ({
        moduleId: row.id,
        title: (row.title as string | null)?.trim() || 'Untitled lesson',
        status: ((row.status as UcatContentStatus | null) ?? 'draft'),
        blockCount: (row.block_count as number | null) ?? 0,
        attachedBlockCount: attachedByModuleId.get(row.id)?.size ?? 0,
      }))
      .sort((a, b) => a.title.localeCompare(b.title))
  },

  async upsert(payload: UcatLearningModuleUpsertPayload): Promise<string> {
    const res = await fetch('/api/ucat/learning-modules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const json = (await res.json()) as { error?: string }
      throw new Error(friendlyLearningModuleError(json.error) ?? 'Failed to save learning module')
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
      throw new Error(friendlyLearningModuleError(json.error) ?? 'Failed to save blocks')
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

  async setStatus(moduleId: string, status: UcatContentStatus) {
    const result = await this.bulkSetStatus([moduleId], status)
    throwFirstUcatBulkStatusFailure(result)
    return result
  },

  async bulkSetStatus(moduleIds: string[], status: UcatContentStatus) {
    const response = await fetch('/api/ucat/content-status', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contentType: 'lesson', contentIds: moduleIds, status }),
    })
    return readUcatBulkStatusResponse(response, 'Failed to update lesson status')
  },

  async bulkRestoreStatus(
    moduleIds: string[],
    currentStatus: UcatContentStatus,
    previousStatus: UcatContentStatus,
  ) {
    const response = await fetch('/api/ucat/content-status', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contentType: 'lesson',
        contentIds: moduleIds,
        status: currentStatus,
        previousStatus,
      }),
    })
    return readUcatBulkStatusResponse(response, 'Failed to restore lesson status')
  },

  async remove(moduleId: string): Promise<void> {
    const res = await fetch(`/api/ucat/learning-modules/${moduleId}`, { method: 'DELETE' })
    if (!res.ok) await throwUcatLifecycleResponseError(res, 'Failed to delete learning module')
  },

  async bulkRemove(moduleIds: string[]): Promise<void> {
    const res = await fetch('/api/ucat/learning-modules/bulk-delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ moduleIds }),
    })
    if (!res.ok) await throwUcatLifecycleResponseError(res, 'Failed to delete learning modules')
  },

  async restore(moduleId: string): Promise<void> {
    const res = await fetch(`/api/ucat/learning-modules/${moduleId}/restore`, { method: 'POST' })
    if (!res.ok) {
      const json = (await res.json()) as { error?: string }
      throw new Error(json.error ?? 'Failed to restore learning module')
    }
  },
}

const LEARNING_MODULE_ATTACH_ERRORS: Record<string, string> = {
  only_published_stems_can_be_attached:
    'Only published question stems can be attached to published lessons. Keep the lesson unpublished until the stem is published, or choose a published stem.',
  only_questions_on_published_stems_can_be_attached:
    'Only questions on published stems can be attached to published lessons. Keep the lesson unpublished until the stem is published, or choose a published question.',
  public_lessons_require_published_assessment_blocks:
    'Published lessons can only include published assessment blocks. Publish pending generated stems first, or keep the lesson unpublished.',
  published_lessons_require_published_assessment_blocks:
    'Published lessons can only include published assessment blocks. Publish pending generated stems first, or keep the lesson unpublished.',
  status_blocked_by_attachment:
    'Remove this lesson from its class session before changing status or deleting it.',
}

function friendlyLearningModuleError(raw: string | undefined): string | undefined {
  if (!raw) return undefined
  for (const [code, message] of Object.entries(LEARNING_MODULE_ATTACH_ERRORS)) {
    if (raw.includes(code)) return message
  }
  return raw
}

async function listQuestionIdsForStem(
  supabase: SupabaseClient<Database>,
  stemId: string,
): Promise<string[]> {
  const { data, error } = await supabase
    .from('vtutor_ucat_question_stem_detail')
    .select('questions')
    .eq('id', stemId)
    .maybeSingle()
  if (error) throw error
  const questions = data?.questions
  if (!Array.isArray(questions)) return []
  return questions
    .map((question) => {
      if (!question || typeof question !== 'object') return null
      const id = (question as { id?: unknown }).id
      const deletedAt = (question as { deleted_at?: unknown }).deleted_at
      if (typeof id !== 'string' || !id) return null
      if (deletedAt != null && deletedAt !== '') return null
      return id
    })
    .filter((id): id is string => id != null)
}
