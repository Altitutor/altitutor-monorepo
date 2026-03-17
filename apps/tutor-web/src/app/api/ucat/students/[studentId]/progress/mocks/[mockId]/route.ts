import { NextRequest, NextResponse } from 'next/server'
import type { Database } from '@altitutor/shared'
import { requireUcatTutor } from '@/features/ucat/shared/server/guard'
import { extractTextFromRichJson } from '@/features/ucat/shared/lib/rich-text'
import type { JsonLike } from '@/features/ucat/shared/lib/rich-text'

type MockAttemptRow = Database['public']['Views']['vtutor_ucat_student_mock_attempts']['Row']
type MockDetailRow = Database['public']['Views']['vtutor_ucat_mock_detail']['Row']
type QuestionSetRow = Database['public']['Views']['vtutor_ucat_question_sets']['Row']
type SetAttemptRow = Database['public']['Views']['vtutor_ucat_student_set_attempts']['Row']
type QuestionAttemptRow = Database['public']['Views']['vtutor_ucat_student_question_attempts_for_progress']['Row']
type QuestionSetDetailRow = Database['public']['Views']['vtutor_ucat_question_set_detail']['Row']

export type MockSetInfo = {
  setAttemptId: string
  questionSetId: string
  questionSetName: string | null
  scorePoints: number | null
  totalPoints: number | null
  scaledScore: number | null
}

export type MockAttemptDetailResponse = {
  id: string
  ucatMockId: string
  mockName: string | null
  scaledScore: number | null
  scaledScoreMax: number | null
  attemptedAt: string
  completedAt: string | null
  sets: MockSetInfo[]
  questionAttempts: {
    questionNumber: number
    questionId: string
    setIndex: number
    score: number | null
    timeSpentSeconds: number | null
    questionType: 'multiple_choice' | 'syllogism' | null
    result: 'correct' | 'partial' | 'incorrect' | 'not_attempted'
  }[]
  setBoundaryIndices: number[]
}

type StemWithQuestions = {
  stem_id: string
  stem_text?: string
  questions_meta?: Array<{ id: string; index: number }>
}

type MockSetFromDetail = {
  id: string
  name?: JsonLike
  description?: unknown
  time_limit_seconds?: number | null
}

