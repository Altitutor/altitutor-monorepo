import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Json } from '@altitutor/shared'
import { callCodexOAuthJson, type CodexOAuthUserContentPart } from './ucat-codex-oauth'

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
  modelProfileId: string | null
  usage: UcatAiUsage
  finishReason: string | null
  maxCompletionTokens: number | null
}

export type UcatAiUserContentPart =
  | { type: 'text'; text: string }
  | { type: 'image'; imageUrl: string; detail?: 'low' | 'high' | 'auto' }

export class UcatAiJsonParseError extends Error {
  content: string
  finishReason: string | null
  usage: UcatAiUsage
  model: string
  providerId: string | null
  modelProfileId: string | null
  maxCompletionTokens: number | null

  constructor(params: {
    operation: string
    content: string
    finishReason: string | null
    usage: UcatAiUsage
    model: string
    providerId: string | null
    modelProfileId: string | null
    maxCompletionTokens: number | null
  }) {
    super(`UCAT AI ${params.operation} returned invalid JSON: ${params.content.slice(0, 160)}`)
    this.name = 'UcatAiJsonParseError'
    this.content = params.content
    this.finishReason = params.finishReason
    this.usage = params.usage
    this.model = params.model
    this.providerId = params.providerId
    this.modelProfileId = params.modelProfileId
    this.maxCompletionTokens = params.maxCompletionTokens
  }
}

export class UcatAiEmptyResponseError extends Error {
  content = ''
  finishReason: string | null
  usage: UcatAiUsage
  model: string
  providerId: string | null
  modelProfileId: string | null
  maxCompletionTokens: number | null

  constructor(params: {
    operation: string
    finishReason: string | null
    usage: UcatAiUsage
    model: string
    providerId: string | null
    modelProfileId: string | null
    maxCompletionTokens: number | null
  }) {
    super(`UCAT AI ${params.operation} returned empty response`)
    this.name = 'UcatAiEmptyResponseError'
    this.finishReason = params.finishReason
    this.usage = params.usage
    this.model = params.model
    this.providerId = params.providerId
    this.modelProfileId = params.modelProfileId
    this.maxCompletionTokens = params.maxCompletionTokens
  }
}

type ProviderRow = {
  id: string
  name: string
  provider_key: string
  provider_kind?: 'chat_completions' | 'codex_oauth'
  base_url: string
  secret_env_var_name: string
  default_headers: Record<string, string> | null
  is_enabled: boolean
}

type ModelProfileRow = {
  id: string
  name: string
  provider_id: string
  model: string
  is_enabled: boolean
  is_default: boolean
  temperature: number
  max_completion_tokens: number
}

type SystemPromptsRow = {
  id: string
  base_system_prompt: string
  planner_prompt: string
  writer_prompt: string
  critic_prompt: string
  rewriter_prompt: string
  prompt_version: number
}

type SettingsRow = {
  id: string
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
  modelProfile: ModelProfileRow
  systemPrompts: SystemPromptsRow
  settings: SettingsRow
}

