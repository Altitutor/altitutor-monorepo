import { NextRequest, NextResponse } from 'next/server'
import type { Database } from '@altitutor/shared'
import { requireUcatTutor } from '@/features/ucat/shared/server/guard'
import { extractTextFromRichJson } from '@/features/ucat/shared/lib/rich-text'
import type { JsonLike } from '@/features/ucat/shared/lib/rich-text'

type SetAttemptDetailRow = Database['public']['Views']['vtutor_ucat_student_set_attempt_detail']['Row']
type QuestionSetDetailRow = Database['public']['Views']['vtutor_ucat_question_set_detail']['Row']
type QuestionStemRow = Database['public']['Views']['vtutor_ucat_question_stems']['Row']
type CategoryRow = Database['public']['Views']['vtutor_ucat_question_stem_categories']['Row']
type QuestionAttemptRow = Database['public']['Views']['vtutor_ucat_student_question_attempts_for_progress']['Row']

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
    score: number | null
    timeSpentSeconds: number | null
    questionType: 'multiple_choice' | 'syllogism' | null
    result: 'correct' | 'partial' | 'incorrect' | 'not_attempted'
    categoryName: string | null
    questionStemCategoryId: string | null
  }[]
}

type StemWithQuestions = {
  stem_id: string
  stem_text?: string
  questions_meta?: Array<{ id: string; index: number }>
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ studentId: string; attemptId: string }> }
) {
  const access = await requireUcatTutor()
  if (!access.ok) return access.response

  const { studentId, attemptId } = await params
  if (!studentId || !attemptId) {
    return NextResponse.json({ error: 'Missing studentId or attemptId' }, { status: 400 })
  }

  const supabase = access.userClient

  const { data: attempt, error: attemptError } = await supabase
    .from('vtutor_ucat_student_set_attempt_detail')
    .select(
      'attempt_id, question_set_id, attempted_at, completed_at, score_points, total_points, scaled_score, questions'
    )
    .eq('attempt_id', attemptId)
    .eq('student_id', studentId)
    .maybeSingle()

  if (attemptError) {
    return NextResponse.json({ error: attemptError.message }, { status: 500 })
  }

  const attemptTyped = attempt as SetAttemptDetailRow | null
  if (!attemptTyped) {
    return NextResponse.json({ error: 'Set attempt not found' }, { status: 404 })
  }

  const questionSetId = attemptTyped.question_set_id
  if (!questionSetId) {
    return NextResponse.json(
      { error: 'Set attempt has no question set' },
      { status: 400 }
    )
  }

  const { data: setDetail, error: setError } = await supabase
    .from('vtutor_ucat_question_set_detail')
    .select('id, name, stems')
    .eq('id', questionSetId)
    .maybeSingle()

  if (setError) {
    return NextResponse.json({ error: setError.message }, { status: 500 })
  }

  const setDetailTyped = setDetail as QuestionSetDetailRow | null
  const stems = (setDetailTyped?.stems ?? []) as StemWithQuestions[]
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
      .from('vtutor_ucat_question_stems')
      .select('id, question_stem_category_id')
      .in('id', stemIds)
    const stemCategoriesTyped = (stemCategories ?? []) as QuestionStemRow[]
    const categoryIds = [
      ...new Set(
        stemCategoriesTyped
          .map((s) => s.question_stem_category_id)
          .filter((id): id is string => !!id)
      ),
    ]
    if (categoryIds.length > 0) {
      const { data: categories } = await supabase
        .from('vtutor_ucat_question_stem_categories')
        .select('id, name')
        .in('id', categoryIds)
      const categoriesTyped = (categories ?? []) as CategoryRow[]
      const categoryByName = new Map(
        categoriesTyped.map((c) => [c.id, c.name ?? 'Unknown'])
      )
      for (const s of stemCategoriesTyped) {
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
    .from('vtutor_ucat_student_question_attempts_for_progress')
    .select('question_id, score, time_spent_seconds, question_type, category_name, question_stem_category_id')
    .eq('student_question_set_attempt_id', attemptId)
    .eq('student_id', studentId)
    .eq('is_submitted', true)

  if (qaError) {
    return NextResponse.json({ error: qaError.message }, { status: 500 })
  }

  const questionAttemptsTyped = (questionAttemptsRaw ?? []) as QuestionAttemptRow[]
  const attemptsByQuestionId = new Map(
    questionAttemptsTyped.map((qa) => [
      qa.question_id,
      {
        score: qa.score,
        timeSpentSeconds: qa.time_spent_seconds,
        questionType: qa.question_type as 'multiple_choice' | 'syllogism' | null,
        categoryName: qa.category_name,
        questionStemCategoryId: qa.question_stem_category_id,
      },
    ])
  )

  const questionAttempts = orderedQuestions.map(({ questionId, stemId }, index) => {
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

    return {
      questionNumber,
      questionId,
      score,
      timeSpentSeconds,
      questionType,
      result,
      categoryName,
      questionStemCategoryId,
    }
  })

  const questionSetName =
    setDetailTyped?.name != null
      ? extractTextFromRichJson(setDetailTyped.name as JsonLike) || null
      : null

  const response: SetAttemptDetailResponse = {
    id: attemptTyped.attempt_id ?? attemptId,
    questionSetId,
    questionSetName,
    scorePoints: attemptTyped.score_points,
    totalPoints: attemptTyped.total_points,
    scaledScore: attemptTyped.scaled_score,
    attemptedAt: attemptTyped.attempted_at ?? '',
    completedAt: attemptTyped.completed_at,
    questionAttempts,
  }

  return NextResponse.json(response)
}
