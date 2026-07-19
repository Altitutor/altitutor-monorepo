import type { Database, Json } from '@altitutor/shared'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getServiceRoleClient } from '@/shared/lib/supabase/service-role'
import {
  callUcatAiJson,
  UcatAiBudgetExceededError,
} from '@/features/ucat/shared/server/ucat-ai-client'
import {
  BlindSolutionResponseSchema,
  UcatAssessmentResponseSchema,
  UcatFormatCheckSchema,
  type UcatAssessmentCategory,
  type BlindSolutionResponse,
  type UcatAssessmentPatch,
  type UcatAssessmentResponse,
  type UcatAssessmentSnapshot,
} from '@/features/ucat/questions/lib/ai-assessment/schema'
import { fingerprintUcatAssessmentSnapshot, loadUcatAssessmentSnapshot } from './content'
import {
  ASSESSMENT_SYSTEM_PROMPT,
  BLIND_SOLVER_SYSTEM_PROMPT,
  buildAssessmentUserPrompt,
  buildBlindSolverUserPrompt,
} from './prompts'
import { buildVisualEvidence } from './visual-evidence'

type SupabaseAny = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from: (table: string) => any
}

type RunRow = {
  id: string
  cycle_id: string
  stem_id: string
  status: string
  scope_type: 'full' | 'questions'
  target_question_ids: string[]
  content_fingerprint: string
  content_snapshot: UcatAssessmentSnapshot
  format_checks: unknown
  blind_solver_model_profile_id: string | null
  assessment_model_profile_id: string | null
  blind_solution: unknown
  requested_at: string
  attempt_count: number
  started_at: string | null
}

const QUESTION_CATEGORIES: UcatAssessmentCategory[] = [
  'answer_validity',
  'explanation_teaching_quality',
  'question_clarity_fairness',
  'difficulty_timing',
  'ucat_authenticity_task_quality',
  'content_appropriateness',
  'visual_integrity',
]

const SHARED_CATEGORIES: UcatAssessmentCategory[] = [
  'content_appropriateness',
  'visual_integrity',
  'ucat_authenticity_task_quality',
]

function asAny(client: SupabaseClient<Database>): SupabaseAny {
  return client as unknown as SupabaseAny
}

function withCompleteCategoryCoverage(params: {
  assessment: UcatAssessmentResponse
  targetQuestionIds: string[]
  includeShared: boolean
}): UcatAssessmentResponse {
  const categories = [...params.assessment.categories]
  const seen = new Set(categories.map((result) => `${result.scopeType}:${result.questionId ?? ''}:${result.category}`))
  const addMissing = (scopeType: 'shared' | 'question', questionId: string | null, category: UcatAssessmentCategory) => {
    const key = `${scopeType}:${questionId ?? ''}:${category}`
    if (seen.has(key)) return
    categories.push({
      scopeType,
      questionId,
      category,
      rating: 'unreviewable',
      confidence: 0,
      summary: 'The reviewer did not return an assessment for this category.',
      evidence: [],
    })
    seen.add(key)
  }
  if (params.includeShared) SHARED_CATEGORIES.forEach((category) => addMissing('shared', null, category))
  params.targetQuestionIds.forEach((questionId) => {
    QUESTION_CATEGORIES.forEach((category) => addMissing('question', questionId, category))
  })
  return { ...params.assessment, categories }
}

function assertBlindSolutionTargets(params: {
  solution: BlindSolutionResponse
  snapshot: UcatAssessmentSnapshot
  targetQuestionIds: string[]
}) {
  const targets = new Set(params.targetQuestionIds)
  const byQuestion = new Map(params.snapshot.questions.map((question) => [question.id, question]))
  if (params.solution.solutions.length !== targets.size) {
    throw new Error('Blind solver did not return exactly one solution for each target question')
  }
  const seen = new Set<string>()
  for (const solution of params.solution.solutions) {
    const question = byQuestion.get(solution.questionId)
    if (!question || !targets.has(solution.questionId) || seen.has(solution.questionId)) {
      throw new Error('Blind solver returned an unknown or duplicate question ID')
    }
    seen.add(solution.questionId)
    const optionIds = new Set(question.options.map((option) => option.id))
    if (solution.selectedOptionId && !optionIds.has(solution.selectedOptionId)) {
      throw new Error('Blind solver returned an option ID outside its question')
    }
    if (question.questionType === 'syllogism') {
      const returned = solution.syllogismAnswers.map((answer) => answer.optionId)
      if (returned.length !== optionIds.size || new Set(returned).size !== optionIds.size || returned.some((id) => !optionIds.has(id))) {
        throw new Error('Blind solver did not answer every syllogism statement exactly once')
      }
    }
  }
}

