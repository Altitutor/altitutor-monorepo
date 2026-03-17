import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

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

  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Server write client not configured' }, { status: 500 })
  }

  const { data: student, error: studentError } = await supabaseAdmin
    .from('students')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (studentError) {
    return NextResponse.json({ error: studentError.message }, { status: 500 })
  }

  if (!student) {
    return NextResponse.json({ error: 'No student profile found' }, { status: 404 })
  }

  const attemptId = params.id

  const { data: attempt, error: attemptError } = await supabaseAdmin
    .from('student_ucat_mock_attempts')
    .select('attempted_at')
    .eq('id', attemptId)
    .eq('student_id', student.id)
    .maybeSingle()

  if (attemptError) {
    return NextResponse.json({ error: attemptError.message }, { status: 500 })
  }

  if (!attempt) {
    return NextResponse.json({ error: 'Mock attempt not found' }, { status: 404 })
  }

  const now = new Date()

  const { data: setAttempts, error: setAttemptsError } = await supabaseAdmin
    .from('student_question_set_attempts')
    .select(
      'question_set_id, score_points, total_points, scaled_score, time_taken_seconds, set_time_limit_seconds, set_time_limit_at_exam_speed_seconds'
    )
    .eq('student_ucat_mock_attempt_id', attemptId)
    .eq('student_id', student.id)

  if (setAttemptsError) {
    return NextResponse.json({ error: setAttemptsError.message }, { status: 500 })
  }

  const attempts = setAttempts ?? []
  const setIds = [...new Set(attempts.map((a) => a.question_set_id).filter(Boolean))]

  // Fetch section info to exclude Section 4 (Situational Judgement) from mock score
  const { data: setDetails } =
    setIds.length > 0
      ? await supabaseAdmin
          .from('question_sets')
          .select('id, sections')
          .in('id', setIds)
      : { data: [] }

  const sectionNumberBySetId = new Map<string, number>()
  for (const s of setDetails ?? []) {
    const sections = s.sections as Array<{ section_number?: number }> | null
    const firstNum =
      Array.isArray(sections) && sections.length > 0
        ? sections[0]?.section_number
        : undefined
    if (firstNum != null) sectionNumberBySetId.set(s.id, firstNum)
  }

  const SITUATIONAL_JUDGEMENT_SECTION = 4
  const scoredAttempts = attempts.filter((a) => {
    const sectionNum = a.question_set_id ? sectionNumberBySetId.get(a.question_set_id) : undefined
    return sectionNum !== SITUATIONAL_JUDGEMENT_SECTION
  })

  const scorePoints = scoredAttempts.reduce((sum, a) => sum + (a.score_points ?? 0), 0)
  const totalPoints = scoredAttempts.reduce((sum, a) => sum + (a.total_points ?? 0), 0)
  const scaledScore = scoredAttempts.reduce((sum, a) => sum + (a.scaled_score ?? 0), 0)
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

  const { error: updateError } = await supabaseAdmin
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
    .eq('student_id', student.id)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

