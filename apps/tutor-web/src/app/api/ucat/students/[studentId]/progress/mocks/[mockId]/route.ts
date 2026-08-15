import { NextRequest, NextResponse } from 'next/server'
import { captureApiError } from '@/lib/sentry/capture-api-error'
import { requireUcatTutor } from '@/features/ucat/shared/server/guard'
import { supabaseAdmin } from '@/shared/lib/supabase/server/admin'
import {
  extractTextFromRichJson,
  type JsonLike,
} from '@/features/ucat/shared/lib/rich-text'
import {
  parseAttemptContentSnapshot,
  parsePlacementProjection,
  parseSelectedOptionId,
  resultForAttempt,
  snapshotToReviewQuestion,
  type AttemptReviewQuestion,
} from '@/features/ucat/students/progress/lib/attempt-content-snapshot'
import type { SetAttemptQuestion } from '../../sets/[attemptId]/route'

export type MockSetInfo = {
  setAttemptId: string
  questionSetId: string
  questionSetName: string | null
  scorePoints: number | null
  totalPoints: number | null
  scaledScore: number | null
}

export type MockAttemptQuestion = SetAttemptQuestion & { setIndex: number }

export type MockAttemptDetailResponse = {
  id: string
  ucatMockId: string
  mockName: string | null
  scaledScore: number | null
  scaledScoreMax: number | null
  timeTakenSeconds: number | null
  mockTimeLimitSeconds: number | null
  examTimeLimitSeconds: number | null
  studentMockSpeed: number | null
  studentExamSpeed: number | null
  attemptedAt: string
  completedAt: string | null
  sets: MockSetInfo[]
  questions: AttemptReviewQuestion[]
  questionAttempts: MockAttemptQuestion[]
  setBoundaryIndices: number[]
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ studentId: string; mockId: string }> }
) {
  const access = await requireUcatTutor()
  if (!access.ok) return access.response

  const { studentId, mockId } = await params
  if (!studentId || !mockId) {
    return NextResponse.json(
      { error: 'Missing studentId or mockId' },
      { status: 400 }
    )
  }

  const { data: authorizedAttempt, error: authorizationError } = await access.userClient
    .from('vtutor_ucat_student_mock_attempts')
    .select('id')
    .eq('id', mockId)
    .eq('student_id', studentId)
    .maybeSingle()

  if (authorizationError) {
    captureApiError(
      authorizationError,
      '/api/ucat/students/[studentId]/progress/mocks/[mockId]'
    )
    return NextResponse.json(
      { error: authorizationError.message },
      { status: 500 }
    )
  }
  if (!authorizedAttempt) {
    return NextResponse.json({ error: 'Mock attempt not found' }, { status: 404 })
  }
  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: 'Attempt review is not configured on this server' },
      { status: 500 }
    )
  }

  const { data: mockAttempt, error: mockError } = await supabaseAdmin
    .from('student_ucat_mock_attempts')
    .select(
      'id, ucat_mock_id, attempted_at, completed_at, scaled_score, time_taken, mock_time_limit_seconds, mock_time_limit_at_exam_speed_seconds, student_mock_speed, content_snapshot'
    )
    .eq('id', mockId)
    .eq('student_id', studentId)
    .maybeSingle()

  if (mockError) {
    captureApiError(
      mockError,
      '/api/ucat/students/[studentId]/progress/mocks/[mockId]'
    )
    return NextResponse.json({ error: mockError.message }, { status: 500 })
  }
  if (!mockAttempt) {
    return NextResponse.json({ error: 'Mock attempt not found' }, { status: 404 })
  }

  const { data: setRows, error: setError } = await supabaseAdmin
    .from('student_question_set_attempts')
    .select(
      'id, question_set_id, score_points, total_points, scaled_score, content_snapshot, attempted_at'
    )
    .eq('student_ucat_mock_attempt_id', mockId)
    .eq('student_id', studentId)

  if (setError) {
    captureApiError(
      setError,
      '/api/ucat/students/[studentId]/progress/mocks/[mockId]'
    )
    return NextResponse.json({ error: setError.message }, { status: 500 })
  }

  const setAttemptIds = (setRows ?? []).map((set) => set.id)
  const questionResult = setAttemptIds.length
    ? await supabaseAdmin
        .from('student_question_attempts')
        .select(
          'question_id, score, time_spent_seconds, answer_snapshot, is_flagged, attempted_at, content_snapshot, student_question_set_attempt_id'
        )
        .in('student_question_set_attempt_id', setAttemptIds)
        .eq('student_id', studentId)
        .eq('is_submitted', true)
    : { data: [], error: null }

  if (questionResult.error) {
    captureApiError(
      questionResult.error,
      '/api/ucat/students/[studentId]/progress/mocks/[mockId]'
    )
    return NextResponse.json(
      { error: questionResult.error.message },
      { status: 500 }
    )
  }

  const mockSnapshot = (mockAttempt.content_snapshot ?? {}) as {
    name?: unknown
    setIds?: string[]
  }
  const snapshotSetIds = Array.isArray(mockSnapshot.setIds)
    ? mockSnapshot.setIds
    : []
  const fallbackSetIds = [...(setRows ?? [])]
    .sort((a, b) => a.attempted_at.localeCompare(b.attempted_at))
    .map((set) => set.question_set_id)
  const setIds = snapshotSetIds.length > 0 ? snapshotSetIds : fallbackSetIds
  const setOrder = new Map(setIds.map((id, index) => [id, index]))
  const setById = new Map((setRows ?? []).map((set) => [set.question_set_id, set]))
  const setByAttemptId = new Map((setRows ?? []).map((set) => [set.id, set]))
  const stemOrderByAttemptId = new Map(
    (setRows ?? []).map((set) => {
      const snapshot = (set.content_snapshot ?? {}) as { stemIds?: string[] }
      return [
        set.id,
        new Map(
          (Array.isArray(snapshot.stemIds) ? snapshot.stemIds : []).map(
            (id, index) => [id, index]
          )
        ),
      ] as const
    })
  )

  const ordered = (questionResult.data ?? [])
    .map((row) => ({
      row,
      snapshot: parseAttemptContentSnapshot(row.content_snapshot),
      set: row.student_question_set_attempt_id
        ? setByAttemptId.get(row.student_question_set_attempt_id)
        : undefined,
    }))
    .filter(
      (entry): entry is typeof entry & {
        snapshot: NonNullable<typeof entry.snapshot>
        set: NonNullable<typeof entry.set>
      } =>
        entry.snapshot != null && entry.set != null
    )
    .sort((a, b) => {
      const aSetOrder = setOrder.get(a.set.question_set_id) ?? Number.MAX_SAFE_INTEGER
      const bSetOrder = setOrder.get(b.set.question_set_id) ?? Number.MAX_SAFE_INTEGER
      const aStemOrder =
        stemOrderByAttemptId.get(a.set.id)?.get(a.snapshot.stem.id) ??
        Number.MAX_SAFE_INTEGER
      const bStemOrder =
        stemOrderByAttemptId.get(b.set.id)?.get(b.snapshot.stem.id) ??
        Number.MAX_SAFE_INTEGER
      return (
        aSetOrder - bSetOrder ||
        aStemOrder - bStemOrder ||
        a.snapshot.question.index - b.snapshot.question.index ||
        a.row.attempted_at.localeCompare(b.row.attempted_at)
      )
    })

  const sets: MockSetInfo[] = setIds.map((questionSetId) => {
    const set = setById.get(questionSetId)
    const snapshot = (set?.content_snapshot ?? {}) as { name?: unknown }
    return {
      setAttemptId: set?.id ?? '',
      questionSetId,
      questionSetName: snapshot.name
        ? extractTextFromRichJson(snapshot.name as JsonLike) || null
        : null,
      scorePoints: set?.score_points ?? null,
      totalPoints: set?.total_points ?? null,
      scaledScore: set?.scaled_score ?? null,
    }
  })

  const questionAttempts: MockAttemptQuestion[] = []
  const questions: AttemptReviewQuestion[] = []
  const setBoundaryIndices: number[] = []
  let questionNumber = 0
  for (let setIndex = 0; setIndex < setIds.length; setIndex += 1) {
    const questionSetId = setIds[setIndex]
    const setEntries = ordered.filter(
      (entry) => entry.set.question_set_id === questionSetId
    )
    let currentStemId: string | null = null
    let stemIndex = 0
    for (const { row, snapshot } of setEntries) {
      questionNumber += 1
      if (snapshot.stem.id !== currentStemId) {
        currentStemId = snapshot.stem.id
        stemIndex += 1
      }
      const tags = (snapshot.question.tags ?? [])
        .filter((tag) => Boolean(tag.name))
        .map((tag) => ({
          name: tag.name ?? '',
          description: tag.description
            ? extractTextFromRichJson(tag.description as JsonLike) || null
            : null,
        }))
      questionAttempts.push({
        questionNumber,
        questionId: snapshot.question.id,
        setIndex,
        stemIndex,
        score: row.score,
        timeSpentSeconds: row.time_spent_seconds,
        averageTimeSeconds: null,
        averageTimeSampleSize: 0,
        timeBurdenSeconds: snapshot.question.timeBurdenSeconds ?? null,
        difficulty: snapshot.question.difficulty ?? null,
        questionTags: tags,
        isFlagged: row.is_flagged,
        answerScheme: snapshot.question.answerScheme,
        result: resultForAttempt(
          row.score,
          snapshot.question.answerScheme,
          true
        ),
        categoryName: snapshot.stem.categoryName ?? null,
        categoryDescription: snapshot.stem.categoryDescription
          ? extractTextFromRichJson(
              snapshot.stem.categoryDescription as JsonLike
            ) || null
          : null,
        questionStemCategoryId: snapshot.stem.categoryId ?? null,
        selectedOptionId: parseSelectedOptionId(row.answer_snapshot),
        answerSnapshot: parsePlacementProjection(row.answer_snapshot),
      })
      questions.push(
        snapshotToReviewQuestion(snapshot, questionNumber, questionSetId)
      )
    }
    if (setIndex < setIds.length - 1 && setEntries.length > 0) {
      setBoundaryIndices.push(questionNumber - 1)
    }
  }

  const sectionBySetId = new Map<string, number>()
  for (const entry of ordered) {
    if (entry.snapshot.stem.sectionNumber != null) {
      sectionBySetId.set(
        entry.set.question_set_id,
        entry.snapshot.stem.sectionNumber
      )
    }
  }
  const scoredSetCount = sets.filter(
    (set) => sectionBySetId.get(set.questionSetId) !== 4
  ).length
  const scaledScore =
    mockAttempt.scaled_score ??
    sets.reduce(
      (total, set) =>
        sectionBySetId.get(set.questionSetId) === 4
          ? total
          : total + (set.scaledScore ?? 0),
      0
    )
  const timeTakenSeconds = mockAttempt.time_taken
  const mockTimeLimitSeconds = mockAttempt.mock_time_limit_seconds
  const examTimeLimitSeconds =
    mockAttempt.mock_time_limit_at_exam_speed_seconds
  let studentMockSpeed = mockAttempt.student_mock_speed
  let studentExamSpeed: number | null = null
  if (timeTakenSeconds != null && timeTakenSeconds > 0) {
    studentMockSpeed ??=
      mockTimeLimitSeconds != null && mockTimeLimitSeconds > 0
        ? mockTimeLimitSeconds / timeTakenSeconds
        : null
    studentExamSpeed =
      examTimeLimitSeconds != null && examTimeLimitSeconds > 0
        ? examTimeLimitSeconds / timeTakenSeconds
        : null
  }

  const response: MockAttemptDetailResponse = {
    id: mockAttempt.id,
    ucatMockId: mockAttempt.ucat_mock_id,
    mockName: mockSnapshot.name
      ? extractTextFromRichJson(mockSnapshot.name as JsonLike) || null
      : null,
    scaledScore,
    scaledScoreMax: scoredSetCount > 0 ? scoredSetCount * 900 : null,
    timeTakenSeconds,
    mockTimeLimitSeconds,
    examTimeLimitSeconds,
    studentMockSpeed,
    studentExamSpeed,
    attemptedAt: mockAttempt.attempted_at,
    completedAt: mockAttempt.completed_at,
    sets,
    questions,
    questionAttempts,
    setBoundaryIndices,
  }

  return NextResponse.json(response)
}