function patchTargetsCurrentScope(params: {
  patch: UcatAssessmentPatch
  snapshot: UcatAssessmentSnapshot
  targetQuestionIds: Set<string>
  includeShared: boolean
}) {
  const optionQuestion = new Map(
    params.snapshot.questions.flatMap((question) => question.options.map((option) => [option.id, question.id] as const)),
  )
  const textTargetAllowed = (target: { kind: 'stem' | 'question' | 'option'; id?: string | null }) => {
    if (target.kind === 'stem') return params.includeShared
    if (!target.id) return false
    return target.kind === 'question'
      ? params.targetQuestionIds.has(target.id)
      : params.targetQuestionIds.has(optionQuestion.get(target.id) ?? '')
  }
  const patch = params.patch
  switch (patch.operation) {
    case 'replace_text':
    case 'update_visual_spec':
      return textTargetAllowed(patch.target)
    case 'set_answer_key': {
      const question = params.snapshot.questions.find((item) => item.id === patch.questionId)
      const currentCorrectOptionId = question?.options.find((option) => option.isAnswer)?.id ?? null
      return Boolean(
        question
        && question.questionType === 'multiple_choice'
        && params.targetQuestionIds.has(question.id)
        && currentCorrectOptionId === patch.currentCorrectOptionId
        && question.options.some((option) => option.id === patch.correctOptionId),
      )
    }
    case 'replace_option_and_key': {
      const question = params.snapshot.questions.find((item) => item.id === patch.questionId)
      const option = question?.options.find((item) => item.id === patch.optionId)
      return Boolean(
        question
        && question.questionType === 'multiple_choice'
        && params.targetQuestionIds.has(question.id)
        && optionQuestion.get(patch.optionId) === question.id
        && option?.answerTextPlain.trim() === patch.beforeAnswerText.trim(),
      )
    }
    case 'set_metadata':
      return patch.targetKind === 'stem'
        ? params.includeShared && patch.targetId === params.snapshot.stemId
        : params.targetQuestionIds.has(patch.targetId)
  }
}

function assertAssessmentTargets(params: {
  assessment: UcatAssessmentResponse
  snapshot: UcatAssessmentSnapshot
  targetQuestionIds: string[]
  includeShared: boolean
}) {
  const targets = new Set(params.targetQuestionIds)
  const scopeAllowed = (scopeType: 'shared' | 'question', questionId?: string | null) =>
    scopeType === 'shared' ? params.includeShared : Boolean(questionId && targets.has(questionId))
  if (params.assessment.categories.some((result) => !scopeAllowed(result.scopeType, result.questionId))) {
    throw new Error('Assessment returned a category outside the requested scope')
  }
  const findingKeys = new Set<string>()
  for (const finding of params.assessment.findings) {
    if (!scopeAllowed(finding.scopeType, finding.questionId) || findingKeys.has(finding.key)) {
      throw new Error('Assessment returned an invalid or duplicate finding target')
    }
    findingKeys.add(finding.key)
    if (finding.suggestion?.patches.some((patch) => !patchTargetsCurrentScope({
      patch,
      snapshot: params.snapshot,
      targetQuestionIds: targets,
      includeShared: params.includeShared,
    }))) {
      throw new Error('Assessment returned a suggestion outside the requested scope')
    }
  }
}

