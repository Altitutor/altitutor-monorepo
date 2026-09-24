import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@altitutor/shared'
import { instrumentSupabaseClient } from '@/lib/sentry/instrument-supabase-client'

type OAuthClaims = {
  aud?: string | string[]
  client_id?: string
  iss?: string
  sub?: string
}

type UcatTutorRpcClient = {
  rpc: (
    name: string,
    args?: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message: string } | null }>
}

function supabaseUrl(): string {
  const value = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!value) throw new Error('NEXT_PUBLIC_SUPABASE_URL is not configured')
  return value.replace(/\/$/u, '')
}

function supabaseAnonKey(): string {
  const value = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!value) throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY is not configured')
  return value
}

function decodeClaims(token: string): OAuthClaims | null {
  const payload = token.split('.')[1]
  if (!payload) return null
  try {
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as OAuthClaims
  } catch {
    return null
  }
}

function hasAuthenticatedAudience(audience: OAuthClaims['aud']): boolean {
  return Array.isArray(audience)
    ? audience.includes('authenticated')
    : audience === 'authenticated'
}

export function createUcatMcpSupabaseClient(token: string): SupabaseClient<Database> {
  return instrumentSupabaseClient(createClient<Database>(supabaseUrl(), supabaseAnonKey(), {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  }))
}

export async function verifyUcatMcpToken(
  _request: Request,
  bearerToken?: string,
): Promise<AuthInfo | undefined> {
  if (!bearerToken) return undefined

  const claims = decodeClaims(bearerToken)
  const expectedIssuer = `${supabaseUrl()}/auth/v1`
  if (
    !claims?.sub
    || !claims.client_id
    || claims.iss !== expectedIssuer
    || !hasAuthenticatedAudience(claims.aud)
  ) {
    return undefined
  }

  const client = createUcatMcpSupabaseClient(bearerToken)
  const [{ data: userResult, error: userError }, tutorResult] = await Promise.all([
    client.auth.getUser(bearerToken),
    (client as unknown as UcatTutorRpcClient).rpc('is_ucat_tutor'),
  ])

  if (
    userError
    || userResult.user?.id !== claims.sub
    || tutorResult.error
    || tutorResult.data !== true
  ) {
    return undefined
  }

  return {
    token: bearerToken,
    clientId: claims.client_id,
    scopes: ['ucat:read', 'ucat:write'],
    extra: {
      userId: claims.sub,
    },
  }
}
