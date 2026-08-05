import {
  AI_ASSESSMENT_PROMPT_VERSION,
  UcatAssessmentResponseSchema,
  type UcatAssessmentFingerprints,
  type UcatAssessmentRating,
} from '@/features/ucat/questions/lib/ai-assessment/schema'
import {
  isStaleUcatAiReviewRun,
  type UcatAiReviewStatus,
} from '@/features/ucat/questions/lib/ai-assessment/review-status'

export type UcatAiReviewSummaryRun = {
  id: string
  cycle_id: string
  scope_type: 'full' | 'questions'
  target_question_ids: string[]
  shared_fingerprint: string
  question_fingerprints: Record<string, string>
  status: string
  prompt_version: number
  assessment_result: unknown
  requested_at: string
  started_at?: string | null
}

function ratingPriority(rating: UcatAssessmentRating): number {
  switch (rating) {
    case 'critical': return 5
    case 'concern': return 4
    case 'unreviewable': return 3
    case 'pass': return 2
    case 'not_applicable': return 1
  }
}

function effectiveStatus(
  runs: UcatAiReviewSummaryRun[],
  ratings: UcatAssessmentRating[],
  now: Date,
): UcatAiReviewStatus {
  if (runs.length === 0) return 'not_requested'
  const worstRating = ratings.reduce<UcatAssessmentRating | null>(
    (worst, rating) => !worst || ratingPriority(rating) > ratingPriority(worst) ? rating : worst,
    null,
  )
  if (worstRating === 'critical') return 'critical'
  if (runs.some((run) => run.status === 'queued' || (run.status === 'running' && !isStaleUcatAiReviewRun(run, now)))) return 'reviewing'
  if (runs.some((run) => isStaleUcatAiReviewRun(run, now))) return 'unavailable'
  if (worstRating === 'concern') return 'concerns'
  if (runs.some((run) => run.status === 'deferred')) return 'deferred'
  if (runs.some((run) => run.status === 'format_blocked')) return 'format_blocked'
  if (runs.some((run) => run.status === 'failed')) return 'unavailable'
  if (worstRating === 'unreviewable') return 'unreviewable'
  if (worstRating === 'pass' || worstRating === 'not_applicable') return 'passed'
  return 'not_requested'
}

export function summarizeCurrentUcatAiReview(params: {
  environmentEnabled: boolean
  currentCycleId: string | null
  runs: UcatAiReviewSummaryRun[]
  fingerprints: UcatAssessmentFingerprints
  questionIds: string[]
  now?: Date
}): { status: UcatAiReviewStatus; effectiveRunIds: string[] } {
  if (!params.environmentEnabled) return { status: 'disabled', effectiveRunIds: [] }
  if (!params.currentCycleId) return { status: 'not_requested', effectiveRunIds: [] }

  const cycleRuns = params.runs
    .filter((run) => (
      run.cycle_id === params.currentCycleId
      && run.prompt_version === AI_ASSESSMENT_PROMPT_VERSION
    ))
    .sort((left, right) => right.requested_at.localeCompare(left.requested_at))
  const effectiveRunIds = new Set<string>()
  const ratings: UcatAssessmentRating[] = []
  const addRatings = (
    run: UcatAiReviewSummaryRun,
    scopeType: 'shared' | 'question',
    questionId: string | null,
  ) => {
    const assessment = UcatAssessmentResponseSchema.safeParse(run.assessment_result)
    if (!assessment.success) return
    ratings.push(...assessment.data.categories
      .filter((category) => category.scopeType === scopeType && (category.questionId ?? null) === questionId)
      .map((category) => category.rating))
  }
  const sharedRun = cycleRuns.find((run) => (
    run.scope_type === 'full' && run.shared_fingerprint === params.fingerprints.shared
  ))
  if (sharedRun) {
    effectiveRunIds.add(sharedRun.id)
    addRatings(sharedRun, 'shared', null)
  }
  for (const questionId of params.questionIds) {
    const questionRun = cycleRuns.find((run) => (
      run.target_question_ids.includes(questionId)
      && run.question_fingerprints?.[questionId] === params.fingerprints.questions[questionId]
    ))
    if (questionRun) {
      effectiveRunIds.add(questionRun.id)
      addRatings(questionRun, 'question', questionId)
    }
  }
  const effectiveRuns = cycleRuns.filter((run) => effectiveRunIds.has(run.id))
  return {
    status: effectiveStatus(effectiveRuns, ratings, params.now ?? new Date()),
    effectiveRunIds: [...effectiveRunIds],
  }
}
