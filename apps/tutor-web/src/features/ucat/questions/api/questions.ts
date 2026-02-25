import { getSupabaseClient } from '@/shared/lib/supabase/client'
import type { Database, Json } from '@altitutor/shared'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { UcatQuestionStem, UcatQuestionStemBundlePayload } from '@/features/ucat/shared/types'
import { plainTextToProseMirror } from '@/features/ucat/shared/lib/rich-text'

type StemDetailQuestion = {
  id: string
  question_text: Json
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
    image_file_id: string | null
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
}

function serializePayload(payload: UcatQuestionStemBundlePayload) {
  return {
    stemId: payload.stemId ?? null,
    sectionId: payload.sectionId,
    categoryId: payload.categoryId ?? null,
    stemText: plainTextToProseMirror(payload.stemText),
    isPrivate: payload.isPrivate,
    questions: payload.questions.map((question) => ({
      index: question.index,
      question_text: plainTextToProseMirror(question.questionText),
      difficulty: question.difficulty ?? null,
      time_burden_seconds: question.timeBurdenSeconds ?? null,
      question_type: question.questionType,
      tag_ids: question.tagIds,
      answer_options: question.options.map((option) => ({
        index: option.index,
        answer_text: plainTextToProseMirror(option.answerText),
        answer_explanation: option.answerExplanation
          ? plainTextToProseMirror(option.answerExplanation)
          : null,
        is_answer: option.isAnswer,
      })),
    })),
  }
}
