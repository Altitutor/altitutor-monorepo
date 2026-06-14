import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Json } from '@altitutor/shared'

type SupabaseAny = SupabaseClient<Database> & {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from: (table: string) => any
}

export type UcatAiUsage = {
  prompt_tokens?: number
  completion_tokens?: number
  total_tokens?: number
} | null

export type UcatAiJsonResult = {
  content: string
  parsed: unknown
  model: string
  providerId: string | null
  profileId: string | null
  usage: UcatAiUsage
  finishReason: string | null
  maxCompletionTokens: number | null
}

type ProviderRow = {
  id: string
  name: string
  provider_key: string
  base_url: string
  secret_env_var_name: string
  default_headers: Record<string, string> | null
  is_enabled: boolean
}

type ProfileRow = {
  id: string
  name: string
  provider_id: string
  model: string
  is_enabled: boolean
  is_default: boolean
  candidates_per_stem: number
  temperature: number
  max_completion_tokens: number
  profile_version: number
  base_system_prompt: string
  planner_prompt: string
  writer_prompt: string
  critic_prompt: string
  rewriter_prompt: string
}

type SettingsRow = {
  id: string
  max_candidates_per_stem: number
  max_requested_stems_per_run: number
  daily_token_budget: number | null
  daily_cost_budget_cents: number | null
  raw_logging_enabled: boolean
}

type PromptLayerRow = {
  id: string
  scope_type: 'section' | 'stem_category' | 'question_tag'
  scope_id: string
  prompt_text: string
  prompt_version: number
  is_enabled: boolean
}

export type UcatAiResolvedConfig = {
  provider: ProviderRow
  profile: ProfileRow
  settings: SettingsRow
}

const FALLBACK_SETTINGS: SettingsRow = {
  id: 'fallback',
  max_candidates_per_stem: 2,
  max_requested_stems_per_run: 20,
  daily_token_budget: null,
  daily_cost_budget_cents: null,
  raw_logging_enabled: false,
}

function asAny(client: SupabaseClient<Database>): SupabaseAny {
  return client as SupabaseAny
}

function parseHeaders(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const headers: Record<string, string> = {}
  for (const [key, raw] of Object.entries(value)) {
    if (typeof raw === 'string' && raw.trim()) headers[key] = raw
  }
  return headers
}

async function getSettings(client: SupabaseClient<Database>): Promise<SettingsRow> {
  const { data, error } = await asAny(client)
    .from('ucat_ai_generation_settings')
    .select('*')
    .order('created_at')
    .limit(1)
    .maybeSingle()
  if (error || !data) return FALLBACK_SETTINGS
  return data as unknown as SettingsRow
}

export async function getEnabledUcatAiProfiles(client: SupabaseClient<Database>): Promise<ProfileRow[]> {
  const { data, error } = await asAny(client)
    .from('ucat_ai_generation_profiles')
    .select('*')
    .eq('is_enabled', true)
    .order('is_default', { ascending: false })
    .order('name')
  if (error) return []
  return (data ?? []) as unknown as ProfileRow[]
}

export async function resolveUcatAiConfig(
  client: SupabaseClient<Database>,
  profileId?: string | null
): Promise<UcatAiResolvedConfig> {
  const settings = await getSettings(client)
  let profileQuery = asAny(client).from('ucat_ai_generation_profiles').select('*').eq('is_enabled', true)
  profileQuery = profileId ? profileQuery.eq('id', profileId) : profileQuery.eq('is_default', true)
  const { data: profileData, error: profileError } = await profileQuery.maybeSingle()

  if (profileError || !profileData) {
    throw new Error(profileId ? 'Selected UCAT generation profile is not available' : 'No default UCAT generation profile is configured')
  }

  const profile = profileData as unknown as ProfileRow
  const { data: providerData, error: providerError } = await asAny(client)
    .from('ucat_ai_generation_providers')
    .select('*')
    .eq('id', profile.provider_id)
    .eq('is_enabled', true)
    .maybeSingle()

  if (providerError || !providerData) {
    throw new Error('UCAT generation provider is not available')
  }

  return {
    provider: providerData as unknown as ProviderRow,
    profile,
    settings,
  }
}

