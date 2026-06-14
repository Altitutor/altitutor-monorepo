import { getSupabaseClient } from '@/shared/lib/supabase/client'
import type { Database, Json } from '@altitutor/shared'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { UcatQuestionStem, UcatQuestionStemBundlePayload } from '@/features/ucat/shared/types'

export type UcatQuestionListMode = 'default' | 'generated' | 'all'
export type UcatApprovalStatus = 'approved' | 'pending' | 'rejected'

export type UcatQuestionStemRow = UcatQuestionStem & {
  is_ai_generated?: boolean | null
  ai_generation_metadata?: Json | null
  approval_status?: UcatApprovalStatus | null
  approved_by?: string | null
  approved_at?: string | null
}

type StemDetailQuestion = {
  id: string
  question_text: Json
  answer_explanation: Json | null
  index: number
  difficulty: number | null
  time_burden_seconds: number | null
  question_type: 'multiple_choice' | 'syllogism'
  tags?: Array<{ id: string; name: string }>
  answer_options: Array<{
    id: string
    answer_text: Json
    answer_explanation: Json | null
    index: number
    is_answer: boolean
    option_text_file_ids?: string[]
    option_explanation_file_ids?: string[]
  }>
}

export type StemDetailRow = {
  id: string
  section_id: string
  section_name: string
  section_number: number
  display_columns: number
  question_stem_category_id: string | null
  category_name: string | null
  is_private: boolean
  is_ai_generated?: boolean | null
  ai_generation_metadata?: Json | null
  approval_status?: UcatApprovalStatus | null
  approved_by?: string | null
  approved_at?: string | null
  stem_text: Json
  questions: StemDetailQuestion[]
}

