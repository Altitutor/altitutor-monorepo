'use client'

import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { extractTextFromRichJson, type JsonLike } from '@/features/question-engine/model/rich-text'
import type { QuestionEngineExam, QuestionEngineMode, QuestionItem } from '@/features/question-engine/model/types'

type SetDetailStem = {
  stem_id: string
  stem_text: unknown
  questions_meta: Array<{ id: string; index: number }>
}

type SetDetailRow = {
  id: string
  name?: unknown
  description: unknown
  stems: SetDetailStem[]
}

type MockSetMeta = {
  id: string
}

type MockDetailRow = {
  id: string
  name: string
  sets: MockSetMeta[]
}

type StemDetailQuestion = {
  id: string
  question_text: unknown
  index: number
  question_type: 'multiple_choice' | 'syllogism'
  answer_options: Array<{ id: string; answer_text: unknown; index: number }>
}

type StemDetailRow = {
  id: string
  section_name: string
  stem_text: unknown
  questions: StemDetailQuestion[]
}

function mapSetToQuestions(set: SetDetailRow, stemDetails: StemDetailRow[]): QuestionItem[] {
  const stemMap = new Map(stemDetails.map((stem) => [stem.id, stem]))
  const questions: QuestionItem[] = []

  set.stems.forEach((stemMeta) => {
    const stem = stemMap.get(stemMeta.stem_id)
    if (!stem) {
      return
    }

    const questionMap = new Map(stem.questions.map((question) => [question.id, question]))

    stemMeta.questions_meta.forEach((questionMeta) => {
      const question = questionMap.get(questionMeta.id)
      if (!question) {
        return
      }

      questions.push({
        id: question.id,
        index: questionMeta.index,
        stemId: stem.id,
        sectionName: stem.section_name,
        stemText: extractTextFromRichJson(stem.stem_text as JsonLike),
        questionText: extractTextFromRichJson(question.question_text as JsonLike),
        questionType: question.question_type,
        options: (question.answer_options || [])
          .map((option) => ({
            id: option.id,
            index: option.index,
            text: extractTextFromRichJson(option.answer_text as JsonLike),
          }))
          .sort((a, b) => a.index - b.index),
      })
    })
  })

  return questions.sort((a, b) => a.index - b.index)
}

async function loadSetDetail(setId: string): Promise<SetDetailRow> {
  const supabase = getSupabaseBrowserClient() as unknown as {
    from: (table: string) => {
      select: (columns: string) => {
        eq: (column: string, value: string) => {
          maybeSingle: () => Promise<{ data: SetDetailRow | null; error: { message: string } | null }>
        }
      }
    }
  }

  const { data, error } = await supabase
    .from('vstudent_ucat_question_set_detail')
    .select('id,name,description,stems')
    .eq('id', setId)
    .maybeSingle()

  if (error || !data) {
    throw new Error(error?.message ?? 'Unable to load question set detail')
  }

  return data
}

async function loadStemDetails(stemIds: string[]): Promise<StemDetailRow[]> {
  if (stemIds.length === 0) {
    return []
  }

  const supabase = getSupabaseBrowserClient() as unknown as {
    from: (table: string) => {
      select: (columns: string) => {
        in: (column: string, values: string[]) => Promise<{ data: StemDetailRow[] | null; error: { message: string } | null }>
      }
    }
  }

  const { data, error } = await supabase
    .from('vstudent_ucat_question_stem_detail')
    .select('id,section_name,stem_text,questions')
    .in('id', stemIds)

  if (error || !data) {
    throw new Error(error?.message ?? 'Unable to load question stem details')
  }

  return data
}

async function loadFirstSetId(): Promise<string> {
  const supabase = getSupabaseBrowserClient() as unknown as {
    from: (table: string) => {
      select: (columns: string) => {
        limit: (value: number) => Promise<{ data: Array<{ id: string }> | null; error: { message: string } | null }>
      }
    }
  }

  const { data, error } = await supabase.from('vstudent_ucat_question_sets').select('id').limit(1)

  if (error || !data || data.length === 0) {
    throw new Error(error?.message ?? 'No question sets available for student')
  }

  return data[0].id
}

async function loadFirstMockId(): Promise<string> {
  const supabase = getSupabaseBrowserClient() as unknown as {
    from: (table: string) => {
      select: (columns: string) => {
        limit: (value: number) => Promise<{ data: Array<{ id: string }> | null; error: { message: string } | null }>
      }
    }
  }

  const { data, error } = await supabase.from('vstudent_ucat_mocks').select('id').limit(1)

  if (error || !data || data.length === 0) {
    throw new Error(error?.message ?? 'No mocks available for student')
  }

  return data[0].id
}

async function loadMockDetail(mockId: string): Promise<MockDetailRow> {
  const supabase = getSupabaseBrowserClient() as unknown as {
    from: (table: string) => {
      select: (columns: string) => {
        eq: (column: string, value: string) => {
          maybeSingle: () => Promise<{ data: MockDetailRow | null; error: { message: string } | null }>
        }
      }
    }
  }

  const { data, error } = await supabase
    .from('vstudent_ucat_mock_detail')
    .select('id,name,sets')
    .eq('id', mockId)
    .maybeSingle()

  if (error || !data) {
    throw new Error(error?.message ?? 'Unable to load mock detail')
  }

  return data
}

async function buildSetExam(setId: string): Promise<QuestionEngineExam> {
  const setDetail = await loadSetDetail(setId)
  const stemIds = (setDetail.stems || []).map((stem) => stem.stem_id)
  const stemDetails = await loadStemDetails(stemIds)

  const title =
    extractTextFromRichJson(setDetail.name as JsonLike) ||
    extractTextFromRichJson(setDetail.description as JsonLike) ||
    'Question Set'
  return {
    sourceType: 'set',
    sourceId: setId,
    title,
    questions: mapSetToQuestions(setDetail, stemDetails),
  }
}

async function buildMockExam(mockId: string): Promise<QuestionEngineExam> {
  const mockDetail = await loadMockDetail(mockId)
  const setIds = (mockDetail.sets || []).map((set) => set.id)

  const setPayloads = await Promise.all(
    setIds.map(async (setId) => {
      const setDetail = await loadSetDetail(setId)
      const stemDetails = await loadStemDetails((setDetail.stems || []).map((stem) => stem.stem_id))
      return mapSetToQuestions(setDetail, stemDetails)
    })
  )

  return {
    sourceType: 'mock',
    sourceId: mockId,
    title: mockDetail.name || 'UCAT Mock',
    questions: setPayloads.flat(),
  }
}

export async function getQuestionEngineExam(params: {
  mode: QuestionEngineMode
  setId?: string
  mockId?: string
}): Promise<QuestionEngineExam> {
  if (params.mode === 'set') {
    const setId = params.setId ?? (await loadFirstSetId())
    return buildSetExam(setId)
  }

  const mockId = params.mockId ?? (await loadFirstMockId())
  return buildMockExam(mockId)
}