function enforceUnreviewableVisuals(params: {
  assessment: UcatAssessmentResponse
  unavailable: Array<{ label: string; inspectable: boolean; error: string | null }>
  snapshot: UcatAssessmentSnapshot
  targetQuestionIds: string[]
  includeShared: boolean
}): UcatAssessmentResponse {
  const unavailable = params.unavailable.filter((item) => !item.inspectable)
  if (unavailable.length === 0) return params.assessment
  const categories = [...params.assessment.categories]
  const findings = [...params.assessment.findings]
  const optionQuestion = new Map(
    params.snapshot.questions.flatMap((question) => question.options.map((option) => [option.id, question.id] as const)),
  )
  const target = new Set(params.targetQuestionIds)

  for (const item of unavailable) {
    const questionMatch = item.label.match(/^question:([0-9a-f-]{36}):/iu)
    const optionMatch = item.label.match(/^option:([0-9a-f-]{36}):/iu)
    const questionId = questionMatch?.[1]
      ?? (optionMatch?.[1] ? optionQuestion.get(optionMatch[1]) : null)
      ?? null
    const scopeType = questionId && target.has(questionId) ? 'question' as const : 'shared' as const
    if (scopeType === 'shared' && !params.includeShared) {
      for (const targetQuestionId of params.targetQuestionIds) {
        const replacement: UcatAssessmentResponse['categories'][number] = {
          scopeType: 'question',
          questionId: targetQuestionId,
          category: 'visual_integrity',
          rating: 'unreviewable',
          confidence: 1,
          summary: 'A potentially relevant shared visual could not be inspected.',
          evidence: [item.label, item.error ?? 'Image unavailable'],
        }
        const existingIndex = categories.findIndex((result) =>
          result.scopeType === replacement.scopeType
          && result.questionId === replacement.questionId
          && result.category === replacement.category)
        if (existingIndex >= 0) categories[existingIndex] = replacement
        else categories.push(replacement)
      }
    } else {
      const replacement: UcatAssessmentResponse['categories'][number] = {
        scopeType,
        questionId: scopeType === 'question' ? questionId : null,
        category: 'visual_integrity',
        rating: 'unreviewable',
        confidence: 1,
        summary: 'A visual could not be inspected.',
        evidence: [item.label, item.error ?? 'Image unavailable'],
      }
      const existingIndex = categories.findIndex((result) =>
        result.scopeType === replacement.scopeType
        && result.questionId === replacement.questionId
        && result.category === replacement.category)
      if (existingIndex >= 0) categories[existingIndex] = replacement
      else categories.push(replacement)
    }
    findings.push({
      key: `visual_unreviewable:${item.label}`,
      scopeType,
      questionId: scopeType === 'question' ? questionId : null,
      category: 'visual_integrity',
      rating: 'unreviewable',
      confidence: 1,
      title: 'Visual could not be inspected',
      detail: 'The reviewer could not inspect a supplied visual, so visual accuracy and fairness cannot be confirmed.',
      evidence: [item.label, item.error ?? 'Image unavailable'],
      suggestion: null,
    })
  }
  return { ...params.assessment, categories, findings }
}

async function currentSnapshotForRun(
  client: SupabaseClient<Database>,
  run: RunRow,
): Promise<UcatAssessmentSnapshot | null> {
  const [snapshot, cycleResult] = await Promise.all([
    loadUcatAssessmentSnapshot(client, run.stem_id),
    asAny(client)
      .from('ucat_ai_question_assessment_cycles')
      .select('is_current')
      .eq('id', run.cycle_id)
      .maybeSingle(),
  ])
  if (!snapshot || cycleResult.error || cycleResult.data?.is_current !== true) return null
  return fingerprintUcatAssessmentSnapshot(snapshot).content === run.content_fingerprint ? snapshot : null
}

