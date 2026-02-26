import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
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

  const body = (await request.json()) as {
    studentQuestionSetAttemptId: string | null
    questionId: string
    questionAnswerOptionId: string | null
  }

  if (!body.questionId) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const { data: existing, error: existingError } = await supabase
    .from('student_question_attempts')
    .select('id')
    .eq('student_id', user.id)
    .eq('student_question_set_attempt_id', body.studentQuestionSetAttemptId)
    .eq('question_id', body.questionId)
    .maybeSingle()

  if (existingError && existingError.code !== 'PGRST116' && existingError.code !== 'PGRST123') {
    return NextResponse.json({ error: existingError.message }, { status: 500 })
  }

  if (existing) {
    const { error: updateError } = await supabase
      .from('student_question_attempts')
      .update({
        question_answer_option_id: body.questionAnswerOptionId,
        is_submitted: false,
      })
      .eq('id', existing.id)
      .eq('student_id', user.id)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({ id: existing.id })
  }

  const insertPayload = {
    student_id: user.id,
    student_question_set_attempt_id: body.studentQuestionSetAttemptId,
    question_id: body.questionId,
    question_answer_option_id: body.questionAnswerOptionId,
    is_flagged: false,
    is_submitted: false,
  }

  const { data: inserted, error: insertError } = await supabase
    .from('student_question_attempts')
    .insert(insertPayload)
    .select('id')
    .maybeSingle()

  if (insertError || !inserted) {
    return NextResponse.json({ error: insertError?.message ?? 'Failed to insert question attempt' }, { status: 500 })
  }

  return NextResponse.json({ id: inserted.id })
}

