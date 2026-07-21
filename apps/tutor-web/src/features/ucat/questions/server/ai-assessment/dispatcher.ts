import { send } from '@vercel/queue'
import type { Database, Json } from '@altitutor/shared'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getServiceRoleClient } from '@/shared/lib/supabase/service-role'
import { AI_ASSESSMENT_PROMPT_VERSION } from '@/features/ucat/questions/lib/ai-assessment/schema'
import {
  assessmentFingerprintsFromRun,
  changedAssessmentScope,
  compactUcatAssessmentSnapshot,
  fingerprintUcatAssessmentSnapshot,
  loadUcatAssessmentSnapshot,
} from './content'
import { automaticReviewEnvironment } from './environment'
import { hasUcatFormatErrors, runUcatFormatChecks } from './format-checks'

export const UCAT_QUESTION_ASSESSMENT_TOPIC = 'ucat-question-assessment'

export type UcatQuestionAssessmentQueueMessage = {
  runId: string
}

type SupabaseAny = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from: (table: string) => any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rpc: (name: string, args?: Record<string, unknown>) => Promise<{ data: any; error: any }>
}

type TriggerKind = 'review_submission' | 'content_change' | 'manual_request'

type RequestResult = {
  kind: 'disabled' | 'skipped' | 'existing' | 'format_blocked' | 'unavailable' | 'queued'
  runId?: string
}

function asAny(client: SupabaseClient<Database>): SupabaseAny {
  return client as unknown as SupabaseAny
}

async function currentStaffId(client: SupabaseClient<Database>): Promise<string | null> {
  const { data } = await asAny(client).rpc('current_tutor_id')
  return typeof data === 'string' ? data : null
}

async function beginCycle(admin: SupabaseClient<Database>, stemId: string, requestedBy: string | null) {
  const { data, error } = await asAny(admin).rpc('service_ucat_start_ai_assessment_cycle', {
    p_stem_id: stemId,
    p_started_by: requestedBy,
  })
  if (error) throw error
  if (typeof data !== 'string') throw new Error('Could not start UCAT AI assessment cycle')
  return data
}

async function getCurrentCycle(admin: SupabaseClient<Database>, stemId: string): Promise<string | null> {
  const { data, error } = await asAny(admin)
    .from('ucat_ai_question_assessment_cycles')
    .select('id')
    .eq('stem_id', stemId)
    .eq('is_current', true)
    .maybeSingle()
  if (error) throw error
  return typeof data?.id === 'string' ? data.id : null
}

async function latestRunFingerprints(
  admin: SupabaseClient<Database>,
  cycleId: string,
) {
  const { data, error } = await asAny(admin)
    .from('ucat_ai_question_assessment_runs')
    .select('content_fingerprint,shared_fingerprint,question_fingerprints')
    .eq('cycle_id', cycleId)
    .order('requested_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  return assessmentFingerprintsFromRun({
    content: data.content_fingerprint,
    shared: data.shared_fingerprint,
    questions: data.question_fingerprints,
  })
}

async function configuredProfiles(admin: SupabaseClient<Database>) {
  const { data, error } = await asAny(admin)
    .from('ucat_ai_generation_settings')
    .select('automatic_review_blind_solver_model_profile_id,automatic_review_assessment_model_profile_id,automatic_review_use_solver_for_assessment')
    .order('created_at')
    .limit(1)
    .maybeSingle()
  if (error) throw error
  const solver = typeof data?.automatic_review_blind_solver_model_profile_id === 'string'
    ? data.automatic_review_blind_solver_model_profile_id
    : null
  const assessment = data?.automatic_review_use_solver_for_assessment !== false
    ? solver
    : typeof data?.automatic_review_assessment_model_profile_id === 'string'
      ? data.automatic_review_assessment_model_profile_id
      : null
  return { solver, assessment }
}

function assessmentDedupeKey(params: {
  cycleId: string
  fingerprint: string
  scopeType: 'full' | 'questions'
  questionIds: string[]
}) {
  const scope = params.scopeType === 'full' ? 'full' : [...params.questionIds].sort().join(',')
  return `${params.cycleId}:${params.fingerprint}:${params.scopeType}:${scope}`
}

