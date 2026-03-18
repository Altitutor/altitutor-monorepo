import { NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/server'

export type PracticeAttemptDetailResponse = {
  id: string
  sectionName: string | null
  sectionKey: string
  scorePoints: number | null
  totalPoints: number | null
  questionCount: number | null
  attemptedAt: string
  completedAt: string | null
  stemsSnapshot: unknown
  questionAttempts: {
    questionNumber: number
    questionId: string
    stemIndex: number
    score: number | null
    timeSpentSeconds: number | null
    questionType: 'multiple_choice' | 'syllogism' | null
    result: 'correct' | 'partial' | 'incorrect' | 'not_attempted'
    categoryName: string | null
    questionStemCategoryId: string | null
    questionAnswerOptionId: string | null
    answerSnapshot: Record<string, boolean> | null
  }[]
}

function parseAnswerSnapshot(
  snapshot: unknown
): Record<string, boolean> | null {
  if (!snapshot || typeof snapshot !== 'object') return null
  const obj = snapshot as Record<string, unknown>
  if (obj.type !== 'syllogism_v1' || !Array.isArray(obj.answers)) return null
  const answers = obj.answers as Array<{
    question_answer_option_id: string
    answer: boolean
  }>
  const result: Record<string, boolean> = {}
  for (const a of answers) {
    result[a.question_answer_option_id] = a.answer
  }
  return result
}

type StemWithQuestions = {
  id: string
  questions?: Array<{ id: string; index: number }>
}

function getOrderedQuestionIds(stems: StemWithQuestions[]): { questionId: string; stemId: string }[] {
  const result: { questionId: string; stemId: string }[] = []
  for (const stem of stems) {
    const questions = stem.questions ?? []
    for (const q of questions.sort((a, b) => a.index - b.index)) {
      result.push({ questionId: q.id, stemId: stem.id })
    }
  }
  return result
}

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await getSupabaseServerClient()
  const sessionId = params.id

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 500 })
  }

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: session, error: sessionError } = await (
    supabase as { from: (t: string) => ReturnType<typeof supabase.from> }
  )
    .from('vstudent_ucat_my_practice_sessions')
    .select(
      'id, section_name, section_key, score_points, total_points, question_count, started_at, completed_at, stems_snapshot'
    )
    .eq('id', sessionId)
    .maybeSingle()

  if (sessionError) {
    return NextResponse.json({ error: sessionError.message }, { status: 500 })
  }

  if (!session) {
    return NextResponse.json({ error: 'Practice session not found' }, { status: 404 })
  }

  type SessionRaw = {
    id?: string | null
    section_name?: string | null
    section_key?: string | null
    score_points?: number | null
    total_points?: number | null
    question_count?: number | null
    started_at?: string | null
    completed_at?: string | null
    stems_snapshot?: unknown
  }
  const s = session as SessionRaw
  const stemsSnapshot = s.stems_snapshot ?? []
  const stems = Array.isArray(stemsSnapshot) ? stemsSnapshot : []
  const orderedQuestions = getOrderedQuestionIds(stems as StemWithQuestions[])

  const { data: questionAttemptsRaw, error: qaError } = await supabase
    .from('vstudent_ucat_my_question_attempts')
    .select(
      'question_id, score, time_spent_seconds, question_type, category_name, question_stem_category_id, question_answer_option_id, answer_snapshot'
    )
    .eq('student_practice_session_id', sessionId)
    .eq('is_submitted', true)

  if (qaError) {
    return NextResponse.json({ error: qaError.message }, { status: 500 })
  }

  const attemptsByQuestionId = new Map(
    (questionAttemptsRaw ?? []).map((qa) => [
      qa.question_id,
      {
        score: qa.score,
        timeSpentSeconds: qa.time_spent_seconds,
        questionType: qa.question_type as 'multiple_choice' | 'syllogism' | null,
        categoryName: qa.category_name,
        questionStemCategoryId: qa.question_stem_category_id,
        questionAnswerOptionId: qa.question_answer_option_id ?? null,
        answerSnapshot: parseAnswerSnapshot(qa.answer_snapshot),
      },
    ])
  )

  let currentStemId: string | null = null
  let stemIndex = 0
  const questionAttempts = orderedQuestions.map(({ questionId, stemId }, index) => {
    if (stemId !== currentStemId) {
      currentStemId = stemId
      stemIndex += 1
    }
    const attemptData = attemptsByQuestionId.get(questionId)
    const questionNumber = index + 1
    const score = attemptData?.score ?? null
    const timeSpentSeconds = attemptData?.timeSpentSeconds ?? null
    const questionType = attemptData?.questionType ?? null

    let result: 'correct' | 'partial' | 'incorrect' | 'not_attempted'
    if (attemptData == null) {
      result = 'not_attempted'
    } else {
      const maxScore = questionType === 'syllogism' ? 2 : 1
      if (score == null) {
        result = 'not_attempted'
      } else if (score >= maxScore) {
        result = 'correct'
      } else if (score > 0) {
        result = 'partial'
      } else {
        result = 'incorrect'
      }
    }

    return {
      questionNumber,
      questionId,
      stemIndex,
      score,
      timeSpentSeconds,
      questionType,
      result,
      categoryName: attemptData?.categoryName ?? null,
      questionStemCategoryId: attemptData?.questionStemCategoryId ?? null,
      questionAnswerOptionId: attemptData?.questionAnswerOptionId ?? null,
      answerSnapshot: attemptData?.answerSnapshot ?? null,
    }
  })

  const response: PracticeAttemptDetailResponse = {
    id: s.id ?? '',
    sectionName: s.section_name ?? null,
    sectionKey: s.section_key ?? '',
    scorePoints: s.score_points ?? null,
    totalPoints: s.total_points ?? null,
    questionCount: s.question_count ?? null,
    attemptedAt: s.started_at ?? '',
    completedAt: s.completed_at ?? null,
    stemsSnapshot,
    questionAttempts,
  }

  return NextResponse.json(response)
}
