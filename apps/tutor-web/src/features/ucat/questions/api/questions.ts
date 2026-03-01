import { getSupabaseClient } from '@/shared/lib/supabase/client'
import type { Database, Json } from '@altitutor/shared'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { UcatQuestionStem, UcatQuestionStemBundlePayload } from '@/features/ucat/shared/types'

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
  stem_text: Json
  questions: StemDetailQuestion[]
}

export const ucatQuestionsApi = {
  async list() {
    const supabase = getSupabaseClient() as SupabaseClient<Database>
    const { data, error } = await supabase
      .from('vtutor_ucat_question_stems')
      .select('*')
      .order('updated_at', { ascending: false })

    if (error) throw error
    return (data ?? []) as UcatQuestionStem[]
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
    return (data ?? null) as StemDetailRow | null
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

  async getStemCatalog() {
    const supabase = getSupabaseClient() as SupabaseClient<Database>
    const { data, error } = await supabase
      .from('vtutor_ucat_question_stem_detail')
      .select(
        'id,stem_text,questions,section_name,section_number,section_id,question_stem_category_id,category_name,is_private,deleted_at'
      )
      .is('deleted_at', null)

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
      answer_explanation: question.answerExplanation ?? null,
      difficulty: question.difficulty ?? null,
      time_burden_seconds: question.timeBurdenSeconds ?? null,
      question_type: question.questionType,
      tag_ids: question.tagIds,
      answer_options: question.options.map((option) => ({
        index: option.index,
        answer_text: option.answerText,
        answer_explanation: option.answerExplanation ?? null,
        is_answer: option.isAnswer,
      })),
    })),
  }
}
