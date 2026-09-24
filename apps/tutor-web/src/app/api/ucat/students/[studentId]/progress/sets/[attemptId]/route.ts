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

export type SetAttemptQuestion = {
  questionNumber: number
  questionId: string
  stemIndex: number
  score: number | null
  timeSpentSeconds: number | null
  averageTimeSeconds: number | null
  averageTimeSampleSize: number
  timeBurdenSeconds: number | null
  difficulty: number | null
  questionTags: Array<{ name: string; description: string | null }>
  isFlagged: boolean
  answerScheme: AttemptReviewQuestion['answerScheme']
  result: 'correct' | 'partial' | 'incorrect' | 'not_attempted'
  categoryName: string | null
  categoryDescription: string | null
  questionStemCategoryId: string | null
  selectedOptionId: string | null
  answerSnapshot: Record<
    string,
    import('@altitutor/ucat-response-contract').PlacementValue
  > | null
}

export type SetAttemptDetailResponse = {
  id: string
  questionSetId: string
  questionSetName: string | null
  scorePoints: number | null
  totalPoints: number | null
  scaledScore: number | null
  timeTakenSeconds: number | null
  setTimeLimitSeconds: number | null
  examTimeLimitSeconds: number | null
  effectivePace: number | null
  studentSetSpeed: number | null
  studentExamSpeed: number | null
  attemptedAt: string
  completedAt: string | null
  questions: AttemptReviewQuestion[]
  questionAttempts: SetAttemptQuestion[]
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ studentId: string; attemptId: string }> },
) {
  const access = await requireUcatTutor()
  if (!access.ok) return access.response

  const { studentId, attemptId } = await params
  if (!studentId || !attemptId) {
    return NextResponse.json(
      { error: 'Missing studentId or attemptId' },
      { status: 400 },
    )
  }

  const { data: authorizedAttempt, error: authorizationError } =
    await access.userClient
      .from('vtutor_ucat_student_set_attempt_detail')
      .select('attempt_id')
      .eq('attempt_id', attemptId)
      .eq('student_id', studentId)
      .maybeSingle()

  if (authorizationError) {
    captureApiError(
      authorizationError,
      '/api/ucat/students/[studentId]/progress/sets/[attemptId]',
    )
    return NextResponse.json(
      { error: authorizationError.message },
      { status: 500 },
    )
  }
  if (!authorizedAttempt) {
    return NextResponse.json(
      { error: 'Set attempt not found' },
      { status: 404 },
    )
  }
  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: 'Attempt review is not configured on this server' },
      { status: 500 },
    )
  }

  const { data: attempt, error: attemptError } = await supabaseAdmin
    .from('student_question_set_attempts')
    .select(
      'id, attempted_at, completed_at, question_set_id, score_points, total_points, scaled_score, time_taken_seconds, set_time_limit_seconds, set_time_limit_at_exam_speed_seconds, effective_pace_multiplier, student_set_speed, student_exam_speed, content_snapshot',
    )
    .eq('id', attemptId)
    .eq('student_id', studentId)
    .maybeSingle()

  if (attemptError) {
    captureApiError(
      attemptError,
      '/api/ucat/students/[studentId]/progress/sets/[attemptId]',
    )
    return NextResponse.json({ error: attemptError.message }, { status: 500 })
  }
  if (!attempt) {
    return NextResponse.json(
      { error: 'Set attempt not found' },
      { status: 404 },
    )
  }

  const { data: rows, error: questionError } = await supabaseAdmin
    .from('student_question_attempts')
    .select(
      'question_id, score, time_spent_seconds, answer_snapshot, is_flagged, attempted_at, content_snapshot',
    )
    .eq('student_question_set_attempt_id', attemptId)
    .eq('student_id', studentId)
    .eq('is_submitted', true)

  if (questionError) {
    captureApiError(
      questionError,
      '/api/ucat/students/[studentId]/progress/sets/[attemptId]',
    )
    return NextResponse.json({ error: questionError.message }, { status: 500 })
  }

  const setSnapshot = (attempt.content_snapshot ?? {}) as {
    name?: unknown
    stemIds?: string[]
  }
  const stemIds = Array.isArray(setSnapshot.stemIds) ? setSnapshot.stemIds : []
  const stemOrder = new Map(stemIds.map((id, index) => [id, index]))
  const ordered = (rows ?? [])
    .map((row) => ({
      row,
      snapshot: parseAttemptContentSnapshot(row.content_snapshot),
    }))
    .filter(
      (
        entry,
      ): entry is typeof entry & {
        snapshot: NonNullable<typeof entry.snapshot>
      } => entry.snapshot != null,
    )
    .sort(
      (a, b) =>
        (stemOrder.get(a.snapshot.stem.id) ?? Number.MAX_SAFE_INTEGER) -
          (stemOrder.get(b.snapshot.stem.id) ?? Number.MAX_SAFE_INTEGER) ||
        a.snapshot.question.index - b.snapshot.question.index ||
        a.row.attempted_at.localeCompare(b.row.attempted_at),
    )

  let currentStemId: string | null = null
  let stemIndex = 0
  const questionAttempts: SetAttemptQuestion[] = ordered.map(
    ({ row, snapshot }, index) => {
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
      return {
        questionNumber: index + 1,
        questionId: snapshot.question.id,
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
          true,
        ),
        categoryName: snapshot.stem.categoryName ?? null,
        categoryDescription: snapshot.stem.categoryDescription
          ? extractTextFromRichJson(
              snapshot.stem.categoryDescription as JsonLike,
            ) || null
          : null,
        questionStemCategoryId: snapshot.stem.categoryId ?? null,
        selectedOptionId: parseSelectedOptionId(row.answer_snapshot),
        answerSnapshot: parsePlacementProjection(row.answer_snapshot),
      }
    },
  )

  const questionSetName = setSnapshot.name
    ? extractTextFromRichJson(setSnapshot.name as JsonLike) || null
    : null
  const timeTakenSeconds = attempt.time_taken_seconds
  const setTimeLimitSeconds = attempt.set_time_limit_seconds
  const examTimeLimitSeconds = attempt.set_time_limit_at_exam_speed_seconds
  let studentSetSpeed = attempt.student_set_speed
  let studentExamSpeed = attempt.student_exam_speed
  if (timeTakenSeconds != null && timeTakenSeconds > 0) {
    studentSetSpeed ??=
      setTimeLimitSeconds != null && setTimeLimitSeconds > 0
        ? setTimeLimitSeconds / timeTakenSeconds
        : null
    studentExamSpeed ??=
      examTimeLimitSeconds != null && examTimeLimitSeconds > 0
        ? examTimeLimitSeconds / timeTakenSeconds
        : null
  }

  const response: SetAttemptDetailResponse = {
    id: attempt.id,
    questionSetId: attempt.question_set_id,
    questionSetName,
    scorePoints: attempt.score_points,
    totalPoints: attempt.total_points,
    scaledScore: attempt.scaled_score,
    timeTakenSeconds,
    setTimeLimitSeconds,
    examTimeLimitSeconds,
    effectivePace: attempt.effective_pace_multiplier,
    studentSetSpeed,
    studentExamSpeed,
    attemptedAt: attempt.attempted_at,
    completedAt: attempt.completed_at,
    questions: ordered.map(({ snapshot }, index) =>
      snapshotToReviewQuestion(snapshot, index + 1, attempt.question_set_id),
    ),
    questionAttempts,
  }

  return NextResponse.json(response)
}
