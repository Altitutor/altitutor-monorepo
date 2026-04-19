import { NextRequest, NextResponse } from 'next/server'
import type { Database } from '@altitutor/shared'
import { requireUcatTutor } from '@/features/ucat/shared/server/guard'
import { extractTextFromRichJson } from '@/features/ucat/shared/lib/rich-text'
import type { JsonLike } from '@/features/ucat/shared/lib/rich-text'
import type {
  ProgressResponse,
  SectionProgress,
  SetAttemptRow,
  MockAttemptRow,
  QuestionAttemptRow,
  SectionCategoryProgress,
} from '@altitutor/shared'

type SectionRow = Database['public']['Views']['vtutor_ucat_sections']['Row']
type QuestionSetRow = Database['public']['Views']['vtutor_ucat_question_sets']['Row']
type CategoryRow = Database['public']['Views']['vtutor_ucat_question_stem_categories']['Row']
type MockRow = Database['public']['Views']['vtutor_ucat_mocks']['Row']

const EMA_ALPHA = 0.5
const SCALED_MAX_PER_SECTION = 900

function computeEma(scores: number[]): number | null {
  if (scores.length === 0) return null
  let ema = scores[0]
  for (let i = 1; i < scores.length; i++) {
    ema = EMA_ALPHA * scores[i] + (1 - EMA_ALPHA) * ema
  }
  return ema
}

type PublicCountRow = {
  section_id: string
  question_stem_category_id: string | null
  total_questions: number
}

