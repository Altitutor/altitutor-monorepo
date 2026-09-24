import type { Database, Json } from '@altitutor/shared'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { UcatAssessmentFingerprints } from '@/features/ucat/questions/lib/ai-assessment/schema'
import {
  UCAT_DURABLE_AI_REVIEW_STATUSES,
  type UcatAiReviewStatus,
  type UcatDurableAiReviewStatus,
} from '@/features/ucat/questions/lib/ai-assessment/review-status'
import {
  fingerprintUcatAssessmentSnapshot,
  loadUcatAssessmentSnapshot,
} from './content'
import {
  summarizeCurrentUcatAiReview,
  type UcatAiReviewSummaryRun,
} from './status-summary'

export type PersistStemAiReviewSummaryInputs = {
  currentCycleId: string | null
  runs: UcatAiReviewSummaryRun[]
  fingerprints: UcatAssessmentFingerprints
  questionIds: string[]
}

export type PersistStemAiReviewStatusPorts = {
  loadSummaryInputs: (stemId: string) => Promise<PersistStemAiReviewSummaryInputs | null>
  writeCatalogStatus: (stemId: string, status: UcatDurableAiReviewStatus) => Promise<void>
}

type SupabaseAny = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from: (table: string) => any
}

function asAny(client: SupabaseClient<Database>): SupabaseAny {
  return client as unknown as SupabaseAny
}

function stringRecord(value: Json | null): Record<string, string> {
  if (!value || Array.isArray(value) || typeof value !== 'object') return {}
  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
  )
}

function isDurableAiReviewStatus(status: UcatAiReviewStatus): status is UcatDurableAiReviewStatus {
  return (UCAT_DURABLE_AI_REVIEW_STATUSES as ReadonlyArray<string>).includes(status)
}

/**
 * Recompute and persist catalog AI review status for one stem.
 * Always summarizes with environmentEnabled=true so `disabled` is never written.
 */
export async function persistStemAiReviewStatus(
  stemId: string,
  ports: PersistStemAiReviewStatusPorts,
): Promise<UcatDurableAiReviewStatus | null> {
  const inputs = await ports.loadSummaryInputs(stemId)
  if (!inputs) return null

  const { status } = summarizeCurrentUcatAiReview({
    environmentEnabled: true,
    currentCycleId: inputs.currentCycleId,
    runs: inputs.runs,
    fingerprints: inputs.fingerprints,
    questionIds: inputs.questionIds,
  })
  if (!isDurableAiReviewStatus(status)) {
    throw new Error(`Unexpected non-durable AI review status: ${status}`)
  }

  await ports.writeCatalogStatus(stemId, status)
  return status
}

export async function loadPersistStemAiReviewSummaryInputs(
  admin: SupabaseClient<Database>,
  stemId: string,
): Promise<PersistStemAiReviewSummaryInputs | null> {
  const snapshot = await loadUcatAssessmentSnapshot(admin, stemId)
  if (!snapshot) return null

  const { data: cycle, error: cycleError } = await asAny(admin)
    .from('ucat_ai_question_assessment_cycles')
    .select('id')
    .eq('stem_id', stemId)
    .eq('is_current', true)
    .maybeSingle()
  if (cycleError) throw cycleError

  const cycleId = typeof cycle?.id === 'string' ? cycle.id : null
  const runResult = cycleId
    ? await asAny(admin)
        .from('ucat_ai_question_assessment_runs')
        .select('id,cycle_id,scope_type,target_question_ids,shared_fingerprint,question_fingerprints,status,prompt_version,assessment_result,requested_at,started_at')
        .eq('cycle_id', cycleId)
        .order('requested_at', { ascending: false })
    : { data: [], error: null }
  if (runResult.error) throw runResult.error

  const runs = (runResult.data ?? []).map((run: {
    id: string
    cycle_id: string
    scope_type: string
    target_question_ids: string[] | null
    shared_fingerprint: string
    question_fingerprints: Json | null
    status: string
    prompt_version: number
    assessment_result: unknown
    requested_at: string
    started_at?: string | null
  }): UcatAiReviewSummaryRun => ({
    id: run.id,
    cycle_id: run.cycle_id,
    scope_type: run.scope_type === 'questions' ? 'questions' : 'full',
    target_question_ids: Array.isArray(run.target_question_ids) ? run.target_question_ids : [],
    shared_fingerprint: run.shared_fingerprint,
    question_fingerprints: stringRecord(run.question_fingerprints),
    status: run.status,
    prompt_version: run.prompt_version,
    assessment_result: run.assessment_result,
    requested_at: run.requested_at,
    started_at: run.started_at,
  }))

  return {
    currentCycleId: cycleId,
    runs,
    fingerprints: fingerprintUcatAssessmentSnapshot(snapshot),
    questionIds: snapshot.questions.map((question) => question.id),
  }
}

export async function writeUcatCatalogAiReviewStatus(
  admin: SupabaseClient<Database>,
  stemId: string,
  status: UcatDurableAiReviewStatus,
): Promise<void> {
  const { error } = await asAny(admin)
    .from('ucat_question_catalog_projection')
    .update({ ai_review_status: status })
    .eq('stem_id', stemId)
  if (error) throw error
}

export function createPersistStemAiReviewStatusPorts(
  admin: SupabaseClient<Database>,
): PersistStemAiReviewStatusPorts {
  return {
    loadSummaryInputs: (stemId) => loadPersistStemAiReviewSummaryInputs(admin, stemId),
    writeCatalogStatus: (stemId, status) => writeUcatCatalogAiReviewStatus(admin, stemId, status),
  }
}

export async function persistStemAiReviewStatuses(
  stemIds: string[],
  ports: PersistStemAiReviewStatusPorts,
): Promise<void> {
  const unique = [...new Set(stemIds.filter(Boolean))]
  for (const stemId of unique) {
    await persistStemAiReviewStatus(stemId, ports)
  }
}

/** Fire-and-forget safe wrapper for write paths — never fails the caller. */
export async function syncUcatCatalogAiReviewStatusesBestEffort(
  admin: SupabaseClient<Database>,
  stemIds: string[],
): Promise<void> {
  try {
    await persistStemAiReviewStatuses(stemIds, createPersistStemAiReviewStatusPorts(admin))
  } catch (error) {
    console.error('Could not sync UCAT catalog AI review statuses', {
      stemIds,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}