export async function requestUcatQuestionAssessment(params: {
  stemId: string
  triggerKind: TriggerKind
  requestedBy?: string | null
  userClient?: SupabaseClient<Database>
}): Promise<RequestResult> {
  if (!automaticReviewEnvironment().enabled) return { kind: 'disabled' }

  const admin = getServiceRoleClient()
  const snapshot = await loadUcatAssessmentSnapshot(admin, params.stemId)
  if (!snapshot || snapshot.status === 'draft') return { kind: 'skipped' }

  const requestedBy = params.requestedBy
    ?? (params.userClient ? await currentStaffId(params.userClient) : null)
  let cycleId: string | null
  if (params.triggerKind === 'review_submission') {
    if (snapshot.status !== 'in_review') return { kind: 'skipped' }
    cycleId = await beginCycle(admin, params.stemId, requestedBy)
  } else {
    cycleId = await getCurrentCycle(admin, params.stemId)
    if (!cycleId && (snapshot.status === 'in_review' || params.triggerKind === 'manual_request')) {
      // Manual requests are deliberately explicit and may start the first cycle;
      // content-change requests still avoid launch backfill outside in-review.
      cycleId = await beginCycle(admin, params.stemId, requestedBy)
    }
    if (!cycleId) return { kind: 'skipped' }
  }

  const currentFingerprints = fingerprintUcatAssessmentSnapshot(snapshot)
  const previousFingerprints = params.triggerKind === 'review_submission'
    ? null
    : await latestRunFingerprints(admin, cycleId)
  const changed = changedAssessmentScope(previousFingerprints, currentFingerprints)
  if (!changed) return { kind: params.triggerKind === 'manual_request' ? 'existing' : 'skipped' }

  const targetQuestionIds = changed.scopeType === 'full'
    ? snapshot.questions.map((question) => question.id)
    : changed.questionIds
  const dedupeKey = assessmentDedupeKey({
    cycleId,
    fingerprint: currentFingerprints.content,
    scopeType: changed.scopeType,
    questionIds: targetQuestionIds,
  })
  const { data: existing, error: existingError } = await asAny(admin)
    .from('ucat_ai_question_assessment_runs')
    .select('id,status')
    .eq('dedupe_key', dedupeKey)
    .maybeSingle()
  if (existingError) throw existingError
  if (existing?.id) return { kind: 'existing', runId: existing.id }

  const [profiles, formatChecks] = await Promise.all([
    configuredProfiles(admin),
    Promise.resolve(runUcatFormatChecks(snapshot)),
  ])
  const formatBlocked = hasUcatFormatErrors(formatChecks)
  const configurationError = !profiles.solver || !profiles.assessment
    ? 'Automatic review model profiles are not configured.'
    : null
  const status = formatBlocked ? 'format_blocked' : configurationError ? 'failed' : 'queued'
  const now = new Date().toISOString()

  const { data: inserted, error: insertError } = await asAny(admin)
    .from('ucat_ai_question_assessment_runs')
    .insert({
      cycle_id: cycleId,
      stem_id: params.stemId,
      trigger_kind: params.triggerKind,
      scope_type: changed.scopeType,
      target_question_ids: targetQuestionIds,
      dedupe_key: dedupeKey,
      content_fingerprint: currentFingerprints.content,
      shared_fingerprint: currentFingerprints.shared,
      question_fingerprints: currentFingerprints.questions,
      content_snapshot: compactUcatAssessmentSnapshot(snapshot) as unknown as Json,
      format_checks: formatChecks as unknown as Json,
      status,
      blind_solver_model_profile_id: profiles.solver,
      assessment_model_profile_id: profiles.assessment,
      prompt_version: AI_ASSESSMENT_PROMPT_VERSION,
      error_message: configurationError,
      requested_by: requestedBy,
      completed_at: status === 'queued' ? null : now,
    })
    .select('id')
    .single()
  if (insertError) {
    if (insertError.code === '23505') return { kind: 'existing' }
    throw insertError
  }

  const runId = String(inserted.id)
  await asAny(admin)
    .from('ucat_ai_question_assessment_runs')
    .update({ status: 'superseded', completed_at: now })
    .eq('cycle_id', cycleId)
    .neq('id', runId)
    .in('status', ['queued', 'deferred'])

  if (formatBlocked) return { kind: 'format_blocked', runId }
  if (configurationError) return { kind: 'unavailable', runId }
  await enqueueUcatQuestionAssessmentRun(runId)
  return { kind: 'queued', runId }
}

