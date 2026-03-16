import { NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/server'

export type SectionProgress = {
  sectionId: string
  sectionName: string
  sectionNumber: number
  correctScore: number
  maxScore: number
  percentage: number
}

export type SetAttemptRow = {
  id: string
  attemptedAt: string
  completedAt: string | null
  questionSetId: string
  studentUcatMockAttemptId: string | null
  scorePoints: number | null
  totalPoints: number | null
  scaledScore: number | null
  timeTakenSeconds: number | null
  setTimeLimitSeconds: number | null
  studentSetSpeed: number | null
  studentExamSpeed: number | null
}

export type MockAttemptRow = {
  id: string
  attemptedAt: string
  completedAt: string | null
  ucatMockId: string
  scorePoints: number | null
  totalPoints: number | null
  scaledScore: number | null
  timeTakenSeconds: number | null
  setTimeLimitSeconds: number | null
  studentSetSpeed: number | null
  studentExamSpeed: number | null
}

export type ProgressResponse = {
  sectionProgress: SectionProgress[]
  setAttempts: SetAttemptRow[]
  mockAttempts: MockAttemptRow[]
}

export async function GET() {
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

  // Fetch question attempts (submitted only) for section progress
  const { data: questionAttempts, error: qaError } = await supabase
    .from('vstudent_ucat_my_question_attempts')
    .select('ucat_section_id, section_name, section_number, score, question_type')
    .eq('is_submitted', true)

  if (qaError) {
    return NextResponse.json({ error: qaError.message }, { status: 500 })
  }

  // Compute section progress: for syllogism max score = 2, else 1
  const sectionMap = new Map<
    string,
    { name: string; number: number; correct: number; max: number }
  >()
  for (const qa of questionAttempts ?? []) {
    const sectionId = qa.ucat_section_id
    if (!sectionId) continue
    const maxPerQuestion = qa.question_type === 'syllogism' ? 2 : 1
    const existing = sectionMap.get(sectionId)
    if (existing) {
      existing.correct += qa.score ?? 0
      existing.max += maxPerQuestion
    } else {
      sectionMap.set(sectionId, {
        name: qa.section_name ?? 'Unknown',
        number: qa.section_number ?? 0,
        correct: qa.score ?? 0,
        max: maxPerQuestion,
      })
    }
  }

  const sectionProgress: SectionProgress[] = Array.from(sectionMap.entries())
    .map(([sectionId, data]) => ({
      sectionId,
      sectionName: data.name,
      sectionNumber: data.number,
      correctScore: data.correct,
      maxScore: data.max,
      percentage: data.max > 0 ? Math.round((data.correct / data.max) * 100) : 0,
    }))
    .sort((a, b) => a.sectionNumber - b.sectionNumber)

  // Ensure all 4 sections are present (from ucat_sections)
  const { data: sections } = await supabase
    .from('vstudent_ucat_sections')
    .select('id, name, section_number')
    .order('section_number')

  const sectionIds = new Set(sectionProgress.map((s) => s.sectionId))
  for (const sec of sections ?? []) {
    const secId = sec.id
    if (!secId || sectionIds.has(secId)) continue
    sectionProgress.push({
      sectionId: secId,
      sectionName: sec.name ?? 'Unknown',
      sectionNumber: sec.section_number ?? 0,
      correctScore: 0,
      maxScore: 0,
      percentage: 0,
    })
  }
  sectionProgress.sort((a, b) => a.sectionNumber - b.sectionNumber)

  // Fetch set attempts (submitted = completed_at not null)
  // View uses SELECT sqsa.* so extra columns exist at runtime; generated types may be outdated
  const { data: setAttemptsRaw, error: setError } = await supabase
    .from('vstudent_ucat_my_set_attempts')
    .select('*')
    .not('completed_at', 'is', null)

  if (setError) {
    return NextResponse.json({ error: setError.message }, { status: 500 })
  }

  type SetAttemptRaw = {
    id: string | null
    attempted_at: string | null
    completed_at: string | null
    question_set_id: string | null
    student_ucat_mock_attempt_id: string | null
    score_points: number | null
    total_points: number | null
    scaled_score: number | null
    time_taken_seconds: number | null
    set_time_limit_seconds?: number | null
    student_set_speed?: number | null
    student_exam_speed?: number | null
  }

  // Enrich with time_limit from question_sets when missing (trigger may not have run for older attempts)
  const setIds = [...new Set((setAttemptsRaw ?? []).map((r) => (r as SetAttemptRaw).question_set_id).filter(Boolean))]
  const { data: setDetails } = setIds.length > 0
    ? await supabase
        .from('vstudent_ucat_question_sets')
        .select('id, time_limit_seconds, time_limit_at_exam_speed_seconds')
        .in('id', setIds)
    : { data: [] }

  const timeLimitBySetId = new Map(
    (setDetails ?? []).map((s) => [
      s.id,
      {
        timeLimit: s.time_limit_seconds,
        timeLimitExam: s.time_limit_at_exam_speed_seconds,
      },
    ])
  )

  const setAttempts: SetAttemptRow[] = ((setAttemptsRaw ?? []) as SetAttemptRaw[]).map((row) => {
    const timeTaken = row.time_taken_seconds ?? null
    let setTimeLimit = row.set_time_limit_seconds ?? null
    let timeLimitExam: number | null = null

    if (!setTimeLimit && row.question_set_id) {
      const details = timeLimitBySetId.get(row.question_set_id)
      setTimeLimit = details?.timeLimit ?? null
      timeLimitExam = details?.timeLimitExam ?? null
    } else if (row.question_set_id) {
      const details = timeLimitBySetId.get(row.question_set_id)
      timeLimitExam = details?.timeLimitExam ?? null
    }

    // Compute speeds when null (fallback for older attempts or when trigger didn't run)
    let studentSetSpeed = row.student_set_speed ?? null
    let studentExamSpeed = row.student_exam_speed ?? null
    if (timeTaken != null && timeTaken > 0) {
      if (studentSetSpeed == null && setTimeLimit != null && setTimeLimit > 0) {
        studentSetSpeed = setTimeLimit / timeTaken
      }
      if (studentExamSpeed == null && timeLimitExam != null && timeLimitExam > 0) {
        studentExamSpeed = timeLimitExam / timeTaken
      }
    }

    return {
      id: row.id ?? '',
      attemptedAt: row.attempted_at ?? '',
      completedAt: row.completed_at,
      questionSetId: row.question_set_id ?? '',
      studentUcatMockAttemptId: row.student_ucat_mock_attempt_id,
      scorePoints: row.score_points,
      totalPoints: row.total_points,
      scaledScore: row.scaled_score,
      timeTakenSeconds: timeTaken,
      setTimeLimitSeconds: setTimeLimit,
      studentSetSpeed,
      studentExamSpeed,
    }
  })

  // Fetch mock attempts (submitted = completed_at not null)
  // Note: vstudent_ucat_my_mock_attempts view types may be outdated; score columns from table
  const { data: mockAttemptsRaw, error: mockError } = await supabase
    .from('vstudent_ucat_my_mock_attempts')
    .select('id, attempted_at, completed_at, ucat_mock_id')
    .not('completed_at', 'is', null)

  if (mockError) {
    return NextResponse.json({ error: mockError.message }, { status: 500 })
  }

  type MockAttemptRaw = (typeof mockAttemptsRaw)[number]

  // Enrich mock attempts with aggregated timing and scores from child set attempts
  const mockAttempts: MockAttemptRow[] = []
  for (const m of mockAttemptsRaw ?? []) {
    const row = m as MockAttemptRaw
    const childSets = setAttempts.filter(
      (s) => s.studentUcatMockAttemptId === row.id
    )
    const timeTakenSeconds = childSets.reduce(
      (sum, s) => sum + (s.timeTakenSeconds ?? 0),
      0
    )
    const setTimeLimitSeconds = childSets.reduce(
      (sum, s) => sum + (s.setTimeLimitSeconds ?? 0),
      0
    )
    const scorePoints = childSets.reduce((sum, s) => sum + (s.scorePoints ?? 0), 0)
    const totalPoints = childSets.reduce((sum, s) => sum + (s.totalPoints ?? 0), 0)
    const scaledScore = childSets.reduce((sum, s) => sum + (s.scaledScore ?? 0), 0)
    const speeds = childSets.filter(
      (s) => s.studentSetSpeed != null || s.studentExamSpeed != null
    )
    const studentSetSpeed =
      speeds.length > 0
        ? speeds.reduce((sum, s) => sum + (s.studentSetSpeed ?? 0), 0) /
          speeds.length
        : null
    const studentExamSpeed =
      speeds.length > 0
        ? speeds.reduce((sum, s) => sum + (s.studentExamSpeed ?? 0), 0) /
          speeds.length
        : null

    mockAttempts.push({
      id: row.id ?? '',
      attemptedAt: row.attempted_at ?? '',
      completedAt: row.completed_at,
      ucatMockId: row.ucat_mock_id ?? '',
      scorePoints: totalPoints > 0 ? scorePoints : null,
      totalPoints: totalPoints > 0 ? totalPoints : null,
      scaledScore: totalPoints > 0 ? scaledScore : null,
      timeTakenSeconds: setTimeLimitSeconds > 0 ? timeTakenSeconds : null,
      setTimeLimitSeconds: setTimeLimitSeconds > 0 ? setTimeLimitSeconds : null,
      studentSetSpeed,
      studentExamSpeed,
    })
  }

  return NextResponse.json({
    sectionProgress,
    setAttempts,
    mockAttempts,
  } satisfies ProgressResponse)
}
