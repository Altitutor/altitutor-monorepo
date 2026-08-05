import type { Database, Json } from '@altitutor/shared'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { UcatAiReviewStatus } from '@/features/ucat/questions/lib/ai-assessment/review-status'
import {
  fingerprintUcatAssessmentSnapshot,
  ucatAssessmentSnapshotFromDetailRow,
} from './content'
import { buildUcatAiReviewEnvironment } from './environment'
import { summarizeCurrentUcatAiReview, type UcatAiReviewSummaryRun } from './status-summary'

type CycleRow = { id: string; stem_id: string }

function stringRecord(value: Json | null): Record<string, string> {
  if (!value || Array.isArray(value) || typeof value !== 'object') return {}
  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
  )
}

export async function loadUcatCatalogAiReviewStatuses(params: {
  admin: SupabaseClient<Database>
  tutorClient: SupabaseClient<Database>
  stemIds: string[]
}): Promise<Record<string, UcatAiReviewStatus>> {
  const stemIds = [...new Set(params.stemIds)]
  if (stemIds.length === 0) return {}

  const environment = await buildUcatAiReviewEnvironment(params.admin)
  if (!environment.enabled) {
    return Object.fromEntries(stemIds.map((stemId) => [stemId, 'disabled' as const]))
  }

  const [detailResult, cycleResult] = await Promise.all([
    params.tutorClient
      .from('vtutor_ucat_question_stem_detail')
      .select('*')
      .in('id', stemIds),
    params.admin
      .from('ucat_ai_question_assessment_cycles')
      .select('id,stem_id')
      .in('stem_id', stemIds)
      .eq('is_current', true),
  ])
  if (detailResult.error) throw detailResult.error
  if (cycleResult.error) throw cycleResult.error

  const cycles = (cycleResult.data ?? []) as CycleRow[]
  const cycleIds = cycles.map((cycle) => cycle.id)
  const runResult = cycleIds.length === 0
    ? { data: [], error: null }
    : await params.admin
        .from('ucat_ai_question_assessment_runs')
        .select('id,cycle_id,scope_type,target_question_ids,shared_fingerprint,question_fingerprints,status,prompt_version,assessment_result,requested_at,started_at')
        .in('cycle_id', cycleIds)
        .order('requested_at', { ascending: false })
  if (runResult.error) throw runResult.error

  const runs = (runResult.data ?? []).map((run): UcatAiReviewSummaryRun => ({
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
  const cycleByStemId = new Map(cycles.map((cycle) => [cycle.stem_id, cycle.id]))
  const snapshotByStemId = new Map(
    (detailResult.data ?? []).flatMap((row) => {
      const snapshot = ucatAssessmentSnapshotFromDetailRow(row)
      return snapshot ? [[snapshot.stemId, snapshot] as const] : []
    }),
  )

  return Object.fromEntries(stemIds.map((stemId) => {
    const snapshot = snapshotByStemId.get(stemId)
    if (!snapshot) return [stemId, 'not_requested']
    return [stemId, summarizeCurrentUcatAiReview({
      environmentEnabled: true,
      currentCycleId: cycleByStemId.get(stemId) ?? null,
      runs,
      fingerprints: fingerprintUcatAssessmentSnapshot(snapshot),
      questionIds: snapshot.questions.map((question) => question.id),
    }).status]
  }))
}
