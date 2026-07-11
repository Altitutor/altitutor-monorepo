import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Json } from '@altitutor/shared'
import { getServerSupabaseAdmin } from '@/shared/lib/supabase/server'

export type CodexOAuthUsage = {
  prompt_tokens?: number
  completion_tokens?: number
  total_tokens?: number
} | null

type SupabaseAny = SupabaseClient<Database> & {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from: (table: string) => any
}

type EncryptedSecret = {
  v: 1
  alg: 'aes-256-gcm'
  iv: string
  tag: string
  ciphertext: string
}

type OAuthAccountRow = {
  id: string
  provider_id: string
  account_id: string
  access_token_ciphertext: EncryptedSecret
  refresh_token_ciphertext: EncryptedSecret | null
  id_token_ciphertext: EncryptedSecret | null
  expires_at: string | null
  status: 'connected' | 'refresh_failed' | 'revoked'
}

type CodexTokens = {
  accessToken: string
  refreshToken?: string | null
  idToken?: string | null
  expiresAt?: number | null
  accountId: string
}

export type CodexOAuthJsonResponse = {
  content: string
  usage: CodexOAuthUsage
  finishReason: string | null
}

export type CodexOAuthUserContentPart =
  | { type: 'input_text'; text: string }
  | { type: 'input_image'; image_url: string; detail?: 'low' | 'high' | 'auto' }

const DEFAULT_CLIENT_ID = 'app_EMoamEEZ73f0CkXaXp7hrann'
const DEFAULT_ISSUER = 'https://auth.openai.com'
const DEFAULT_CODEX_BASE_URL = 'https://chatgpt.com/backend-api/codex'
const REFRESH_MARGIN_MS = 5 * 60 * 1000

function asAny(client: SupabaseClient<Database>): SupabaseAny {
  return client as SupabaseAny
}

function encryptionKey(): Buffer {
  const raw = process.env.UCAT_CODEX_OAUTH_ENCRYPTION_KEY
  if (!raw) {
    throw new Error('UCAT_CODEX_OAUTH_ENCRYPTION_KEY is not configured')
  }

  const maybeBase64 = Buffer.from(raw, 'base64')
  if (maybeBase64.length === 32 && maybeBase64.toString('base64').replace(/=+$/u, '') === raw.replace(/=+$/u, '')) {
    return maybeBase64
  }

  if (Buffer.byteLength(raw, 'utf8') === 32) {
    return Buffer.from(raw, 'utf8')
  }

  return createHash('sha256').update(raw).digest()
}

function encryptSecret(value: string): EncryptedSecret {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv)
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  return {
    v: 1,
    alg: 'aes-256-gcm',
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
    ciphertext: ciphertext.toString('base64'),
  }
}

function decryptSecret(secret: EncryptedSecret | null): string | null {
  if (!secret) return null
  if (secret.v !== 1 || secret.alg !== 'aes-256-gcm') {
    throw new Error('Unsupported Codex OAuth token encryption format')
  }
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(secret.iv, 'base64'))
  decipher.setAuthTag(Buffer.from(secret.tag, 'base64'))
  return Buffer.concat([
    decipher.update(Buffer.from(secret.ciphertext, 'base64')),
    decipher.final(),
  ]).toString('utf8')
}

function decodeBase64Url(value: string): string | null {
  try {
    const base64 = value.replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
    return Buffer.from(padded, 'base64').toString('utf8')
  } catch {
    return null
  }
}

function parseJwtClaims(token?: string | null): Record<string, unknown> | null {
  if (!token) return null
  const [, payload] = token.split('.')
  if (!payload) return null
  const decoded = decodeBase64Url(payload)
  if (!decoded) return null
  try {
    const parsed = JSON.parse(decoded)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null
  } catch {
    return null
  }
}

function deriveAccountId(tokens: Pick<CodexTokens, 'accessToken' | 'idToken' | 'accountId'>): string | null {
  if (tokens.accountId) return tokens.accountId
  for (const token of [tokens.idToken, tokens.accessToken]) {
    const claims = parseJwtClaims(token)
    const auth = claims?.['https://api.openai.com/auth']
    if (auth && typeof auth === 'object' && !Array.isArray(auth)) {
      const accountId = (auth as { chatgpt_account_id?: unknown }).chatgpt_account_id
      if (typeof accountId === 'string' && accountId.trim()) return accountId
    }
  }
  return null
}

