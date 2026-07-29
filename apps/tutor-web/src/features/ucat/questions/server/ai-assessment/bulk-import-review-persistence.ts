import type { Database, Json } from '@altitutor/shared'
import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import {
  AI_ASSESSMENT_PROMPT_VERSION,
  BlindSolutionResponseSchema,
  UcatAssessmentResponseSchema,
  type UcatAssessmentFingerprints,
  type UcatAssessmentSnapshot,
} from '@/features/ucat/questions/lib/ai-assessment/schema'
import type { BulkImportAiReviewSubmission } from '@/features/ucat/questions/lib/bulk-import-ai-review'
import { getServiceRoleClient } from '@/shared/lib/supabase/service-role'
import {
  compactUcatAssessmentSnapshot,
  fingerprintUcatAssessmentSnapshot,
  loadUcatAssessmentSnapshot,
} from './content'
import { runUcatFormatChecks } from './format-checks'
import { loadGenerationReviewConfig } from './dispatcher'
import { verifyBulkImportReviewToken } from './bulk-import-review-token'

const FingerprintsSchema = z.object({
  content: z.string().min(1),
  shared: z.string().min(1),
  questions: z.record(z.string()),
})

const ReviewProvenanceSchema = z.object({
  blindSolverModelProfileId: z.string().uuid().nullable(),
  assessmentModelProfileId: z.string().uuid().nullable(),
  blindProviderId: z.string().uuid().nullable(),
  blindModel: z.string().nullable(),
  assessmentProviderId: z.string().uuid().nullable(),
  assessmentModel: z.string().nullable(),
})

export const BulkImportAiReviewSubmissionSchema = z.object({
  draftStemId: z.string().uuid(),
  promptVersion: z.number().int(),
  fingerprints: FingerprintsSchema,
  assessment: UcatAssessmentResponseSchema,
  blindSolution: BlindSolutionResponseSchema,
  provenance: ReviewProvenanceSchema.nullable().optional(),
  reviewToken: z.string().min(1),
  decisions: z.array(z.object({
    findingKey: z.string().min(1),
    decision: z.literal('dismissed'),
  })).max(100).optional().default([]),
})

type SupabaseAny = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from: (table: string) => any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rpc: (name: string, args?: Record<string, unknown>) => Promise<{ data: any; error: any }>
}

type FreshReviewResult =
  | { ok: true; review: z.infer<typeof BulkImportAiReviewSubmissionSchema> }
  | { ok: false; reason: string }

export type BulkImportAiReviewPersistenceResult = {
  persistedStemIds: string[]
  skipped: Array<{ stemId: string; reason: string }>
}

function asAny(client: SupabaseClient<Database>): SupabaseAny {
  return client as unknown as SupabaseAny
}

function sameFingerprints(
  expected: UcatAssessmentFingerprints,
  actual: UcatAssessmentFingerprints,
): boolean {
  if (expected.content !== actual.content || expected.shared !== actual.shared) return false
  const expectedEntries = Object.entries(expected.questions).sort(([left], [right]) =>
    left.localeCompare(right),
  )
  const actualEntries = Object.entries(actual.questions).sort(([left], [right]) =>
    left.localeCompare(right),
  )
  return JSON.stringify(expectedEntries) === JSON.stringify(actualEntries)
}

/**
 * Public, deterministic freshness gate used immediately before persistence.
 * Draft results are accepted only for the same stable stem ID, prompt version,
 * complete question membership, and exact server-loaded content fingerprint.
 */