export async function getUcatAiPromptLayers(params: {
  client: SupabaseClient<Database>
  sectionId?: string | null
  categoryId?: string | null
  tagIds?: string[]
}): Promise<PromptLayerRow[]> {
  const ids = [params.sectionId, params.categoryId, ...(params.tagIds ?? [])].filter(
    (id): id is string => typeof id === 'string' && id.length > 0
  )
  if (ids.length === 0) return []

  const { data, error } = await asAny(params.client)
    .from('ucat_ai_generation_prompt_layers')
    .select('*')
    .eq('is_enabled', true)
    .in('scope_id', ids)

  if (error) return []
  return (data ?? []) as unknown as PromptLayerRow[]
}

async function assertBudget(client: SupabaseClient<Database>, settings: SettingsRow) {
  if (!settings.daily_token_budget && !settings.daily_cost_budget_cents) return

  const since = new Date()
  since.setHours(0, 0, 0, 0)
  const { data, error } = await asAny(client)
    .from('ucat_ai_generation_usage')
    .select('total_tokens,estimated_cost_cents')
    .gte('created_at', since.toISOString())

  if (error) return

  const rows = (data ?? []) as Array<{ total_tokens?: number | null; estimated_cost_cents?: number | null }>
  const tokens = rows.reduce((sum, row) => sum + (row.total_tokens ?? 0), 0)
  const cost = rows.reduce((sum, row) => sum + (row.estimated_cost_cents ?? 0), 0)

  if (settings.daily_token_budget && tokens >= settings.daily_token_budget) {
    throw new Error('UCAT AI daily token budget has been reached')
  }
  if (settings.daily_cost_budget_cents && cost >= settings.daily_cost_budget_cents) {
    throw new Error('UCAT AI daily cost budget has been reached')
  }
}

async function recordUsage(params: {
  client: SupabaseClient<Database>
  config: UcatAiResolvedConfig
  operation: string
  model: string
  usage: UcatAiUsage
  metadata?: Json | null
}) {
  await asAny(params.client)
    .from('ucat_ai_generation_usage')
    .insert({
      profile_id: params.config.profile.id,
      provider_id: params.config.provider.id,
      model: params.model,
      operation: params.operation,
      prompt_tokens: params.usage?.prompt_tokens ?? null,
      completion_tokens: params.usage?.completion_tokens ?? null,
      total_tokens: params.usage?.total_tokens ?? null,
      estimated_cost_cents: null,
      metadata: params.metadata ?? null,
    })
}

export async function callUcatAiJson(params: {
  client: SupabaseClient<Database>
  operation: string
  profileId?: string | null
  systemPrompt: string
  userPrompt: string
  temperature?: number
  maxCompletionTokens?: number
  timeoutMs?: number
  metadata?: Json | null
}): Promise<UcatAiJsonResult> {
  const config = await resolveUcatAiConfig(params.client, params.profileId)
  await assertBudget(params.client, config.settings)

  const apiKey = process.env[config.provider.secret_env_var_name]
  if (!apiKey) {
    throw new Error(`${config.provider.secret_env_var_name} is not configured`)
  }

  const controller = new AbortController()
  const timeoutMs = params.timeoutMs ?? 120000
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  const maxCompletionTokens = params.maxCompletionTokens ?? config.profile.max_completion_tokens

  const response = await fetch(`${config.provider.base_url.replace(/\/$/u, '')}/chat/completions`, {
    method: 'POST',
    signal: controller.signal,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      ...parseHeaders(config.provider.default_headers),
    },
    body: JSON.stringify({
      model: config.profile.model,
      temperature: params.temperature ?? Number(config.profile.temperature),
      response_format: { type: 'json_object' },
      max_completion_tokens: maxCompletionTokens,
      messages: [
        { role: 'system', content: params.systemPrompt },
        { role: 'user', content: params.userPrompt },
      ],
    }),
  }).finally(() => clearTimeout(timeout))

  if (!response.ok) {
    throw new Error(`UCAT AI ${params.operation} failed: ${await response.text()}`)
  }

  const json = (await response.json()) as {
    choices?: Array<{ message?: { content?: string | null }; finish_reason?: string | null }>
    usage?: UcatAiUsage
  }
  const content = json.choices?.[0]?.message?.content
  if (!content) throw new Error(`UCAT AI ${params.operation} returned empty response`)

  await recordUsage({
    client: params.client,
    config,
    operation: params.operation,
    model: config.profile.model,
    usage: json.usage ?? null,
    metadata: params.metadata ?? null,
  })

  return {
    content,
    parsed: JSON.parse(content),
    model: config.profile.model,
    providerId: config.provider.id,
    profileId: config.profile.id,
    usage: json.usage ?? null,
    finishReason: json.choices?.[0]?.finish_reason ?? null,
    maxCompletionTokens,
  }
}
