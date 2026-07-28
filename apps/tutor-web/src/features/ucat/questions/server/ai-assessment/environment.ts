import type { Database } from '@altitutor/shared'
import type { SupabaseClient } from '@supabase/supabase-js'

const TRUE_VALUES = new Set(['1', 'true', 'yes', 'on'])
const FALSE_VALUES = new Set(['0', 'false', 'no', 'off'])

export type AutomaticReviewEnvironment = {
  enabled: boolean
  source: 'explicit' | 'production_default' | 'development_default' | 'non_production_default'
}

export type UcatAiReviewEnvironment = AutomaticReviewEnvironment & {
  automaticEnabled: boolean
}

export type ReviewTriggerKind = 'review_submission' | 'content_change' | 'manual_request'

type SupabaseAny = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from: (table: string) => any
}

function asAny(client: SupabaseClient<Database>): SupabaseAny {
  return client as unknown as SupabaseAny
}

export function automaticReviewEnvironment(): AutomaticReviewEnvironment {
  const raw = process.env.UCAT_AI_AUTOMATIC_REVIEW_ENABLED?.trim().toLowerCase()
  if (raw && TRUE_VALUES.has(raw)) return { enabled: true, source: 'explicit' }
  if (raw && FALSE_VALUES.has(raw)) return { enabled: false, source: 'explicit' }
  if (process.env.VERCEL_ENV === 'production') {
    return { enabled: true, source: 'production_default' }
  }
  if (
    process.env.VERCEL_ENV === 'preview'
    && process.env.VERCEL_GIT_COMMIT_REF === 'develop'
  ) {
    return { enabled: true, source: 'development_default' }
  }
  return { enabled: false, source: 'non_production_default' }
}

export function manualReviewEnvironment(): AutomaticReviewEnvironment {
  return automaticReviewEnvironment()
}

export async function loadAutomaticReviewEnabled(
  admin: SupabaseClient<Database>,
): Promise<boolean> {
  const { data, error } = await asAny(admin)
    .from('ucat_ai_generation_settings')
    .select('automatic_review_enabled')
    .order('created_at')
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data?.automatic_review_enabled !== false
}

export async function buildUcatAiReviewEnvironment(
  admin: SupabaseClient<Database>,
): Promise<UcatAiReviewEnvironment> {
  const environment = automaticReviewEnvironment()
  if (!environment.enabled) {
    return { ...environment, automaticEnabled: false }
  }
  const automaticEnabled = await loadAutomaticReviewEnabled(admin)
  return { ...environment, automaticEnabled }
}

export function resolveReviewTriggerGate(params: {
  envEnabled: boolean
  automaticReviewEnabled: boolean
  triggerKind: ReviewTriggerKind
}): 'allowed' | 'disabled' {
  if (!params.envEnabled) return 'disabled'
  if (params.triggerKind === 'manual_request') return 'allowed'
  return params.automaticReviewEnabled ? 'allowed' : 'disabled'
}
