import { NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { extractTextFromRichJson } from '@/features/question-engine/model/rich-text'
import type { JsonLike } from '@/features/question-engine/model/rich-text'

export type SetAttemptDetailResponse = {
  id: string
  questionSetId: string
  questionSetName: string | null
  scorePoints: number | null
  totalPoints: number | null
  scaledScore: number | null
  attemptedAt: string
  completedAt: string | null
  questionAttempts: {
    questionNumber: number
    questionId: string
    /** 1-based stem index within the set */
    stemIndex: number
    score: number | null
    timeSpentSeconds: number | null
    questionType: 'multiple_choice' | 'syllogism' | null
    /** 'correct' | 'partial' | 'incorrect' | 'not_attempted' */
    result: 'correct' | 'partial' | 'incorrect' | 'not_attempted'
    categoryName: string | null
    questionStemCategoryId: string | null
    /** For answers view: selected option id (multiple choice) or null */
    questionAnswerOptionId: string | null
    /** For answers view: syllogism snapshot { optionId: boolean } */
    answerSnapshot: Record<string, boolean> | null
  }[]
}

type StemWithQuestions = {
  stem_id: string
  stem_text?: string
  questions_meta?: Array<{ id: string; index: number }>
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

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await getSupabaseServerClient()
  const attemptId = params.id

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

  const { data: attempt, error: attemptError } = await supabase
    .from('vstudent_ucat_my_set_attempts')
    .select(
      'id, attempted_at, completed_at, question_set_id, score_points, total_points, scaled_score'
    )
    .eq('id', attemptId)
    .maybeSingle()

  if (attemptError) {
    return NextResponse.json({ error: attemptError.message }, { status: 500 })
  }

  if (!attempt) {
    return NextResponse.json({ error: 'Set attempt not found' }, { status: 404 })
  }

  const questionSetId = attempt.question_set_id
  if (!questionSetId) {
    return NextResponse.json(
      { error: 'Set attempt has no question set' },
      { status: 400 }
    )
  }

  const { data: setDetail, error: setError } = await supabase
    .from('vstudent_ucat_question_set_detail')
    .select('id, name, stems')
    .eq('id', questionSetId)
    .maybeSingle()

  if (setError) {
    return NextResponse.json({ error: setError.message }, { status: 500 })
  }

  const stems = (setDetail?.stems ?? []) as StemWithQuestions[]
  const stemIds = stems.map((s) => s.stem_id).filter(Boolean)
  const orderedQuestions: { questionId: string; stemId: string }[] = []
  for (const stem of stems) {
    const questions = stem.questions_meta ?? []
    for (const q of questions.sort((a, b) => a.index - b.index)) {
      orderedQuestions.push({ questionId: q.id, stemId: stem.stem_id })
    }
  }

  const stemCategoryMap = new Map<string, { categoryId: string; categoryName: string }>()
  if (stemIds.length > 0) {
    const { data: stemCategories } = await supabase
      .from('vstudent_ucat_question_stems')
      .select('id, question_stem_category_id')
      .in('id', stemIds)
    const categoryIds = [
      ...new Set(
        (stemCategories ?? [])
          .map((s) => s.question_stem_category_id)
          .filter((id): id is string => !!id)
      ),
    ]
    if (categoryIds.length > 0) {
      const { data: categories } = await supabase
        .from('vstudent_ucat_question_stem_categories')
        .select('id, name')
        .in('id', categoryIds)
      const categoryByName = new Map(
        (categories ?? []).map((c) => [c.id, c.name ?? 'Unknown'])
      )
      for (const s of stemCategories ?? []) {
        const catId = s.question_stem_category_id
        if (catId) {
          stemCategoryMap.set(s.id ?? '', {
            categoryId: catId,
            categoryName: categoryByName.get(catId) ?? 'Unknown',
          })
        }
      }
    }
  }

  const { data: questionAttemptsRaw, error: qaError } = await supabase
    .from('vstudent_ucat_my_question_attempts')
    .select('question_id, score, time_spent_seconds, question_type, category_name, question_stem_category_id, question_answer_option_id, answer_snapshot')
    .eq('student_question_set_attempt_id', attemptId)
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
    const stemCategory = stemCategoryMap.get(stemId)
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

    const categoryName = attemptData?.categoryName ?? stemCategory?.categoryName ?? null
    const questionStemCategoryId = attemptData?.questionStemCategoryId ?? stemCategory?.categoryId ?? null

    const questionAnswerOptionId = attemptData?.questionAnswerOptionId ?? null
    const answerSnapshot = attemptData?.answerSnapshot ?? null

    return {
      questionNumber,
      questionId,
      stemIndex,
      score,
      timeSpentSeconds,
      questionType,
      result,
      categoryName,
      questionStemCategoryId,
      questionAnswerOptionId,
      answerSnapshot,
    }
  })

  const questionSetName =
    setDetail?.name != null
      ? extractTextFromRichJson(setDetail.name as JsonLike) || null
      : null

  const response: SetAttemptDetailResponse = {
    id: attempt.id ?? '',
    questionSetId,
    questionSetName,
    scorePoints: attempt.score_points,
    totalPoints: attempt.total_points,
    scaledScore: attempt.scaled_score,
    attemptedAt: attempt.attempted_at ?? '',
    completedAt: attempt.completed_at,
    questionAttempts,
  }

  return NextResponse.json(response)
}