function getOrderedQuestionIds(stems: StemWithQuestions[]): string[] {
  const ids: string[] = []
  for (const stem of stems) {
    const questions = stem.questions_meta ?? []
    for (const q of questions.sort((a, b) => a.index - b.index)) {
      ids.push(q.id)
    }
  }
  return ids
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ studentId: string; mockId: string }> }
) {
  const access = await requireUcatTutor()
  if (!access.ok) return access.response

  const { studentId, mockId } = await params
  if (!studentId || !mockId) {
    return NextResponse.json({ error: 'Missing studentId or mockId' }, { status: 400 })
  }

  const supabase = access.userClient

  const { data: mockAttempt, error: mockError } = await supabase
    .from('vtutor_ucat_student_mock_attempts')
    .select('id, ucat_mock_id, attempted_at, completed_at')
    .eq('id', mockId)
    .eq('student_id', studentId)
    .maybeSingle()

  if (mockError) {
    return NextResponse.json({ error: mockError.message }, { status: 500 })
  }

  const mockAttemptTyped = mockAttempt as MockAttemptRow | null
  if (!mockAttemptTyped) {
    return NextResponse.json({ error: 'Mock attempt not found' }, { status: 404 })
  }

  const ucatMockId = mockAttemptTyped.ucat_mock_id
  if (!ucatMockId) {
    return NextResponse.json(
      { error: 'Mock attempt has no mock' },
      { status: 400 }
    )
  }

  const { data: mockDetail, error: mockDetailError } = await supabase
    .from('vtutor_ucat_mock_detail')
    .select('id, name, sets')
    .eq('id', ucatMockId)
    .maybeSingle()

  if (mockDetailError) {
    return NextResponse.json({ error: mockDetailError.message }, { status: 500 })
  }

  const mockDetailTyped = mockDetail as MockDetailRow | null
  const mockSets = (mockDetailTyped?.sets ?? []) as MockSetFromDetail[]
  const mockSetIds = mockSets.map((s) => s.id)

  const { data: setDetailsForSections } =
    mockSetIds.length > 0
      ? await supabase
          .from('vtutor_ucat_question_sets')
          .select('id, sections')
          .in('id', mockSetIds)
      : { data: [] }

  const sectionNumberBySetId = new Map<string, number>()
  const setDetailsTyped = (setDetailsForSections ?? []) as QuestionSetRow[]
  for (const s of setDetailsTyped) {
    const sections = s.sections as Array<{ section_number?: number }> | null
    const firstNum =
      Array.isArray(sections) && sections.length > 0
        ? sections[0]?.section_number
        : undefined
    if (firstNum != null && s.id) sectionNumberBySetId.set(s.id, firstNum)
  }

  const SITUATIONAL_JUDGEMENT_SECTION = 4

  const { data: setAttemptsRaw, error: setAttemptsError } = await supabase
    .from('vtutor_ucat_student_set_attempts')
    .select('attempt_id, set_id, score_points, total_points, scaled_score')
    .eq('student_id', studentId)
    .eq('student_ucat_mock_attempt_id', mockId)

  if (setAttemptsError) {
    return NextResponse.json({ error: setAttemptsError.message }, { status: 500 })
  }

  const setAttemptsTyped = (setAttemptsRaw ?? []) as SetAttemptRow[]
  const setAttemptsBySetId = new Map(
    setAttemptsTyped.map((a) => [a.set_id, a])
  )

  const attemptIds = setAttemptsTyped.map((a) => a.attempt_id).filter(Boolean)
  const { data: allQuestionAttempts, error: qaError } = await supabase
    .from('vtutor_ucat_student_question_attempts_for_progress')
    .select(
      'question_id, score, time_spent_seconds, question_type, student_question_set_attempt_id'
    )
    .in('student_question_set_attempt_id', attemptIds)
    .eq('student_id', studentId)
    .eq('is_submitted', true)

  if (qaError) {
    return NextResponse.json({ error: qaError.message }, { status: 500 })
  }

  const questionAttemptsTyped = (allQuestionAttempts ?? []) as QuestionAttemptRow[]
  const attemptsBySetAndQuestion = new Map<
    string,
    { score: number | null; timeSpentSeconds: number | null; questionType: 'multiple_choice' | 'syllogism' | null }
  >()
  for (const qa of questionAttemptsTyped) {
    const setId = qa.student_question_set_attempt_id
    if (!setId) continue
    const key = `${setId}:${qa.question_id}`
    attemptsBySetAndQuestion.set(key, {
      score: qa.score,
      timeSpentSeconds: qa.time_spent_seconds,
      questionType: qa.question_type as 'multiple_choice' | 'syllogism' | null,
    })
  }

  const sets: MockSetInfo[] = []
  const questionAttempts: MockAttemptDetailResponse['questionAttempts'] = []
  const setBoundaryIndices: number[] = []
  let globalQuestionNumber = 0

  for (let setIndex = 0; setIndex < mockSetIds.length; setIndex++) {
    const questionSetId = mockSetIds[setIndex]
    const setAttempt = setAttemptsBySetId.get(questionSetId)
    const mockSet = mockSets[setIndex]

    const setAttemptId = setAttempt?.attempt_id ?? ''
    const questionSetName =
      mockSet?.name != null
        ? extractTextFromRichJson(mockSet.name as JsonLike) || null
        : null

    sets.push({
      setAttemptId,
      questionSetId,
      questionSetName,
      scorePoints: setAttempt?.score_points ?? null,
      totalPoints: setAttempt?.total_points ?? null,
      scaledScore: setAttempt?.scaled_score ?? null,
    })

    const { data: setDetail } = await supabase
      .from('vtutor_ucat_question_set_detail')
      .select('id, stems')
      .eq('id', questionSetId)
      .maybeSingle()

    const setDetailTyped = setDetail as QuestionSetDetailRow | null
    const stems = (setDetailTyped?.stems ?? []) as StemWithQuestions[]
    const orderedQuestionIds = getOrderedQuestionIds(stems)

    for (let i = 0; i < orderedQuestionIds.length; i++) {
      globalQuestionNumber++
      const questionId = orderedQuestionIds[i]
      const attemptData = setAttempt
        ? attemptsBySetAndQuestion.get(`${setAttempt.attempt_id}:${questionId}`)
        : undefined

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

      questionAttempts.push({
        questionNumber: globalQuestionNumber,
        questionId,
        setIndex,
        score,
        timeSpentSeconds,
        questionType,
        result,
      })
    }

    if (setIndex < mockSetIds.length - 1 && orderedQuestionIds.length > 0) {
      setBoundaryIndices.push(globalQuestionNumber - 1)
    }
  }

  const mockName =
    mockDetailTyped?.name != null
      ? extractTextFromRichJson(mockDetailTyped.name as JsonLike) || null
      : null

  const scoredSetCount = sets.filter((s) => {
    const sectionNum = s.questionSetId
      ? sectionNumberBySetId.get(s.questionSetId)
      : undefined
    return sectionNum !== SITUATIONAL_JUDGEMENT_SECTION
  }).length

  const scaledScore =
    sets.length > 0
      ? sets.reduce((sum, s) => {
          const sectionNum = s.questionSetId
            ? sectionNumberBySetId.get(s.questionSetId)
            : undefined
          if (sectionNum === SITUATIONAL_JUDGEMENT_SECTION) return sum
          return sum + (s.scaledScore ?? 0)
        }, 0)
      : null

  const scaledScoreMax = scoredSetCount > 0 ? scoredSetCount * 900 : null

  const response: MockAttemptDetailResponse = {
    id: mockAttemptTyped.id ?? '',
    ucatMockId,
    mockName,
    scaledScore,
    scaledScoreMax,
    attemptedAt: mockAttemptTyped.attempted_at ?? '',
    completedAt: mockAttemptTyped.completed_at,
    sets,
    questionAttempts,
    setBoundaryIndices,
  }

  return NextResponse.json(response)
}