export function selectFreshBulkImportAiReview(params: {
  stemId: string
  snapshot: UcatAssessmentSnapshot
  review: unknown
}): FreshReviewResult {
  const parsed = BulkImportAiReviewSubmissionSchema.safeParse(params.review)
  if (!parsed.success) return { ok: false, reason: 'invalid_review' }
  const review = parsed.data
  if (review.draftStemId !== params.stemId) return { ok: false, reason: 'stem_id_mismatch' }
  if (review.promptVersion !== AI_ASSESSMENT_PROMPT_VERSION) {
    return { ok: false, reason: 'stale_prompt_version' }
  }
  if (!verifyBulkImportReviewToken({
    draftStemId: review.draftStemId,
    promptVersion: review.promptVersion,
    fingerprints: review.fingerprints,
    assessment: review.assessment,
    blindSolution: review.blindSolution,
    provenance: review.provenance ?? null,
  }, review.reviewToken)) {
    return { ok: false, reason: 'invalid_review_token' }
  }

  const currentFingerprints = fingerprintUcatAssessmentSnapshot(params.snapshot)
  if (!sameFingerprints(review.fingerprints, currentFingerprints)) {
    return { ok: false, reason: 'content_changed_after_review' }
  }

  const currentQuestionIds = new Set(params.snapshot.questions.map((question) => question.id))
  const assessmentQuestionIds = [
    ...review.assessment.categories,
    ...review.assessment.findings,
  ].flatMap((item) => item.scopeType === 'question' && item.questionId ? [item.questionId] : [])
  if (assessmentQuestionIds.some((questionId) => !currentQuestionIds.has(questionId))) {
    return { ok: false, reason: 'invalid_question_scope' }
  }
  const findingKeys = new Set(review.assessment.findings.map((finding) => finding.key))
  if (review.decisions.some((decision) => !findingKeys.has(decision.findingKey))) {
    return { ok: false, reason: 'invalid_finding_decision' }
  }

  const blindQuestionIds = review.blindSolution.solutions.map((solution) => solution.questionId)
  if (
    blindQuestionIds.length !== currentQuestionIds.size
    || new Set(blindQuestionIds).size !== currentQuestionIds.size
    || blindQuestionIds.some((questionId) => !currentQuestionIds.has(questionId))
  ) {
    return { ok: false, reason: 'incomplete_blind_solution' }
  }

  return { ok: true, review }
}

async function persistOneFreshReview(params: {
  admin: SupabaseClient<Database>
  requestedBy: string | null
  stemId: string
  review: BulkImportAiReviewSubmission
}): Promise<{ persisted: boolean; reason?: string }> {
  const snapshot = await loadUcatAssessmentSnapshot(params.admin, params.stemId)
  if (!snapshot) return { persisted: false, reason: 'imported_stem_unavailable' }
  const fresh = selectFreshBulkImportAiReview({
    stemId: params.stemId,
    snapshot,
    review: params.review,
  })
  if (!fresh.ok) return { persisted: false, reason: fresh.reason }

  const { data: currentCycle, error: cycleLookupError } = await asAny(params.admin)
    .from('ucat_ai_question_assessment_cycles')
    .select('id')
    .eq('stem_id', params.stemId)
    .eq('is_current', true)
    .maybeSingle()
  if (cycleLookupError) throw cycleLookupError

  let cycleId = typeof currentCycle?.id === 'string' ? currentCycle.id : null
  if (!cycleId) {
    const { data, error } = await asAny(params.admin).rpc(
      'service_ucat_start_ai_assessment_cycle',
      {
        p_stem_id: params.stemId,
        p_started_by: params.requestedBy,
      },
    )
    if (error) throw error
    if (typeof data !== 'string') throw new Error('Could not start UCAT AI assessment cycle')
    cycleId = data
  }

  const dedupeKey = `${cycleId}:${fresh.review.fingerprints.content}:full:full`
  const { data: existing, error: existingError } = await asAny(params.admin)
    .from('ucat_ai_question_assessment_runs')
    .select('id,status')
    .eq('dedupe_key', dedupeKey)
    .maybeSingle()
  if (existingError) throw existingError
  const persistDecisions = async (runId: string) => {
    if (fresh.review.decisions.length === 0) return
    const { data: existingDecisions, error: lookupError } = await asAny(params.admin)
      .from('ucat_ai_question_assessment_decisions')
      .select('finding_key')
      .eq('run_id', runId)
      .in('finding_key', fresh.review.decisions.map((decision) => decision.findingKey))
    if (lookupError) throw lookupError
    const recordedKeys = new Set(
      (existingDecisions ?? []).map((row: { finding_key?: unknown }) => String(row.finding_key ?? ''))
    )
    const findings = new Map(
      fresh.review.assessment.findings.map((finding) => [finding.key, finding])
    )
    const pending = fresh.review.decisions.filter(
      (decision) => !recordedKeys.has(decision.findingKey)
    )
    if (pending.length === 0) return
    const { error } = await asAny(params.admin)
      .from('ucat_ai_question_assessment_decisions')
      .insert(pending.map((decision) => {
        const finding = findings.get(decision.findingKey)
        return {
          run_id: runId,
          stem_id: params.stemId,
          finding_key: decision.findingKey,
          decision: decision.decision,
          reason: null,
          reviewed_content_fingerprint: fresh.review.fingerprints.content,
          patch: finding?.suggestion?.patches
            ? finding.suggestion.patches as unknown as Json
            : null,
          decided_by: params.requestedBy,
        }
      }))
    if (error) throw error
  }

  if (existing?.status === 'completed') {
    await persistDecisions(String(existing.id))
    return { persisted: true }
  }
  if (existing?.id) return { persisted: false, reason: 'assessment_already_in_progress' }

  const config = await loadGenerationReviewConfig(params.admin)
  const provenance = fresh.review.provenance
  const now = new Date().toISOString()
  const { data: inserted, error: insertError } = await asAny(params.admin)
    .from('ucat_ai_question_assessment_runs')
    .insert({
      cycle_id: cycleId,
      stem_id: params.stemId,
      trigger_kind: 'manual_request',
      scope_type: 'full',
      target_question_ids: snapshot.questions.map((question) => question.id),
      dedupe_key: dedupeKey,
      content_fingerprint: fresh.review.fingerprints.content,
      shared_fingerprint: fresh.review.fingerprints.shared,
      question_fingerprints: fresh.review.fingerprints.questions,
      content_snapshot: compactUcatAssessmentSnapshot(snapshot) as unknown as Json,
      format_checks: runUcatFormatChecks(snapshot) as unknown as Json,
      status: 'completed',
      attempt_count: 1,
      blind_solver_model_profile_id:
        provenance?.blindSolverModelProfileId ?? config.solver,
      assessment_model_profile_id:
        provenance?.assessmentModelProfileId ?? config.assessment,
      blind_solver_provider_id: provenance?.blindProviderId ?? null,
      blind_solver_model: provenance?.blindModel ?? null,
      assessment_provider_id: provenance?.assessmentProviderId ?? null,
      assessment_model: provenance?.assessmentModel ?? null,
      prompt_version: fresh.review.promptVersion,
      blind_solution: fresh.review.blindSolution as unknown as Json,
      assessment_result: fresh.review.assessment as unknown as Json,
      error_message: null,
      requested_by: params.requestedBy,
      requested_at: now,
      started_at: now,
      completed_at: now,
    })
    .select('id')
    .single()
  if (insertError) {
    if (insertError.code === '23505') return { persisted: true }
    throw insertError
  }
  if (!inserted?.id) throw new Error('Could not persist the completed bulk-import AI review')
  await persistDecisions(String(inserted.id))
  return { persisted: true }
}

