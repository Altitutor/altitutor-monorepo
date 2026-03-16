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
  /** Total public question points in this section (syllogism=2, else=1) */
  totalPublicQuestions?: number
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
  /** First section ID for sets with sections (for filtering by section) */
  sectionId: string | null
}

export type MockAttemptRow = {
  id: string
  attemptedAt: string
  completedAt: string | null
  ucatMockId: string
  mockName: string | null
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
  questionStemCategoryId: string | null
  categoryName: string | null
}

export type SectionCategoryProgress = {
  categoryId: string
  categoryName: string
  correctScore: number
  maxScore: number
  percentage: number
  weightedAveragePercentage: number | null
  /** Total public question points in this category (syllogism=2, else=1) */
  totalPublicQuestions?: number
}

export type ProgressResponse = {
  sectionProgress: SectionProgress[]
  setAttempts: SetAttemptRow[]
  mockAttempts: MockAttemptRow[]
  questionAttempts: QuestionAttemptRow[]
  /** Per-section category stats (all-time and weighted %) */
  sectionCategoryProgress: Record<string, SectionCategoryProgress[]>
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
      'id, attempted_at, ucat_section_id, section_name, section_number, score, question_type, time_spent_seconds, student_question_speed, was_timed, question_stem_category_id, category_name'
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

  const sectionByNumber = new Map(
    sectionProgress.map((s) => [s.sectionNumber, s.sectionId])
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

    const sectionsArr = details?.sections
    const firstSectionNum =
      Array.isArray(sectionsArr) && sectionsArr.length > 0
        ? sectionsArr[0]?.section_number
        : undefined
    const sectionId =
      firstSectionNum != null ? sectionByNumber.get(firstSectionNum) ?? null : null

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
      sectionId,
    }
  })

  // Compute average and weighted average (EMA) scaled score per section from standalone set attempts
  const sectionByNumberForEma = new Map(
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
        firstSectionNum != null
          ? sectionByNumberForEma.get(firstSectionNum)
          : undefined
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
        firstSectionNum != null
          ? sectionByNumberForEma.get(firstSectionNum)
          : undefined
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

  // Fetch total public question counts per section and category
  // View added in migration 20260316190000; types generated after migration applied
  type PublicCountRow = {
    section_id: string
    question_stem_category_id: string | null
    total_questions: number
  }
  const sectionIdsForCounts = sectionProgress.map((s) => s.sectionId)
  const { data: publicCountsRaw } =
    sectionIdsForCounts.length > 0
      ? await (
          supabase as unknown as {
            from: (r: string) => {
              select: (c: string) => {
                in: (
                  col: string,
                  vals: string[]
                ) => Promise<{ data: PublicCountRow[] | null }>
              }
            }
          }
        )
          .from('vstudent_ucat_public_question_counts')
          .select('section_id, question_stem_category_id, total_questions')
          .in('section_id', sectionIdsForCounts)
      : { data: [] as PublicCountRow[] | null }
  const publicCounts = publicCountsRaw ?? []
  const sectionTotalPublic = new Map<string, number>()
  const categoryTotalPublic = new Map<string, number>()
  for (const row of publicCounts) {
    const sectionId = row.section_id
    if (!sectionId) continue
    const catId = row.question_stem_category_id ?? '__uncategorized__'
    const total = row.total_questions ?? 0
    sectionTotalPublic.set(
      sectionId,
      (sectionTotalPublic.get(sectionId) ?? 0) + total
    )
    categoryTotalPublic.set(`${sectionId}:${catId}`, total)
  }
  sectionProgress = sectionProgress.map((s) => ({
    ...s,
    totalPublicQuestions: sectionTotalPublic.get(s.sectionId),
  }))

  // Compute per-section, per-category stats (all-time and weighted %)
  const sectionCategorySums = new Map<string, { correct: number; max: number }>()
  const qaBySectionCategoryDate = new Map<
    string,
    { correct: number; max: number }
  >()
  type QaWithCategory = (typeof questionAttemptsAll)[number] & {
    question_stem_category_id?: string | null
    category_name?: string | null
  }
  for (const qa of (questionAttemptsAll ?? []) as QaWithCategory[]) {
    const sectionId = qa.ucat_section_id
    if (!sectionId) continue
    const categoryId = qa.question_stem_category_id ?? '__uncategorized__'
    const dateStr = qa.attempted_at
      ? new Date(qa.attempted_at).toISOString().slice(0, 10)
      : ''
    if (!dateStr) continue
    const maxPerQuestion = qa.question_type === 'syllogism' ? 2 : 1
    const sumKey = `${sectionId}:${categoryId}`
    const dateKey = `${sectionId}:${categoryId}:${dateStr}`
    const existingSum = sectionCategorySums.get(sumKey)
    if (existingSum) {
      existingSum.correct += qa.score ?? 0
      existingSum.max += maxPerQuestion
    } else {
      sectionCategorySums.set(sumKey, {
        correct: qa.score ?? 0,
        max: maxPerQuestion,
      })
    }
    const existingDate = qaBySectionCategoryDate.get(dateKey)
    if (existingDate) {
      existingDate.correct += qa.score ?? 0
      existingDate.max += maxPerQuestion
    } else {
      qaBySectionCategoryDate.set(dateKey, {
        correct: qa.score ?? 0,
        max: maxPerQuestion,
      })
    }
  }
  const sectionCategoryDailyPctArrays = new Map<string, number[]>()
  for (const [dateKey, { correct, max }] of qaBySectionCategoryDate) {
    if (max > 0) {
      const pct = (correct / max) * 100
      const parts = dateKey.split(':')
      const arrayKey = `${parts[0]}:${parts[1]}`
      const arr = sectionCategoryDailyPctArrays.get(arrayKey) ?? []
      arr.push(pct)
      sectionCategoryDailyPctArrays.set(arrayKey, arr)
    }
  }
  for (const [, arr] of sectionCategoryDailyPctArrays) {
    arr.sort()
  }
  const { data: categoriesData } = await supabase
    .from('vstudent_ucat_question_stem_categories')
    .select('id, name, ucat_section_id')
    .in('ucat_section_id', sectionProgress.map((s) => s.sectionId))

  const categoriesBySection = new Map<string, { id: string; name: string }[]>()
  for (const c of categoriesData ?? []) {
    const sid = c.ucat_section_id
    const catId = c.id
    if (!sid || !catId) continue
    const list = categoriesBySection.get(sid) ?? []
    list.push({ id: catId, name: c.name ?? 'Unknown' })
    categoriesBySection.set(sid, list)
  }

  const sectionCategoryProgress: Record<string, SectionCategoryProgress[]> = {}
  for (const s of sectionProgress) {
    const cats = categoriesBySection.get(s.sectionId) ?? []
    const result: SectionCategoryProgress[] = []
    for (const cat of cats) {
      const sumKey = `${s.sectionId}:${cat.id}`
      const { correct, max } = sectionCategorySums.get(sumKey) ?? {
        correct: 0,
        max: 0,
      }
      const dailyPcts = sectionCategoryDailyPctArrays.get(sumKey) ?? []
      result.push({
        categoryId: cat.id,
        categoryName: cat.name,
        correctScore: correct,
        maxScore: max,
        percentage: max > 0 ? Math.round((correct / max) * 100) : 0,
        weightedAveragePercentage: computeEma(dailyPcts),
        totalPublicQuestions: categoryTotalPublic.get(sumKey),
      })
    }
    const uncatSum = sectionCategorySums.get(`${s.sectionId}:__uncategorized__`)
    if (uncatSum && uncatSum.max > 0) {
      const dailyPcts =
        sectionCategoryDailyPctArrays.get(
          `${s.sectionId}:__uncategorized__`
        ) ?? []
      result.push({
        categoryId: '__uncategorized__',
        categoryName: 'Uncategorized',
        correctScore: uncatSum.correct,
        maxScore: uncatSum.max,
        percentage: Math.round((uncatSum.correct / uncatSum.max) * 100),
        weightedAveragePercentage: computeEma(dailyPcts),
        totalPublicQuestions: categoryTotalPublic.get(
          `${s.sectionId}:__uncategorized__`
        ),
      })
    }
    sectionCategoryProgress[s.sectionId] = result.sort((a, b) =>
      a.categoryName.localeCompare(b.categoryName)
    )
  }

  // Fetch mock attempts (submitted = completed_at not null)
  // Note: vstudent_ucat_my_mock_attempts view types may be outdated; score columns from table
  const { data: mockAttemptsRaw, error: mockError } = await supabase
    .from('vstudent_ucat_my_mock_attempts')
    .select('id, attempted_at, completed_at, ucat_mock_id')
    .not('completed_at', 'is', null)

  if (mockError) {
    return NextResponse.json({ error: mockError.message }, { status: 500 })
  }

  // Fetch mock names for display
  const mockIds = [
    ...new Set(
      (mockAttemptsRaw ?? [])
        .map((r) => (r as { ucat_mock_id?: string | null }).ucat_mock_id)
        .filter(Boolean)
    ),
  ] as string[]
  const { data: mockDetails } =
    mockIds.length > 0
      ? await supabase
          .from('vstudent_ucat_mocks')
          .select('id, name')
          .in('id', mockIds)
      : { data: [] }
  const mockNameById = new Map(
    (mockDetails ?? []).map((m) => [
      m.id,
      m.name != null ? extractTextFromRichJson(m.name as JsonLike) || null : null,
    ])
  )

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
      mockName: row.ucat_mock_id
        ? mockNameById.get(row.ucat_mock_id) ?? null
        : null,
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
    question_stem_category_id: string | null
    category_name: string | null
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
    sectionNumber: r.section_number ?? null,
    questionStemCategoryId: r.question_stem_category_id,
    categoryName: r.category_name,
  }))

  return NextResponse.json({
    sectionProgress,
    setAttempts,
    mockAttempts,
    questionAttempts,
    sectionCategoryProgress,
  } satisfies ProgressResponse)
}