async function refreshTokens(tokens: CodexTokens): Promise<CodexTokens | null> {
  if (!tokens.refreshToken) return null
  const response = await fetch(`${DEFAULT_ISSUER}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: tokens.refreshToken,
      client_id: DEFAULT_CLIENT_ID,
      scope: 'openid profile email offline_access',
    }).toString(),
  })
  if (!response.ok) return null

  const payload = (await response.json()) as {
    access_token?: string
    refresh_token?: string
    id_token?: string
    expires_in?: number
  }
  if (!payload.access_token) return null

  const next: CodexTokens = {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token ?? tokens.refreshToken,
    idToken: payload.id_token ?? tokens.idToken,
    expiresAt: Date.now() + (payload.expires_in ?? 3600) * 1000,
    accountId: tokens.accountId,
  }
  next.accountId = deriveAccountId(next) ?? tokens.accountId
  return next
}

async function loadTokensForProvider(providerId: string): Promise<{ account: OAuthAccountRow; tokens: CodexTokens }> {
  const admin = getServerSupabaseAdmin()
  const { data, error } = await asAny(admin)
    .from('ucat_ai_generation_oauth_accounts')
    .select('*')
    .eq('provider_id', providerId)
    .eq('status', 'connected')
    .maybeSingle()

  if (error || !data) {
    throw new Error('Codex OAuth account is not connected for this provider')
  }

  const account = data as unknown as OAuthAccountRow
  const accessToken = decryptSecret(account.access_token_ciphertext)
  if (!accessToken) {
    throw new Error('Codex OAuth access token is missing')
  }

  return {
    account,
    tokens: {
      accessToken,
      refreshToken: decryptSecret(account.refresh_token_ciphertext),
      idToken: decryptSecret(account.id_token_ciphertext),
      expiresAt: account.expires_at ? new Date(account.expires_at).getTime() : null,
      accountId: account.account_id,
    },
  }
}

async function saveRefreshedTokens(account: OAuthAccountRow, tokens: CodexTokens) {
  const admin = getServerSupabaseAdmin()
  await asAny(admin)
    .from('ucat_ai_generation_oauth_accounts')
    .update({
      access_token_ciphertext: encryptSecret(tokens.accessToken) as unknown as Json,
      refresh_token_ciphertext: tokens.refreshToken ? (encryptSecret(tokens.refreshToken) as unknown as Json) : null,
      id_token_ciphertext: tokens.idToken ? (encryptSecret(tokens.idToken) as unknown as Json) : null,
      expires_at: tokens.expiresAt ? new Date(tokens.expiresAt).toISOString() : null,
      account_id: tokens.accountId,
      status: 'connected',
      last_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', account.id)
}

async function markRefreshFailed(account: OAuthAccountRow) {
  const admin = getServerSupabaseAdmin()
  await asAny(admin)
    .from('ucat_ai_generation_oauth_accounts')
    .update({
      status: 'refresh_failed',
      last_error: 'Codex OAuth token refresh failed',
      updated_at: new Date().toISOString(),
    })
    .eq('id', account.id)
}

async function getFreshTokens(providerId: string): Promise<CodexTokens> {
  const { account, tokens } = await loadTokensForProvider(providerId)
  const expiresAt = tokens.expiresAt ?? 0
  if (expiresAt && expiresAt > Date.now() + REFRESH_MARGIN_MS) {
    return tokens
  }

  const refreshed = await refreshTokens(tokens)
  if (!refreshed) {
    if (expiresAt && expiresAt <= Date.now()) {
      await markRefreshFailed(account)
      throw new Error('Codex OAuth access token expired and refresh failed')
    }
    return tokens
  }

  await saveRefreshedTokens(account, refreshed)
  return refreshed
}

function normalizeResponsesUsage(raw: unknown): CodexOAuthUsage {
  if (!raw || typeof raw !== 'object') return null
  const usage = raw as {
    input_tokens?: number
    output_tokens?: number
    total_tokens?: number
    prompt_tokens?: number
    completion_tokens?: number
  }
  const prompt = usage.prompt_tokens ?? usage.input_tokens
  const completion = usage.completion_tokens ?? usage.output_tokens
  const total = usage.total_tokens ?? ((prompt ?? 0) + (completion ?? 0) || undefined)
  return {
    prompt_tokens: prompt,
    completion_tokens: completion,
    total_tokens: total,
  }
}

function extractTextFromCompletedResponse(response: unknown): string {
  if (!response || typeof response !== 'object') return ''
  const output = (response as { output?: unknown }).output
  if (!Array.isArray(output)) return ''
  const parts: string[] = []
  for (const item of output) {
    const content = item && typeof item === 'object' ? (item as { content?: unknown }).content : null
    if (!Array.isArray(content)) continue
    for (const part of content) {
      if (!part || typeof part !== 'object') continue
      const text = (part as { text?: unknown }).text
      if (typeof text === 'string') parts.push(text)
    }
  }
  return parts.join('')
}

async function collectResponsesStream(response: Response): Promise<CodexOAuthJsonResponse> {
  if (!response.body) {
    const json = await response.json()
    return {
      content: extractTextFromCompletedResponse(json),
      usage: normalizeResponsesUsage((json as { usage?: unknown }).usage),
      finishReason: (json as { status?: string }).status ?? null,
    }
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let content = ''
  let usage: CodexOAuthUsage = null
  let finishReason: string | null = null

  function processEvent(rawEvent: string) {
    const dataLines = rawEvent
      .split(/\r?\n/u)
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trim())
      .filter(Boolean)

    for (const dataLine of dataLines) {
      if (dataLine === '[DONE]') continue
      try {
        const event = JSON.parse(dataLine) as {
          type?: string
          delta?: string
          text?: string
          response?: unknown
          usage?: unknown
          error?: { message?: string }
        }

        if (event.type === 'response.output_text.delta' && typeof event.delta === 'string') {
          content += event.delta
        } else if (event.type === 'response.output_text.done' && typeof event.text === 'string' && !content) {
          content = event.text
        } else if (event.type === 'response.completed' && event.response) {
          if (!content) content = extractTextFromCompletedResponse(event.response)
          usage = normalizeResponsesUsage((event.response as { usage?: unknown }).usage)
          finishReason = (event.response as { status?: string }).status ?? 'completed'
        } else if (event.type === 'response.failed') {
          throw new Error(event.error?.message ?? 'Codex response failed')
        } else if (event.usage) {
          usage = normalizeResponsesUsage(event.usage)
        }
      } catch (error) {
        if (error instanceof SyntaxError) continue
        throw error
      }
    }
  }

  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const events = buffer.split(/\r?\n\r?\n/u)
    buffer = events.pop() ?? ''
    for (const event of events) processEvent(event)
  }
  buffer += decoder.decode()
  if (buffer.trim()) processEvent(buffer)
  reader.releaseLock()

  return { content, usage, finishReason }
}

export async function callCodexOAuthJson(params: {
  providerId: string
  baseUrl?: string | null
  model: string
  systemPrompt: string
  userPrompt: string
  userContentParts?: CodexOAuthUserContentPart[]
  timeoutMs: number
}): Promise<CodexOAuthJsonResponse> {
  const tokens = await getFreshTokens(params.providerId)
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), params.timeoutMs)
  try {
    const response = await fetch(`${(params.baseUrl ?? DEFAULT_CODEX_BASE_URL).replace(/\/$/u, '')}/responses`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${tokens.accessToken}`,
        'ChatGPT-Account-Id': tokens.accountId,
        'OpenAI-Beta': 'responses=experimental',
        originator: 'altitutor-ucat-generation',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: params.model,
        instructions: params.systemPrompt,
        store: false,
        stream: true,
        input: [
          {
            role: 'user',
            content: params.userContentParts ?? [{ type: 'input_text', text: params.userPrompt }],
          },
        ],
      }),
    })

    if (!response.ok) {
      throw new Error(`Codex OAuth request failed: ${await response.text()}`)
    }

    return collectResponsesStream(response)
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Codex OAuth request timed out after ${Math.round(params.timeoutMs / 1000)}s`)
    }
    throw error
  } finally {
    clearTimeout(timeout)
  }
}