type SetAttemptRaw = {
  attempt_id: string | null
  attempted_at: string | null
  completed_at: string | null
  set_id: string | null
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

type QuestionAttemptRaw = {
  id: string | null
  question_id: string | null
  student_question_set_attempt_id: string | null
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

type MockAttemptRaw = {
  id: string | null
  attempted_at: string | null
  completed_at: string | null
  ucat_mock_id: string | null
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ studentId: string }> }
) {
  const access = await requireUcatTutor()
  if (!access.ok) return access.response

  const { studentId } = await params
  if (!studentId) {
    return NextResponse.json({ error: 'Missing studentId' }, { status: 400 })
  }

  const supabase = access.userClient

  // Verify student exists and tutor can view
  const { data: summaryRow } = await supabase
    .from('vtutor_ucat_student_progress_summary')
    .select('student_id')
    .eq('student_id', studentId)
    .maybeSingle()

  if (!summaryRow) {
    return NextResponse.json({ error: 'Student not found' }, { status: 404 })
  }

  // Fetch question attempts (submitted only)
  const { data: questionAttemptsAll, error: qaError } = await supabase
    .from('vtutor_ucat_student_question_attempts_for_progress')
    .select(
      'id, question_id, student_question_set_attempt_id, attempted_at, ucat_section_id, section_name, section_number, score, question_type, time_spent_seconds, student_question_speed, was_timed, question_stem_category_id, category_name'
    )
    .eq('student_id', studentId)
    .eq('is_submitted', true)

  if (qaError) {
    return NextResponse.json({ error: qaError.message }, { status: 500 })
  }

  // Dedupe by question_id: keep best attempt per question
  const bestByQuestion = new Map<string, QuestionAttemptRaw & { question_id?: string | null }>()
  for (const qa of (questionAttemptsAll ?? []) as (QuestionAttemptRaw & { question_id?: string | null })[]) {
    const qid = qa.question_id ?? qa.id
    if (!qid) continue
    const existing = bestByQuestion.get(qid)
    const score = qa.score ?? 0
    const existingScore = existing?.score ?? 0
    if (
      !existing ||
      score > existingScore ||
      (score === existingScore &&
        ((qa.attempted_at ?? '') > (existing.attempted_at ?? '')))
    ) {
      bestByQuestion.set(qid, qa)
    }
  }
  const uniqueQuestionAttempts = [...bestByQuestion.values()]

  // Compute section progress
  const sectionMap = new Map<
    string,
    { name: string; number: number; correct: number; max: number }
  >()
  for (const qa of uniqueQuestionAttempts) {
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

  // Ensure all 4 sections are present (from vtutor_ucat_sections)
  const { data: sections } = await supabase
    .from('vtutor_ucat_sections')
    .select('id, name, section_number')
    .order('section_number')

  const sectionIds = new Set(sectionProgress.map((s) => s.sectionId))
  const sectionsTyped = (sections ?? []) as SectionRow[]
  for (const sec of sectionsTyped) {
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

  // Fetch set attempts (completed = completed_at not null)
  const { data: setAttemptsRaw, error: setError } = await supabase
    .from('vtutor_ucat_student_set_attempts')
    .select('*')
    .eq('student_id', studentId)
    .not('completed_at', 'is', null)

  if (setError) {
    return NextResponse.json({ error: setError.message }, { status: 500 })
  }

  // Enrich with time_limit and name from vtutor_ucat_question_sets
  const setIds = [
    ...new Set(
      (setAttemptsRaw ?? [])
        .map((r) => (r as SetAttemptRaw).set_id)
        .filter(Boolean)
    ),
  ] as string[]
  const { data: setDetails } =
    setIds.length > 0
      ? await supabase
          .from('vtutor_ucat_question_sets')
          .select('id, name, time_limit_seconds, time_limit_at_exam_speed_seconds, sections, is_student_generated')
          .in('id', setIds)
      : { data: [] }

  const setDetailsTyped = (setDetails ?? []) as QuestionSetRow[]
  const timeLimitBySetId = new Map(
    setDetailsTyped.map((s) => [
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

    if (!setTimeLimit && row.set_id) {
      const details = timeLimitBySetId.get(row.set_id)
      setTimeLimit = details?.timeLimit ?? null
      timeLimitExam = details?.timeLimitExam ?? null
    } else if (row.set_id) {
      const details = timeLimitBySetId.get(row.set_id)
      timeLimitExam = details?.timeLimitExam ?? null
    }

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

    const details = row.set_id ? timeLimitBySetId.get(row.set_id) : undefined
    const questionSetName =
      details?.name != null
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
      id: row.attempt_id ?? '',
      attemptedAt: row.attempted_at ?? '',
      completedAt: row.completed_at,
      questionSetId: row.set_id ?? '',
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

  // Compute average and weighted average (EMA) scaled score per section
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

  // Compute weighted average percentage from question attempts
  const sectionDailyPercentages = new Map<string, number[]>()
  for (const s of sectionProgress) {
    sectionDailyPercentages.set(s.sectionId, [])
  }
  const qaBySectionDate = new Map<string, { correct: number; max: number }>()
  for (const qa of uniqueQuestionAttempts) {
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

  // Fetch total public question counts per section and category (tutors can use vstudent view - granted to authenticated)
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

  // Compute per-section, per-category stats
  const sectionCategorySums = new Map<string, { correct: number; max: number }>()
  const qaBySectionCategoryDate = new Map<
    string,
    { correct: number; max: number }
  >()
  for (const qa of uniqueQuestionAttempts) {
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
    .from('vtutor_ucat_question_stem_categories')
    .select('id, name, ucat_section_id')
    .in('ucat_section_id', sectionProgress.map((s) => s.sectionId))

  const categoriesBySection = new Map<string, { id: string; name: string }[]>()
  const categoriesTyped = (categoriesData ?? []) as CategoryRow[]
  for (const c of categoriesTyped) {
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

  // Fetch mock attempts (completed = completed_at not null)
  const { data: mockAttemptsRaw, error: mockError } = await supabase
    .from('vtutor_ucat_student_mock_attempts')
    .select('id, attempted_at, completed_at, ucat_mock_id')
    .eq('student_id', studentId)
    .not('completed_at', 'is', null)

  if (mockError) {
    return NextResponse.json({ error: mockError.message }, { status: 500 })
  }

  const mockIds = [
    ...new Set(
      (mockAttemptsRaw ?? [])
        .map((r) => (r as MockAttemptRaw).ucat_mock_id)
        .filter(Boolean)
    ),
  ] as string[]
  const { data: mockDetails } =
    mockIds.length > 0
      ? await supabase
          .from('vtutor_ucat_mocks')
          .select('id, name')
          .in('id', mockIds)
      : { data: [] }
  const mockDetailsTyped = (mockDetails ?? []) as MockRow[]
  const mockNameById = new Map(
    mockDetailsTyped.map((m) => [
      m.id,
      m.name != null ? extractTextFromRichJson(m.name as JsonLike) || null : null,
    ])
  )

  const section4Id =
    sectionProgress.find((s) => s.sectionNumber === 4)?.sectionId ?? null

  const mockAttempts: MockAttemptRow[] = []
  for (const m of mockAttemptsRaw ?? []) {
    const row = m as MockAttemptRaw
    const childSets = setAttempts.filter(
      (s) => s.studentUcatMockAttemptId === row.id
    )
    const scoredChildSets = childSets.filter(
      (s) => s.sectionId != null && s.sectionId !== section4Id
    )
    const timeTakenSeconds = childSets.reduce(
      (sum, s) => sum + (s.timeTakenSeconds ?? 0),
      0
    )
    const setTimeLimitSeconds = childSets.reduce(
      (sum, s) => sum + (s.setTimeLimitSeconds ?? 0),
      0
    )
    const scorePoints = scoredChildSets.reduce(
      (sum, s) => sum + (s.scorePoints ?? 0),
      0
    )
    const totalPoints = scoredChildSets.reduce(
      (sum, s) => sum + (s.totalPoints ?? 0),
      0
    )
    const scaledScore = scoredChildSets.reduce(
      (sum, s) => sum + (s.scaledScore ?? 0),
      0
    )
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

    const scaledScoreMax =
      scoredChildSets.length > 0
        ? scoredChildSets.length * SCALED_MAX_PER_SECTION
        : null

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
      scaledScoreMax,
      timeTakenSeconds: setTimeLimitSeconds > 0 ? timeTakenSeconds : null,
      setTimeLimitSeconds: setTimeLimitSeconds > 0 ? setTimeLimitSeconds : null,
      studentSetSpeed,
      studentExamSpeed,
      wasTimed,
    })
  }

  const questionAttempts: QuestionAttemptRow[] = (
    questionAttemptsAll ?? []
  ).map((r: QuestionAttemptRaw) => ({
    id: r.id ?? '',
    questionId: r.question_id ?? r.id ?? '',
    studentQuestionSetAttemptId: r.student_question_set_attempt_id ?? null,
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

  // Fetch total public mocks count
  const { count: totalPublicMocks } = await supabase
    .from('vtutor_ucat_mocks')
    .select('*', { count: 'exact', head: true })

  // Fetch total public non-student-generated sets per section
  const { data: publicSetsRaw } = await supabase
    .from('vtutor_ucat_question_sets')
    .select('id, sections, is_student_generated, time_limit_seconds')
    .eq('is_student_generated', false)

  const totalPublicSetsBySection: Record<string, number> = {}
  const totalPublicUntimedSetsBySection: Record<string, number> = {}
  const totalPublicTimedSetsBySection: Record<string, number> = {}
  for (const s of sectionProgress) {
    totalPublicSetsBySection[s.sectionId] = 0
    totalPublicUntimedSetsBySection[s.sectionId] = 0
    totalPublicTimedSetsBySection[s.sectionId] = 0
  }
  const sectionByNumberForSets = new Map(
    sectionProgress.map((s) => [s.sectionNumber, s.sectionId])
  )
  const publicSetsTyped = (publicSetsRaw ?? []) as QuestionSetRow[]
  for (const row of publicSetsTyped) {
    if (row.is_student_generated) continue
    const sectionsArr = row.sections as Array<{ section_number?: number }> | null
    const firstSectionNum =
      Array.isArray(sectionsArr) && sectionsArr.length > 0
        ? sectionsArr[0]?.section_number
        : undefined
    const sectionId =
      firstSectionNum != null
        ? sectionByNumberForSets.get(firstSectionNum)
        : undefined
    if (sectionId) {
      totalPublicSetsBySection[sectionId] =
        (totalPublicSetsBySection[sectionId] ?? 0) + 1
      const isTimed =
        row.time_limit_seconds != null && row.time_limit_seconds > 0
      if (isTimed) {
        totalPublicTimedSetsBySection[sectionId] =
          (totalPublicTimedSetsBySection[sectionId] ?? 0) + 1
      } else {
        totalPublicUntimedSetsBySection[sectionId] =
          (totalPublicUntimedSetsBySection[sectionId] ?? 0) + 1
      }
    }
  }

  const response: ProgressResponse = {
    sectionProgress,
    setAttempts,
    mockAttempts,
    practiceAttempts: [],
    questionAttempts,
    sectionCategoryProgress,
    totalPublicMocks: totalPublicMocks ?? 0,
    totalPublicSetsBySection,
    totalPublicUntimedSetsBySection,
    totalPublicTimedSetsBySection,
  }

  return NextResponse.json(response)
}
