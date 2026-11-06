import {
  isJwtIssuedInFutureError,
  isUnauthenticatedSessionError,
} from '@altitutor/shared'
import { NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server-ssr'

export type UcatTutorSupabaseClient = {
  rpc: (
    name: string,
    args?: Record<string, unknown>
  ) => Promise<{ data: unknown; error: { message: string } | null }>
}

function verificationFailure() {
  return {
    ok: false as const,
    response: NextResponse.json(
      { error: 'Failed to verify UCAT tutor access' },
      { status: 500 },
    ),
  }
}

export async function requireUcatTutor() {
  const userClient = await createClient()
  const { data: session, error: sessionError } =
    await userClient.auth.getClaims()

  const invalidJwt = sessionError?.code === 'bad_jwt' || sessionError?.code === 'invalid_jwt'
  if (
    sessionError &&
    !isUnauthenticatedSessionError(sessionError) &&
    (!invalidJwt || isJwtIssuedInFutureError(sessionError))
  ) {
    return verificationFailure()
  }

  if (sessionError || !session?.claims.sub) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    }
  }

  const { data, error } = await (
    userClient as unknown as UcatTutorSupabaseClient
  ).rpc('is_ucat_tutor')
  if (error) return verificationFailure()

  if (!data) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: 'Forbidden: UCAT tutor access required' }, { status: 403 }),
    }
  }

  return { ok: true as const, userClient }
}
