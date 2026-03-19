'use client'

import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { extractTextFromRichJson, type JsonLike } from '@/features/question-engine/model/rich-text'
import type { AnswerOption, QuestionStemWithQuestions } from '@/features/question-engine/model/types'

type StemDetailQuestion = {
  id: string
  question_text: unknown
  index: number
  question_type: 'multiple_choice' | 'syllogism'
  answer_options: Array<{
    id: string
    answer_text: unknown
    index: number
    is_answer?: boolean
  }>
}

type StemDetailRow = {
  id: string
  section_name: string
  display_columns: number | null
  stem_text: unknown
  questions: StemDetailQuestion[] | null
}

/**
 * Loads a single stem from the student view for standalone practice (e.g. session-assigned stem).
 */
export async function fetchStemForPracticeSession(stemId: string): Promise<QuestionStemWithQuestions> {
  const supabase = getSupabaseBrowserClient() as unknown as {
    from: (table: string) => {
      select: (columns: string) => {
        eq: (column: string, value: string) => {
          maybeSingle: () => Promise<{ data: StemDetailRow | null; error: { message: string } | null }>
        }
      }
    }
  }

  const { data, error } = await supabase
    .from('vstudent_ucat_question_stem_detail')
    .select('id,section_name,display_columns,stem_text,questions')
    .eq('id', stemId)
    .maybeSingle()

  if (error || !data) {
    throw new Error(error?.message ?? 'Unable to load question stem')
  }

  const stemText = extractTextFromRichJson(data.stem_text as JsonLike)
  const questionsRaw = Array.isArray(data.questions) ? data.questions : []
  const sortedQuestions = [...questionsRaw].sort((a, b) => a.index - b.index)

  const questions = sortedQuestions.map((q) => {
    const options: AnswerOption[] = (q.answer_options || [])
      .map((opt) => ({
        id: opt.id,
        index: opt.index,
        text: extractTextFromRichJson(opt.answer_text as JsonLike),
        isAnswer: opt.is_answer ?? false,
      }))
      .sort((a, b) => a.index - b.index)

    return {
      id: q.id,
      index: q.index,
      questionText: extractTextFromRichJson(q.question_text as JsonLike),
      questionType: q.question_type,
      options,
    }
  })

  return {
    id: data.id,
    questionSetId: `stem-session:${data.id}`,
    sectionName: data.section_name,
    sectionDisplayColumns: (data.display_columns ?? 1) === 2 ? 2 : 1,
    stemText,
    questions,
  }
}