export const ucatQuestionsApi = {
  async list(options?: {
    mode?: UcatQuestionListMode
    sectionId?: string | null
    categoryId?: string | null
    approvalStatus?: UcatApprovalStatus | null
  }) {
    const supabase = getSupabaseClient() as SupabaseClient<Database>
    const mode = options?.mode ?? 'default'
    let query = supabase
      .from('vtutor_ucat_question_stems')
      .select('*')
      .order('updated_at', { ascending: false })

    if (mode === 'default') {
      query = query.filter('approval_status', 'eq', 'approved')
    } else if (mode === 'generated') {
      query = query.filter('is_ai_generated', 'eq', 'true')
    }

    if (options?.sectionId) {
      query = query.eq('section_id', options.sectionId)
    }
    if (options?.categoryId) {
      query = query.eq('question_stem_category_id', options.categoryId)
    }
    if (options?.approvalStatus) {
      query = query.filter('approval_status', 'eq', options.approvalStatus)
    }

    const { data, error } = await query

    if (error) throw error
    return (data ?? []) as unknown as UcatQuestionStemRow[]
  },

  async getSections() {
    const supabase = getSupabaseClient() as SupabaseClient<Database>
    const { data, error } = await supabase.from('vtutor_ucat_sections').select('*').order('section_number')
    if (error) throw error
    return data ?? []
  },

  async getCategories() {
    const supabase = getSupabaseClient() as SupabaseClient<Database>
    const { data, error } = await supabase.from('vtutor_ucat_question_stem_categories').select('*').order('name')
    if (error) throw error
    return data ?? []
  },

  async getTags() {
    const supabase = getSupabaseClient() as SupabaseClient<Database>
    const { data, error } = await supabase.from('vtutor_ucat_question_tags').select('*').order('name')
    if (error) throw error
    return data ?? []
  },

  async getDetail(stemId: string) {
    const supabase = getSupabaseClient() as SupabaseClient<Database>
    const { data, error } = await supabase
      .from('vtutor_ucat_question_stem_detail')
      .select('*')
      .eq('id', stemId)
      .maybeSingle()

    if (error) throw error
    return (data ?? null) as unknown as StemDetailRow | null
  },

  async getStemTypes() {
    const supabase = getSupabaseClient() as SupabaseClient<Database>
    const { data, error } = await supabase
      .from('vtutor_ucat_question_stem_detail')
      .select('id,questions')

    if (error) throw error

    type QuestionWithType = { question_type?: string | null }
    const rows = (data ?? []) as Array<{ id: string | null; questions: unknown }>
    const map: Record<string, Set<'multiple_choice' | 'syllogism'>> = {}

    for (const row of rows) {
      if (!row.id) continue
      const types = new Set<'multiple_choice' | 'syllogism'>()
      const questions = Array.isArray(row.questions) ? (row.questions as QuestionWithType[]) : []
      for (const question of questions) {
        if (question.question_type === 'multiple_choice' || question.question_type === 'syllogism') {
          types.add(question.question_type)
        }
      }
      map[row.id] = types
    }

    return map
  },

  async getStemTagIds() {
    const supabase = getSupabaseClient() as SupabaseClient<Database>
    const { data, error } = await supabase
      .from('vtutor_ucat_question_stem_detail')
      .select('id,questions')

    if (error) throw error

    type QuestionWithTags = {
      deleted_at?: string | null
      tags?: Array<{ id?: string | null }> | null
    }
    const rows = (data ?? []) as Array<{ id: string | null; questions: unknown }>
    const map: Record<string, string[]> = {}

    for (const row of rows) {
      if (!row.id) continue
      const tagIds = new Set<string>()
      const questions = Array.isArray(row.questions) ? (row.questions as QuestionWithTags[]) : []
      for (const question of questions) {
        if (question.deleted_at) continue
        const tags = Array.isArray(question.tags) ? question.tags : []
        for (const tag of tags) {
          if (tag.id) tagIds.add(tag.id)
        }
      }
      map[row.id] = Array.from(tagIds)
    }

    return map
  },

  async getStemCatalog() {
    const supabase = getSupabaseClient() as SupabaseClient<Database>
    const { data, error } = await supabase
      .from('vtutor_ucat_question_stem_detail')
      .select(
        'id,stem_text,questions,section_name,section_number,section_id,question_stem_category_id,category_name,is_private,created_at,deleted_at'
      )
      .is('deleted_at', null)
      .filter('approval_status', 'eq', 'approved')

    if (error) throw error

    return (data ?? []) as Array<{
      id: string | null
      stem_text: Json | null
      questions: unknown
      section_name: string | null
      section_number: number | null
      section_id: string | null
      question_stem_category_id: string | null
      category_name: string | null
      is_private: boolean | null
      created_at: string | null
    }>
  },

  async create(payload: UcatQuestionStemBundlePayload) {
    const response = await fetch('/api/ucat/question-stems', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(serializePayload(payload)),
    })

    if (!response.ok) {
      const body = await response.json().catch(() => ({}))
      throw new Error(body.error ?? 'Failed to create question stem')
    }

    return response.json() as Promise<{ id: string }>
  },

  async update(stemId: string, payload: UcatQuestionStemBundlePayload) {
    const response = await fetch(`/api/ucat/question-stems/${stemId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(serializePayload({ ...payload, stemId })),
    })

    if (!response.ok) {
      const body = await response.json().catch(() => ({}))
      throw new Error(body.error ?? 'Failed to update question stem')
    }

    return response.json() as Promise<{ id: string }>
  },

  async addQuestionTag(stemId: string, questionId: string, tagId: string) {
    const detail = await this.getDetail(stemId)
    if (!detail) throw new Error('Question stem not found')
    const questions = (detail.questions ?? []) as StemDetailQuestion[]
    const questionIndex = questions.findIndex((q) => q.id === questionId)
    if (questionIndex === -1) throw new Error('Question not found')
    const existingTagIds = (questions[questionIndex].tags ?? []).map((t) => t.id)
    if (existingTagIds.includes(tagId)) return
    const newTagIds = [...existingTagIds, tagId]
    const payload = stemDetailToBundlePayload(detail, (q, i) =>
      i === questionIndex ? newTagIds : (q.tags ?? []).map((t) => t.id)
    )
    return this.update(stemId, payload)
  },

  async remove(stemId: string) {
    const response = await fetch(`/api/ucat/question-stems/${stemId}`, { method: 'DELETE' })
    if (!response.ok) {
      const body = await response.json().catch(() => ({}))
      throw new Error(body.error ?? 'Failed to delete question stem')
    }
  },

  async bulkRemove(stemIds: string[]) {
    const response = await fetch('/api/ucat/question-stems/bulk-delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stemIds }),
    })
    if (!response.ok) {
      const body = await response.json().catch(() => ({}))
      throw new Error(body.error ?? 'Failed to bulk delete question stems')
    }
    return response.json() as Promise<{ ok: true }>
  },

  async restore(stemId: string) {
    const response = await fetch(`/api/ucat/question-stems/${stemId}/restore`, { method: 'POST' })
    if (!response.ok) {
      const body = await response.json().catch(() => ({}))
      throw new Error(body.error ?? 'Failed to restore question stem')
    }
  },

  async bulkUpdateMetadata(
    stemIds: string[],
    updates: { categoryId?: string | null; isPrivate?: boolean }
  ) {
    const response = await fetch('/api/ucat/question-stems/bulk-update', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        stemIds,
        categoryId: updates.categoryId ?? null,
        isPrivate: updates.isPrivate ?? null,
      }),
    })

    if (!response.ok) {
      const body = await response.json().catch(() => ({}))
      throw new Error(body.error ?? 'Failed to bulk update question stems')
    }

    return response.json() as Promise<{ ok: true }>
  },

  async bulkImport(sectionId: string, stems: UcatQuestionStemBundlePayload[]) {
    const response = await fetch('/api/ucat/question-stems/bulk-import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sectionId,
        stems: stems.map((stem) => serializePayload(stem)),
      }),
    })

    if (!response.ok) {
      const body = await response.json().catch(() => ({}))
      throw new Error(body.error ?? 'Failed to bulk import question stems')
    }

    return response.json() as Promise<{ ids: string[] }>
  },

  async generateDrafts(input: {
    sectionId: string
    categoryId?: string | null
    profileId?: string | null
    sourceMode: 'none' | 'random' | 'selected'
    sourceStemIds?: string[]
    stemCount: number
    difficultyTarget: 'easy' | 'medium' | 'hard' | 'mixed'
    timeBurdenTarget: 'low' | 'medium' | 'high' | 'mixed'
    targetTagIds: string[]
    runInstructions?: string | null
  }) {
    const response = await fetch('/api/ucat/question-stems/generated/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    })
    if (!response.ok) {
      const body = await response.json().catch(() => ({}))
      throw new Error(body.error ?? 'Failed to generate question drafts')
    }
    return response.json() as Promise<{
      discardedCount?: number
      stems: Array<{
        sectionId: string
        categoryId: string | null
        stemText: Json
        isPrivate: boolean
        questions: Array<{
          index: number
          questionText: Json
          answerExplanation: Json | null
          difficulty: number | null
          timeBurdenSeconds: number | null
          questionType: 'multiple_choice' | 'syllogism'
          tagIds: string[]
          options: Array<{
            index: number
            answerText: Json
            answerExplanation: Json | null
            isAnswer: boolean
          }>
        }>
        aiGenerationMetadata: Json | null
      }>
    }>
  },

  async getGenerationProfiles() {
    const response = await fetch('/api/ucat/question-stems/generated/profiles')
    if (!response.ok) {
      const body = await response.json().catch(() => ({}))
      throw new Error(body.error ?? 'Failed to load generation profiles')
    }
    return response.json() as Promise<{
      profiles: Array<{
        id: string
        name: string
        model: string
        isDefault: boolean
        candidatesPerStem: number
      }>
      settings: {
        maxRequestedStems: number
        maxCandidatesPerStem: number
      }
    }>
  },

  async importGenerated(sectionId: string, stems: Array<Record<string, unknown>>) {
    const response = await fetch('/api/ucat/question-stems/generated/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sectionId, stems }),
    })
    if (!response.ok) {
      const body = await response.json().catch(() => ({}))
      throw new Error(body.error ?? 'Failed to import generated question stems')
    }
    return response.json() as Promise<{ ids: string[] }>
  },

  async setApprovalStatus(stemId: string, status: UcatApprovalStatus) {
    const response = await fetch(`/api/ucat/question-stems/${stemId}/approval`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ approvalStatus: status }),
    })
    if (!response.ok) {
      const body = await response.json().catch(() => ({}))
      throw new Error(body.error ?? 'Failed to update approval status')
    }
    return response.json() as Promise<{ ok: true }>
  },
}

/** Ensure we send actual null for DB, never the string "null". */
function toJsonOrNull(value: unknown): Json | null {
  if (value == null) return null
  if (typeof value === 'string' && value === 'null') return null
  return value as Json
}

function stemDetailToBundlePayload(
  detail: StemDetailRow,
  getTagIds: (q: StemDetailQuestion, index: number) => string[]
): UcatQuestionStemBundlePayload {
  const questions = (detail.questions ?? []) as StemDetailQuestion[]
  return {
    stemId: detail.id,
    sectionId: detail.section_id,
    categoryId: detail.question_stem_category_id ?? null,
    stemText: detail.stem_text ?? {},
    isPrivate: !!detail.is_private,
    questions: questions.map((q, i) => ({
      index: q.index,
      questionText: q.question_text ?? {},
      questionType: q.question_type ?? 'multiple_choice',
      answerExplanation: toJsonOrNull(q.answer_explanation),
      difficulty: q.difficulty ?? null,
      timeBurdenSeconds: q.time_burden_seconds ?? null,
      tagIds: getTagIds(q, i),
      options: (q.answer_options ?? []).map((opt) => ({
        index: opt.index,
        answerText: opt.answer_text ?? {},
        answerExplanation: toJsonOrNull(opt.answer_explanation),
        isAnswer: opt.is_answer,
      })),
    })),
  }
}

function serializePayload(payload: UcatQuestionStemBundlePayload) {
  return {
    stemId: payload.stemId ?? null,
    sectionId: payload.sectionId,
    categoryId: payload.categoryId ?? null,
    stemText: payload.stemText,
    isPrivate: payload.isPrivate,
    questions: payload.questions.map((question) => ({
      index: question.index,
      question_text: question.questionText,
      answer_explanation: toJsonOrNull(question.answerExplanation),
      difficulty: question.difficulty ?? null,
      time_burden_seconds: question.timeBurdenSeconds ?? null,
      question_type: question.questionType,
      tag_ids: question.tagIds,
      answer_options: question.options.map((option) => ({
        index: option.index,
        answer_text: option.answerText,
        answer_explanation: toJsonOrNull(option.answerExplanation),
        is_answer: option.isAnswer,
      })),
    })),
  }
}
