import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/server'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await getSupabaseServerClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError) {
    return NextResponse.json({ error: 'Failed to get user' }, { status: 500 })
  }

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await request.json()) as { complete?: boolean }

  if (!body.complete) {
    return NextResponse.json({ error: 'Unsupported operation' }, { status: 400 })
  }

  const attemptId = params.id

  const { data: attempt, error: attemptError } = await supabase
    .from('student_question_set_attempts')
    .select('attempted_at, question_set_id')
    .eq('id', attemptId)
    .eq('student_id', user.id)
    .maybeSingle()

  if (attemptError) {
    return NextResponse.json({ error: attemptError.message }, { status: 500 })
  }

  if (!attempt) {
    return NextResponse.json({ error: 'Set attempt not found' }, { status: 404 })
  }

  const attemptedAt = new Date(attempt.attempted_at)
  const now = new Date()
  const timeTakenSeconds = Math.max(
    0,
    Math.floor((now.getTime() - attemptedAt.getTime()) / 1000)
  )

  const { data: questionAttempts, error: questionAttemptsError } = await supabase
    .from('student_question_attempts')
    .select('id, question_id, question_answer_option_id')
    .eq('student_question_set_attempt_id', attemptId)
    .eq('student_id', user.id)

  if (questionAttemptsError) {
    return NextResponse.json({ error: questionAttemptsError.message }, { status: 500 })
  }

  let totalQuestions = 0
  let correctCount = 0

  if (questionAttempts && questionAttempts.length > 0) {
    totalQuestions = questionAttempts.length

    const questionIds = questionAttempts.map((qa) => qa.question_id)

    const { data: correctOptions, error: correctOptionsError } = await supabase
      .from('question_answer_options')
      .select('id, question_id, is_answer')
      .in('question_id', questionIds)

    if (correctOptionsError) {
      return NextResponse.json({ error: correctOptionsError.message }, { status: 500 })
    }

    const correctOptionByQuestionId = new Map<string, string>()
    ;(correctOptions || []).forEach((opt) => {
      if (opt.is_answer) {
        correctOptionByQuestionId.set(opt.question_id, opt.id)
      }
    })

    const updates = questionAttempts.map((qa) => {
      const correctOptionId = correctOptionByQuestionId.get(qa.question_id)
      const isCorrect = !!correctOptionId && qa.question_answer_option_id === correctOptionId
      if (isCorrect) {
        correctCount += 1
      }
      return {
        id: qa.id,
        score: isCorrect ? 1 : 0,
        is_submitted: true,
      }
    })

    if (updates.length > 0) {
      const { error: updateQuestionsError } = await supabase
        .from('student_question_attempts')
        .upsert(updates, { onConflict: 'id' })

      if (updateQuestionsError) {
        return NextResponse.json({ error: updateQuestionsError.message }, { status: 500 })
      }
    }
  }

  const { error: updateSetError } = await supabase
    .from('student_question_set_attempts')
    .update({
      time_taken_seconds: timeTakenSeconds,
      completed_at: now.toISOString(),
      score_points: totalQuestions === 0 ? null : correctCount,
      total_points: totalQuestions === 0 ? null : totalQuestions,
    })
    .eq('id', attemptId)
    .eq('student_id', user.id)

  if (updateSetError) {
    return NextResponse.json({ error: updateSetError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