async function notifyCriticalAfterPublication(params: {
  client: SupabaseClient<Database>
  run: RunRow
  assessment: UcatAssessmentResponse
}) {
  if (!params.assessment.findings.some((finding) => finding.rating === 'critical')) return
  const { data: stem, error } = await asAny(params.client)
    .from('question_stems')
    .select('status,status_changed_at,status_changed_by')
    .eq('id', params.run.stem_id)
    .maybeSingle()
  if (error || stem?.status !== 'published' || !stem.status_changed_by || !stem.status_changed_at) return
  if (new Date(stem.status_changed_at) <= new Date(params.run.requested_at)) return

  await asAny(params.client).from('notifications').upsert({
    staff_id: stem.status_changed_by,
    notification_type: 'ucat.ai_assessment.critical_after_publish',
    app_scope: 'staff_web',
    title: 'AI review found a critical concern',
    body: 'A background AI review found a critical concern in a question that was published while the review was running.',
    action_url: `/ucat/questions/${params.run.stem_id}?aiReview=1`,
    dedupe_key: `ucat-ai-assessment-critical:${params.run.id}`,
    priority: 'critical',
    read_at: null,
    dismissed_at: null,
    metadata: {
      assessmentRunId: params.run.id,
      stemId: params.run.stem_id,
    },
  }, { onConflict: 'dedupe_key' })
}

