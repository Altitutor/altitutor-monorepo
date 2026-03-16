import { NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { extractTextFromRichJson } from '@/features/question-engine/model/rich-text'
import type { JsonLike } from '@/features/question-engine/model/rich-text'

export type SectionProgress = {
  sectionId: string
  sectionName: string
  sectionNumber: number
  correctScore: number
  maxScore: number
  percentage: number
  averageScaledScore: number | null
  weightedAverageScaledScore: number | null
  weightedAveragePercentage: number | null
}

export type SetAttemptRow = {
  id: string
  attemptedAt: string
  completedAt: string | null
  questionSetId: string
  questionSetName: string | null
  isStudentGenerated: boolean
  studentUcatMockAttemptId: string | null
  scorePoints: number | null
  totalPoints: number | null
  scaledScore: number | null
  timeTakenSeconds: number | null
  setTimeLimitSeconds: number | null
  studentSetSpeed: number | null
  studentExamSpeed: number | null
  wasTimed: boolean
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
  wasTimed: boolean
}

export type QuestionAttemptRow = {
  id: string
  attemptedAt: string
  score: number | null
  questionType: string | null
  timeSpentSeconds: number | null
  studentQuestionSpeed: number | null
  wasTimed: boolean
  ucatSectionId: string | null
  sectionName: string | null
  sectionNumber: number | null
}

export type ProgressResponse = {
  sectionProgress: SectionProgress[]
  setAttempts: SetAttemptRow[]
  mockAttempts: MockAttemptRow[]
  questionAttempts: QuestionAttemptRow[]
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

  // Fetch question attempts (submitted only) for section progress and Question Attempts card
  const { data: questionAttemptsAll, error: qaError } = await supabase
    .from('vstudent_ucat_my_question_attempts')
    .select(
      'id, attempted_at, ucat_section_id, section_name, section_number, score, question_type, time_spent_seconds, student_question_speed, was_timed'
    )
    .eq('is_submitted', true)

  if (qaError) {
    return NextResponse.json({ error: qaError.message }, { status: 500 })
  }

  // Compute section progress: for syllogism max score = 2, else 1
  const sectionMap = new Map<
    string,
    { name: string; number: number; correct: number; max: number }
  >()
  for (const qa of questionAttemptsAll ?? []) {
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

  let sectionProgress: SectionProgress[] = Array.from(sectionMap.entries())
    .map(([sectionId, data]) => ({
      sectionId,
      sectionName: data.name,
      sectionNumber: data.number,
      correctScore: data.correct,
      maxScore: data.max,
      percentage: data.max > 0 ? Math.round((data.correct / data.max) * 100) : 0,
      averageScaledScore: null as number | null,
      weightedAverageScaledScore: null as number | null,
      weightedAveragePercentage: null as number | null,
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
      averageScaledScore: null,
      weightedAverageScaledScore: null,
      weightedAveragePercentage: null,
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
    was_timed?: boolean
  }

  // Enrich with time_limit and name from question_sets when missing (trigger may not have run for older attempts)
  const setIds = [...new Set((setAttemptsRaw ?? []).map((r) => (r as SetAttemptRaw).question_set_id).filter(Boolean))]
  const { data: setDetails } = setIds.length > 0
    ? await supabase
        .from('vstudent_ucat_question_sets')
        .select('id, name, time_limit_seconds, time_limit_at_exam_speed_seconds, sections, is_student_generated')
        .in('id', setIds)
    : { data: [] }

  const timeLimitBySetId = new Map(
    (setDetails ?? []).map((s) => [
      s.id,
      {
        timeLimit: s.time_limit_seconds,
        timeLimitExam: s.time_limit_at_exam_speed_seconds,
        name: s.name,
        sections: s.sections as Array<{ section_number?: number }> | null,
        isStudentGenerated: s.is_student_generated ?? false,
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

    const details = row.question_set_id ? timeLimitBySetId.get(row.question_set_id) : undefined
    const questionSetName = details?.name != null
      ? extractTextFromRichJson(details.name as JsonLike) || null
      : null

    return {
      id: row.id ?? '',
      attemptedAt: row.attempted_at ?? '',
      completedAt: row.completed_at,
      questionSetId: row.question_set_id ?? '',
      questionSetName: questionSetName || null,
      isStudentGenerated: details?.isStudentGenerated ?? false,
      studentUcatMockAttemptId: row.student_ucat_mock_attempt_id,
      scorePoints: row.score_points,
      totalPoints: row.total_points,
      scaledScore: row.scaled_score,
      timeTakenSeconds: timeTaken,
      setTimeLimitSeconds: setTimeLimit,
      studentSetSpeed,
      studentExamSpeed,
      wasTimed: row.was_timed ?? false,
    }
  })

  // Compute average and weighted average (EMA) scaled score per section from standalone set attempts
  const sectionByNumber = new Map(
    sectionProgress.map((s) => [s.sectionNumber, s.sectionId])
  )
  const sectionScaledSums = new Map<string, { sum: number; count: number }>()
  const sectionScaledScoresOrdered = new Map<string, number[]>()
  for (const s of sectionProgress) {
    sectionScaledSums.set(s.sectionId, { sum: 0, count: 0 })
    sectionScaledScoresOrdered.set(s.sectionId, [])
  }
  const standaloneSetAttempts = setAttempts.filter(
    (a) => !a.studentUcatMockAttemptId
  )
  const attemptsWithSection = standaloneSetAttempts
    .filter((a) => {
      if (a.scaledScore == null) return false
      const details = a.questionSetId
        ? timeLimitBySetId.get(a.questionSetId)
        : undefined
      const sectionsArr = details?.sections
      const firstSectionNum =
        Array.isArray(sectionsArr) && sectionsArr.length > 0
          ? sectionsArr[0]?.section_number
          : undefined
      const sectionId =
        firstSectionNum != null ? sectionByNumber.get(firstSectionNum) : undefined
      return sectionId != null
    })
    .map((a) => {
      const details = a.questionSetId
        ? timeLimitBySetId.get(a.questionSetId)
        : undefined
      const sectionsArr = details?.sections
      const firstSectionNum =
        Array.isArray(sectionsArr) && sectionsArr.length > 0
          ? sectionsArr[0]?.section_number
          : undefined
      const sectionId =
        firstSectionNum != null ? sectionByNumber.get(firstSectionNum) : undefined
      return {
        sectionId: sectionId!,
        scaledScore: a.scaledScore!,
        date: a.completedAt ?? a.attemptedAt,
      }
    })
  attemptsWithSection.sort((a, b) => a.date.localeCompare(b.date))
  for (const { sectionId, scaledScore } of attemptsWithSection) {
    const entry = sectionScaledSums.get(sectionId)
    if (entry) {
      entry.sum += scaledScore
      entry.count += 1
    }
    const ordered = sectionScaledScoresOrdered.get(sectionId)
    if (ordered) ordered.push(scaledScore)
  }
  const EMA_ALPHA = 0.5
  const computeEma = (scores: number[]): number | null => {
    if (scores.length === 0) return null
    let ema = scores[0]
    for (let i = 1; i < scores.length; i++) {
      ema = EMA_ALPHA * scores[i] + (1 - EMA_ALPHA) * ema
    }
    return ema
  }
  // Compute weighted average percentage from question attempts (daily % per section, then EMA)
  const sectionDailyPercentages = new Map<string, number[]>()
  for (const s of sectionProgress) {
    sectionDailyPercentages.set(s.sectionId, [])
  }
  const qaBySectionDate = new Map<string, { correct: number; max: number }>()
  for (const qa of questionAttemptsAll ?? []) {
    const sectionId = qa.ucat_section_id
    if (!sectionId) continue
    const dateStr = qa.attempted_at
      ? new Date(qa.attempted_at).toISOString().slice(0, 10)
      : ''
    if (!dateStr) continue
    const key = `${sectionId}:${dateStr}`
    const maxPerQuestion = qa.question_type === 'syllogism' ? 2 : 1
    const existing = qaBySectionDate.get(key)
    if (existing) {
      existing.correct += qa.score ?? 0
      existing.max += maxPerQuestion
    } else {
      qaBySectionDate.set(key, {
        correct: qa.score ?? 0,
        max: maxPerQuestion,
      })
    }
  }
  const sectionDateKeys = [...qaBySectionDate.keys()].sort()
  for (const key of sectionDateKeys) {
    const [sectionId] = key.split(':')
    const { correct, max } = qaBySectionDate.get(key)!
    if (max > 0) {
      const pct = (correct / max) * 100
      const arr = sectionDailyPercentages.get(sectionId)
      if (arr) arr.push(pct)
    }
  }

  sectionProgress = sectionProgress.map((s) => ({
    ...s,
    averageScaledScore: (() => {
      const entry = sectionScaledSums.get(s.sectionId)
      return entry && entry.count > 0 ? entry.sum / entry.count : null
    })(),
    weightedAverageScaledScore: computeEma(
      sectionScaledScoresOrdered.get(s.sectionId) ?? []
    ),
    weightedAveragePercentage: computeEma(
      sectionDailyPercentages.get(s.sectionId) ?? []
    ),
  }))

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

    const wasTimed =
      childSets.length > 0 && childSets.every((s) => s.wasTimed)

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
      wasTimed,
    })
  }

  type QuestionAttemptRaw = {
    id: string | null
    attempted_at: string | null
    score: number | null
    question_type: string | null
    time_spent_seconds: number | null
    student_question_speed: number | null
    was_timed: boolean | null
    ucat_section_id: string | null
    section_name: string | null
    section_number: number | null
  }

  const questionAttempts: QuestionAttemptRow[] = (
    questionAttemptsAll ?? []
  ).map((r: QuestionAttemptRaw) => ({
    id: r.id ?? '',
    attemptedAt: r.attempted_at ?? '',
    score: r.score,
    questionType: r.question_type,
    timeSpentSeconds: r.time_spent_seconds,
    studentQuestionSpeed: r.student_question_speed,
    wasTimed: r.was_timed ?? false,
    ucatSectionId: r.ucat_section_id,
    sectionName: r.section_name,
    sectionNumber: r.section_number ?? 0,
  }))

  return NextResponse.json({
    sectionProgress,
    setAttempts,
    mockAttempts,
    questionAttempts,
  } satisfies ProgressResponse)
}