export async function requestUcatQuestionAssessmentsForReview(params: {
  stemIds: string[]
  requestedBy?: string | null
  userClient?: SupabaseClient<Database>
  concurrency?: number
}): Promise<void> {
  const stemIds = [...new Set(params.stemIds)]
  const requestedBy = params.requestedBy
    ?? (params.userClient ? await currentStaffId(params.userClient) : null)
  const concurrency = Math.max(1, Math.min(params.concurrency ?? 6, 12))
  let cursor = 0
  async function worker() {
    while (cursor < stemIds.length) {
      const index = cursor
      cursor += 1
      try {
        await requestUcatQuestionAssessment({
          stemId: stemIds[index],
          triggerKind: 'review_submission',
          requestedBy,
        })
      } catch (error) {
        console.error('Could not request automatic UCAT AI assessment', {
          stemId: stemIds[index],
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, stemIds.length) }, () => worker()))
}

export async function enqueueUcatQuestionAssessmentRun(runId: string): Promise<boolean> {
  if (!automaticReviewEnvironment().enabled) return false
  const admin = getServiceRoleClient()
  const { data: run, error } = await asAny(admin)
    .from('ucat_ai_question_assessment_runs')
    .select('id,status,attempt_count,deferred_until')
    .eq('id', runId)
    .maybeSingle()
  if (error) throw error
  if (!run || !['queued', 'deferred'].includes(run.status)) return false
  if (run.status === 'deferred' && run.deferred_until && new Date(run.deferred_until) > new Date()) return false

  const useLocalRunner = process.env.NODE_ENV === 'development'
  try {
    const queueMessageId = useLocalRunner
      ? `local:${runId}:${run.attempt_count ?? 0}`
      : (await send(UCAT_QUESTION_ASSESSMENT_TOPIC, { runId } satisfies UcatQuestionAssessmentQueueMessage, {
          idempotencyKey: `ucat-assessment:${runId}:${run.attempt_count ?? 0}`,
          retentionSeconds: 604_800,
        })).messageId
    const { error: updateError } = await asAny(admin)
      .from('ucat_ai_question_assessment_runs')
      .update({
        status: 'queued',
        queue_message_id: queueMessageId,
        deferred_until: null,
        error_message: null,
      })
      .eq('id', runId)
    if (updateError) throw updateError
    if (useLocalRunner) {
      setTimeout(() => {
        void import('./run-background-assessment')
          .then(({ runBackgroundUcatQuestionAssessment }) => runBackgroundUcatQuestionAssessment({ runId }))
          .catch(async (localError) => {
            await asAny(admin)
              .from('ucat_ai_question_assessment_runs')
              .update({
                status: 'failed',
                error_message: localError instanceof Error ? localError.message : 'Local assessment failed',
                completed_at: new Date().toISOString(),
              })
              .eq('id', runId)
          })
      }, 0)
    }
    return true
  } catch (queueError) {
    // Keep the durable request queued. The recovery dispatcher will try again.
    await asAny(admin)
      .from('ucat_ai_question_assessment_runs')
      .update({
        queue_message_id: null,
        error_message: queueError instanceof Error ? queueError.message : 'Unable to dispatch assessment',
      })
      .eq('id', runId)
    return false
  }
}

export async function retryUcatQuestionAssessmentRun(runId: string): Promise<boolean> {
  const admin = getServiceRoleClient()
  const { data: existing, error: existingError } = await asAny(admin)
    .from('ucat_ai_question_assessment_runs')
    .select('blind_solver_model_profile_id,assessment_model_profile_id,status')
    .eq('id', runId)
    .maybeSingle()
  if (existingError) throw existingError
  if (!existing || existing.status !== 'failed') return false
  let solverProfileId = existing.blind_solver_model_profile_id
  let assessmentProfileId = existing.assessment_model_profile_id
  if (!solverProfileId || !assessmentProfileId) {
    const configured = await configuredProfiles(admin)
    solverProfileId = solverProfileId ?? configured.solver
    assessmentProfileId = assessmentProfileId ?? configured.assessment
  }
  if (!solverProfileId || !assessmentProfileId) {
    throw new Error('Automatic review model profiles are not configured')
  }
  const { data, error } = await asAny(admin)
    .from('ucat_ai_question_assessment_runs')
    .update({
      status: 'queued',
      error_message: null,
      completed_at: null,
      queue_message_id: null,
      deferred_until: null,
      blind_solver_model_profile_id: solverProfileId,
      assessment_model_profile_id: assessmentProfileId,
    })
    .eq('id', runId)
    .eq('status', 'failed')
    .select('id')
    .maybeSingle()
  if (error) throw error
  return data?.id ? enqueueUcatQuestionAssessmentRun(runId) : false
}

export async function recoverQueuedUcatQuestionAssessments(limit = 50): Promise<number> {
  if (!automaticReviewEnvironment().enabled) return 0
  const admin = getServiceRoleClient()
  const now = new Date().toISOString()
  const { data, error } = await asAny(admin)
    .from('ucat_ai_question_assessment_runs')
    .select('id')
    .in('status', ['queued', 'deferred'])
    .is('queue_message_id', null)
    .or(`deferred_until.is.null,deferred_until.lte.${now}`)
    .order('requested_at')
    .limit(limit)
  if (error) throw error
  let dispatched = 0
  for (const run of data ?? []) {
    if (await enqueueUcatQuestionAssessmentRun(String(run.id))) dispatched += 1
  }
  return dispatched
}