export async function runBackgroundUcatQuestionAssessment(
  input: { runId: string },
): Promise<{ runId: string; status: string }> {
  const admin = getServiceRoleClient()
  const { data, error } = await asAny(admin)
    .from('ucat_ai_question_assessment_runs')
    .select('*')
    .eq('id', input.runId)
    .maybeSingle()
  if (error) throw error
  if (!data) throw new Error('UCAT AI assessment run not found')
  const run = data as RunRow
  if (['completed', 'superseded', 'format_blocked'].includes(run.status)) {
    return { runId: run.id, status: run.status }
  }

  const runningIsStale = run.status === 'running'
    && (!run.started_at || Date.now() - new Date(run.started_at).getTime() > 9 * 60_000)
  if (run.status === 'running' && !runningIsStale) {
    return { runId: run.id, status: 'running' }
  }

  const startedAt = new Date().toISOString()
  const { data: claimed, error: runningError } = await asAny(admin)
    .from('ucat_ai_question_assessment_runs')
    .update({
      status: 'running',
      attempt_count: (run.attempt_count ?? 0) + 1,
      started_at: startedAt,
      completed_at: null,
      error_message: null,
    })
    .eq('id', run.id)
    .eq('attempt_count', run.attempt_count ?? 0)
    .select('id')
    .maybeSingle()
  if (runningError) throw runningError
  if (!claimed?.id) return { runId: run.id, status: 'running' }

  const snapshot = await currentSnapshotForRun(admin, run)
  if (!snapshot) {
    await asAny(admin)
      .from('ucat_ai_question_assessment_runs')
      .update({ status: 'superseded', completed_at: new Date().toISOString() })
      .eq('id', run.id)
    return { runId: run.id, status: 'superseded' }
  }

  const targetQuestionIds = run.target_question_ids.filter((id) => snapshot.questions.some((question) => question.id === id))
  if (targetQuestionIds.length === 0) throw new Error('Assessment run has no current target questions')
  const includeSharedAssessment = run.scope_type === 'full'
  const formatChecks = UcatFormatCheckSchema.array().parse(run.format_checks ?? [])

  try {
    const blindVisualEvidence = await buildVisualEvidence({
      client: admin,
      snapshot,
      targetQuestionIds,
      includeExplanations: false,
    })
    const existingBlind = BlindSolutionResponseSchema.safeParse(run.blind_solution)
    let blindSolution = existingBlind.success ? existingBlind.data : null
    let blindProviderId: string | null = null
    let blindModel: string | null = null

    if (!blindSolution) {
      const blindPrompt = buildBlindSolverUserPrompt({
        snapshot,
        targetQuestionIds,
        visualAvailability: blindVisualEvidence.availability,
      })
      const blindResult = await callUcatAiJson({
        client: admin,
        operation: 'question_assessment_blind_solve',
        modelProfileId: run.blind_solver_model_profile_id,
        systemPrompt: BLIND_SOLVER_SYSTEM_PROMPT,
        userPrompt: blindPrompt,
        userContentParts: [
          { type: 'text', text: blindPrompt },
          ...blindVisualEvidence.parts,
        ],
        temperature: 0,
        maxCompletionTokens: 4_000,
        timeoutMs: 180_000,
        providerSort: 'throughput',
        reasoningEffort: 'medium',
        metadata: {
          assessmentRunId: run.id,
          stemId: run.stem_id,
          targetQuestionIds,
          blinded: true,
        },
      })
      blindSolution = BlindSolutionResponseSchema.parse(blindResult.parsed)
      blindProviderId = blindResult.providerId
      blindModel = blindResult.model
      const { error: blindSaveError } = await asAny(admin)
        .from('ucat_ai_question_assessment_runs')
        .update({
          blind_solution: blindSolution as unknown as Json,
          blind_solver_provider_id: blindProviderId,
          blind_solver_model: blindModel,
        })
        .eq('id', run.id)
      if (blindSaveError) throw blindSaveError
    }
    assertBlindSolutionTargets({ solution: blindSolution, snapshot, targetQuestionIds })

    const assessmentVisualEvidence = await buildVisualEvidence({
      client: admin,
      snapshot,
      targetQuestionIds,
      includeExplanations: true,
    })

    const assessmentPrompt = buildAssessmentUserPrompt({
      snapshot,
      targetQuestionIds,
      includeSharedAssessment,
      blindSolution,
      formatChecks,
      visualAvailability: assessmentVisualEvidence.availability,
    })
    const assessmentCall = await callUcatAiJson({
      client: admin,
      operation: 'question_assessment_moderate',
      modelProfileId: run.assessment_model_profile_id,
      systemPrompt: ASSESSMENT_SYSTEM_PROMPT,
      userPrompt: assessmentPrompt,
      userContentParts: [
        { type: 'text', text: assessmentPrompt },
        ...assessmentVisualEvidence.parts,
      ],
      temperature: 0,
      maxCompletionTokens: 8_000,
      timeoutMs: 240_000,
      providerSort: 'throughput',
      reasoningEffort: 'medium',
      metadata: {
        assessmentRunId: run.id,
        stemId: run.stem_id,
        targetQuestionIds,
        blindSolverModelProfileId: run.blind_solver_model_profile_id,
      },
    })
    let assessment = UcatAssessmentResponseSchema.parse(assessmentCall.parsed)
    assertAssessmentTargets({
      assessment,
      snapshot,
      targetQuestionIds,
      includeShared: includeSharedAssessment,
    })
    assessment = withCompleteCategoryCoverage({
      assessment,
      targetQuestionIds,
      includeShared: includeSharedAssessment,
    })
    assessment = enforceUnreviewableVisuals({
      assessment,
      unavailable: assessmentVisualEvidence.availability,
      snapshot,
      targetQuestionIds,
      includeShared: includeSharedAssessment,
    })

    if (!(await currentSnapshotForRun(admin, run))) {
      await asAny(admin)
        .from('ucat_ai_question_assessment_runs')
        .update({ status: 'superseded', completed_at: new Date().toISOString() })
        .eq('id', run.id)
      return { runId: run.id, status: 'superseded' }
    }

    const { error: completionError } = await asAny(admin)
      .from('ucat_ai_question_assessment_runs')
      .update({
        status: 'completed',
        assessment_result: assessment as unknown as Json,
        assessment_provider_id: assessmentCall.providerId,
        assessment_model: assessmentCall.model,
        completed_at: new Date().toISOString(),
        error_message: null,
      })
      .eq('id', run.id)
    if (completionError) throw completionError
    await notifyCriticalAfterPublication({ client: admin, run, assessment })
    return { runId: run.id, status: 'completed' }
  } catch (error) {
    if (error instanceof UcatAiBudgetExceededError) {
      const { error: deferError } = await asAny(admin)
        .from('ucat_ai_question_assessment_runs')
        .update({
          status: 'deferred',
          deferred_until: error.resetAt.toISOString(),
          error_message: error.message,
          queue_message_id: null,
        })
        .eq('id', run.id)
      if (deferError) throw deferError
      return { runId: run.id, status: 'deferred' }
    }
    throw error
  }
}
