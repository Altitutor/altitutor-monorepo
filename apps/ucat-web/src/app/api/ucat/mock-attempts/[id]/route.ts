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
    .from('student_ucat_mock_attempts')
    .select('attempted_at')
    .eq('id', attemptId)
    .eq('student_id', user.id)
    .maybeSingle()

  if (attemptError) {
    return NextResponse.json({ error: attemptError.message }, { status: 500 })
  }

  if (!attempt) {
    return NextResponse.json({ error: 'Mock attempt not found' }, { status: 404 })
  }

  const now = new Date()

  const { data: setAttempts, error: setAttemptsError } = await supabase
    .from('student_question_set_attempts')
    .select(
      'score_points, total_points, scaled_score, time_taken_seconds, set_time_limit_seconds, set_time_limit_at_exam_speed_seconds'
    )
    .eq('student_ucat_mock_attempt_id', attemptId)
    .eq('student_id', user.id)

  if (setAttemptsError) {
    return NextResponse.json({ error: setAttemptsError.message }, { status: 500 })
  }

  const attempts = setAttempts ?? []
  const scorePoints = attempts.reduce((sum, a) => sum + (a.score_points ?? 0), 0)
  const totalPoints = attempts.reduce((sum, a) => sum + (a.total_points ?? 0), 0)
  const scaledScore = attempts.reduce((sum, a) => sum + (a.scaled_score ?? 0), 0)
  const timeTaken = attempts.reduce((sum, a) => sum + (a.time_taken_seconds ?? 0), 0)
  const mockTimeLimitSeconds = attempts.reduce(
    (sum, a) => sum + (a.set_time_limit_seconds ?? 0),
    0
  )
  const mockTimeLimitAtExamSpeedSeconds = attempts.reduce(
    (sum, a) => sum + (Number(a.set_time_limit_at_exam_speed_seconds) || 0),
    0
  )
  const studentMockSpeed =
    timeTaken > 0 && mockTimeLimitSeconds > 0
      ? mockTimeLimitSeconds / timeTaken
      : null

  const { error: updateError } = await supabase
    .from('student_ucat_mock_attempts')
    .update({
      completed_at: now.toISOString(),
      score_points: totalPoints > 0 ? scorePoints : null,
      total_points: totalPoints > 0 ? totalPoints : null,
      scaled_score: totalPoints > 0 ? scaledScore : null,
      time_taken: timeTaken > 0 ? timeTaken : null,
      mock_time_limit_seconds: mockTimeLimitSeconds > 0 ? mockTimeLimitSeconds : null,
      mock_time_limit_at_exam_speed_seconds:
        mockTimeLimitAtExamSpeedSeconds > 0 ? mockTimeLimitAtExamSpeedSeconds : null,
      student_mock_speed: studentMockSpeed,
    })
    .eq('id', attemptId)
    .eq('student_id', user.id)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