/**
 * Persists completed, still-current bulk-import reviews into the existing
 * assessment cycle/run tables. Persistence failures are isolated per stem so a
 * successful content import is never rolled back by supplementary review data.
 */
export async function persistFreshBulkImportAiReviews(params: {
  reviews: BulkImportAiReviewSubmission[]
  importedStemIds: string[]
  userClient: SupabaseClient<Database>
}): Promise<BulkImportAiReviewPersistenceResult> {
  if (params.reviews.length === 0) return { persistedStemIds: [], skipped: [] }
  const imported = new Set(params.importedStemIds)
  const { data: staffId, error: staffError } = await asAny(params.userClient).rpc('current_tutor_id')
  if (staffError) throw staffError
  const requestedBy = typeof staffId === 'string' ? staffId : null
  const admin = getServiceRoleClient()
  const persistedStemIds: string[] = []
  const skipped: Array<{ stemId: string; reason: string }> = []

  for (const review of params.reviews) {
    if (!imported.has(review.draftStemId)) {
      skipped.push({ stemId: review.draftStemId, reason: 'stem_not_imported' })
      continue
    }
    try {
      const result = await persistOneFreshReview({
        admin,
        requestedBy,
        stemId: review.draftStemId,
        review,
      })
      if (result.persisted) persistedStemIds.push(review.draftStemId)
      else skipped.push({
        stemId: review.draftStemId,
        reason: result.reason ?? 'persistence_skipped',
      })
    } catch (error) {
      console.error('Could not persist bulk-import AI review', {
        stemId: review.draftStemId,
        error: error instanceof Error ? error.message : String(error),
      })
      skipped.push({ stemId: review.draftStemId, reason: 'persistence_failed' })
    }
  }

  return { persistedStemIds, skipped }
}
