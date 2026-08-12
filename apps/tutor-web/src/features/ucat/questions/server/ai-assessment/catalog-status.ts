import type { Database } from '@altitutor/shared'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  UCAT_DURABLE_AI_REVIEW_STATUSES,
  type UcatAiReviewStatus,
  type UcatDurableAiReviewStatus,
} from '@/features/ucat/questions/lib/ai-assessment/review-status'
import { buildUcatAiReviewEnvironment } from './environment'

type SupabaseAny = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from: (table: string) => any
}

function asAny(client: SupabaseClient<Database>): SupabaseAny {
  return client as unknown as SupabaseAny
}

function isDurableAiReviewStatus(value: unknown): value is UcatDurableAiReviewStatus {
  return typeof value === 'string'
    && (UCAT_DURABLE_AI_REVIEW_STATUSES as ReadonlyArray<string>).includes(value)
}

/** Read persisted catalog AI review statuses (single source with env overlay for `disabled`). */
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

  const { data, error } = await asAny(params.admin)
    .from('ucat_question_catalog_projection')
    .select('stem_id,ai_review_status')
    .in('stem_id', stemIds)
  if (error) throw error

  const byStemId = new Map<string, UcatAiReviewStatus>(
    (data ?? []).map((row: { stem_id: string; ai_review_status: string }) => [
      row.stem_id,
      isDurableAiReviewStatus(row.ai_review_status) ? row.ai_review_status : 'not_requested',
    ]),
  )

  return Object.fromEntries(
    stemIds.map((stemId) => [stemId, byStemId.get(stemId) ?? 'not_requested']),
  )
}