const FALLBACK_SETTINGS: SettingsRow = {
  id: 'fallback',
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

function repairCommonGeneratedJson(value: string): string | null {
  const normalizedValue = value.replace(
    /\}\]\s*,\s*"\}\s*,\s*\{\s*"type"/gu,
    ']},{"type"'
  )
  const stack: Array<{ opening: '{' | '['; propertyName: string | null }> = []
  let repaired = ''
  let inString = false
  let escaped = false
  let propertyName: string | null = null
  let stringStart = -1

  for (let index = 0; index < normalizedValue.length; index += 1) {
    const character = normalizedValue[index]
    if (inString) {
      repaired += character
      if (escaped) escaped = false
      else if (character === '\\') escaped = true
      else if (character === '"') {
        inString = false
        const next = normalizedValue.slice(index + 1).match(/^\s*:/u)
        if (next) propertyName = normalizedValue.slice(stringStart + 1, index)
      }
      continue
    }

    if (character === '"') {
      inString = true
      stringStart = index
      repaired += character
      continue
    }

    if (character === '{' || character === '[') {
      stack.push({ opening: character, propertyName })
      propertyName = null
      repaired += character
      continue
    }

    if (character === '}' || character === ']') {
      const requiredOpening = character === '}' ? '{' : '['
      const top = stack.at(-1)
      if (top?.opening !== requiredOpening) {
        // Some completed responses add an extra object closer between content
        // blocks (for example, `table}}, {paragraph...}`). It is safe to drop
        // only when the surrounding array is a generated-content field and a
        // further typed block immediately follows.
        if (
          character === '}'
          && top?.opening === '['
          && ['stemText', 'answerText', 'answerExplanation'].includes(top.propertyName ?? '')
          && /^\s*,\s*\{\s*"type"\s*:/u.test(normalizedValue.slice(index + 1))
        ) {
          continue
        }
        // A frequent writer slip is closing a table object after its final row
        // without first closing the rows array. Repair only that exact case.
        if (character === '}' && top?.opening === '[' && top.propertyName === 'rows') {
          repaired += ']'
          stack.pop()
        } else {
          return null
        }
      }
      if (stack.at(-1)?.opening !== requiredOpening) return null
      stack.pop()
      repaired += character
      continue
    }

    repaired += character
  }

  if (inString || stack.length > 2) return null
  if (stack.length === 0) return repaired
  if (stack[0]?.opening !== '{') return null
  if (stack.length === 2 && (stack[1]?.opening !== '[' || stack[1]?.propertyName !== 'stems')) return null
  if (stack.length === 1 && !/^\s*\{\s*"stems"\s*:/u.test(normalizedValue)) return null

  for (let index = stack.length - 1; index >= 0; index -= 1) {
    repaired += stack[index].opening === '{' ? '}' : ']'
  }
  return repaired
}

function parseJsonCandidate(value: string): unknown {
  try {
    return JSON.parse(value)
  } catch (error) {
    const repaired = repairCommonGeneratedJson(value)
    if (!repaired) throw error
    return JSON.parse(repaired)
  }
}

export function parseUcatAiJsonContent(content: string): unknown {
  const trimmed = content.trim()
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/iu)
  if (fenced?.[1]) return parseJsonCandidate(fenced[1])

  try {
    return parseJsonCandidate(trimmed)
  } catch (directError) {
    const objectStart = trimmed.indexOf('{')
    const objectEnd = trimmed.lastIndexOf('}')
    if (objectStart >= 0 && objectEnd > objectStart) {
      return parseJsonCandidate(trimmed.slice(objectStart, objectEnd + 1))
    }
    throw directError
  }
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

export async function getEnabledUcatAiModelProfiles(client: SupabaseClient<Database>): Promise<ModelProfileRow[]> {
  const { data, error } = await asAny(client)
    .from('ucat_ai_generation_model_profiles')
    .select('*')
    .eq('is_enabled', true)
    .order('is_default', { ascending: false })
    .order('name')
  if (error) return []
  return (data ?? []) as unknown as ModelProfileRow[]
}

export async function resolveUcatAiConfig(
  client: SupabaseClient<Database>,
  modelProfileId?: string | null
): Promise<UcatAiResolvedConfig> {
  const settings = await getSettings(client)
  let profileQuery = asAny(client).from('ucat_ai_generation_model_profiles').select('*').eq('is_enabled', true)
  profileQuery = modelProfileId ? profileQuery.eq('id', modelProfileId) : profileQuery.eq('is_default', true)
  const { data: profileData, error: profileError } = await profileQuery.maybeSingle()

  if (profileError || !profileData) {
    throw new Error(modelProfileId ? 'Selected UCAT model profile is not available' : 'No default UCAT model profile is configured')
  }

  const modelProfile = profileData as unknown as ModelProfileRow
  const { data: providerData, error: providerError } = await asAny(client)
    .from('ucat_ai_generation_providers')
    .select('*')
    .eq('id', modelProfile.provider_id)
    .eq('is_enabled', true)
    .maybeSingle()

  if (providerError || !providerData) {
    throw new Error('UCAT generation provider is not available')
  }

  const { data: systemPromptsData, error: systemPromptsError } = await asAny(client)
    .from('ucat_ai_generation_system_prompts')
    .select('*')
    .limit(1)
    .maybeSingle()

  if (systemPromptsError || !systemPromptsData) {
    throw new Error('UCAT generation system prompts are not configured')
  }

  return {
    provider: providerData as unknown as ProviderRow,
    modelProfile,
    systemPrompts: systemPromptsData as unknown as SystemPromptsRow,
    settings,
  }
}

export async function getUcatAiPromptLayers(params: {
  client: SupabaseClient<Database>
  sectionId?: string | null
  categoryId?: string | null
  categoryIds?: string[]
  tagIds?: string[]
}): Promise<PromptLayerRow[]> {
  const ids = [params.sectionId, params.categoryId, ...(params.categoryIds ?? []), ...(params.tagIds ?? [])].filter(
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
      model_profile_id: params.config.modelProfile.id,
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
  modelProfileId?: string | null
  systemPrompt: string
  userPrompt: string
  userContentParts?: UcatAiUserContentPart[]
  temperature?: number
  maxCompletionTokens?: number
  timeoutMs?: number
  providerSort?: 'price' | 'throughput' | 'latency'
  reasoningEffort?: 'none' | 'minimal' | 'low' | 'medium' | 'high'
  metadata?: Json | null
  signal?: AbortSignal
}): Promise<UcatAiJsonResult> {
  const config = await resolveUcatAiConfig(params.client, params.modelProfileId)
  await assertBudget(params.client, config.settings)

  const timeoutMs = params.timeoutMs ?? 120000
  const maxCompletionTokens = params.maxCompletionTokens ?? config.modelProfile.max_completion_tokens

  let content: string | null | undefined
  let finishReason: string | null = null
  let usage: UcatAiUsage = null

  if (config.provider.provider_kind === 'codex_oauth') {
    const codexContentParts: CodexOAuthUserContentPart[] | undefined = params.userContentParts?.map((part) => (
      part.type === 'text'
        ? { type: 'input_text', text: part.text }
        : { type: 'input_image', image_url: part.imageUrl, detail: part.detail }
    ))
    const result = await callCodexOAuthJson({
      providerId: config.provider.id,
      baseUrl: config.provider.base_url,
      model: config.modelProfile.model,
      systemPrompt: params.systemPrompt,
      userPrompt: params.userPrompt,
      userContentParts: codexContentParts,
      timeoutMs,
      signal: params.signal,
    })
    content = result.content
    usage = result.usage
    finishReason = result.finishReason
  } else {
    const apiKey = process.env[config.provider.secret_env_var_name]
    if (!apiKey) {
      throw new Error(`${config.provider.secret_env_var_name} is not configured`)
    }

    const controller = new AbortController()
    let timedOut = false
    const abortFromCaller = () => controller.abort(params.signal?.reason)
    if (params.signal?.aborted) abortFromCaller()
    else params.signal?.addEventListener('abort', abortFromCaller, { once: true })
    const timeout = setTimeout(() => {
      timedOut = true
      controller.abort()
    }, timeoutMs)
    let response: Response
    try {
      response = await fetch(`${config.provider.base_url.replace(/\/$/u, '')}/chat/completions`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          ...parseHeaders(config.provider.default_headers),
        },
        body: JSON.stringify({
          model: config.modelProfile.model,
          temperature: params.temperature ?? Number(config.modelProfile.temperature),
          response_format: { type: 'json_object' },
          max_completion_tokens: maxCompletionTokens,
          provider: params.providerSort ? { sort: params.providerSort } : undefined,
          reasoning: params.reasoningEffort
            ? { effort: params.reasoningEffort, exclude: true }
            : undefined,
          messages: [
            { role: 'system', content: params.systemPrompt },
            {
              role: 'user',
              content: params.userContentParts
                ? params.userContentParts.map((part) => (
                    part.type === 'text'
                      ? { type: 'text', text: part.text }
                      : { type: 'image_url', image_url: { url: part.imageUrl, detail: part.detail } }
                  ))
                : params.userPrompt,
            },
          ],
        }),
      })
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        if (!timedOut && params.signal?.aborted) throw error
        throw new Error(`UCAT AI ${params.operation} timed out after ${Math.round(timeoutMs / 1000)}s`)
      }
      throw error
    } finally {
      clearTimeout(timeout)
      params.signal?.removeEventListener('abort', abortFromCaller)
    }

    if (!response.ok) {
      throw new Error(`UCAT AI ${params.operation} failed: ${await response.text()}`)
    }

    const json = (await response.json()) as {
      choices?: Array<{ message?: { content?: string | null }; finish_reason?: string | null }>
      usage?: UcatAiUsage
    }
    content = json.choices?.[0]?.message?.content
    usage = json.usage ?? null
    finishReason = json.choices?.[0]?.finish_reason ?? null
  }

  if (!content) {
    throw new UcatAiEmptyResponseError({
      operation: params.operation,
      model: config.modelProfile.model,
      providerId: config.provider.id,
      modelProfileId: config.modelProfile.id,
      usage,
      finishReason,
      maxCompletionTokens,
    })
  }

  await recordUsage({
    client: params.client,
    config,
    operation: params.operation,
    model: config.modelProfile.model,
    usage,
    metadata: params.metadata ?? null,
  })

  let parsed: unknown
  try {
    parsed = parseUcatAiJsonContent(content)
  } catch {
    throw new UcatAiJsonParseError({
      operation: params.operation,
      content,
      model: config.modelProfile.model,
      providerId: config.provider.id,
      modelProfileId: config.modelProfile.id,
      usage,
      finishReason,
      maxCompletionTokens,
    })
  }

  return {
    content,
    parsed,
    model: config.modelProfile.model,
    providerId: config.provider.id,
    modelProfileId: config.modelProfile.id,
    usage,
    finishReason,
    maxCompletionTokens,
  }
}
