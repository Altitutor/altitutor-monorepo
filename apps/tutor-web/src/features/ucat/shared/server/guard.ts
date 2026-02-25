import { NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server-ssr'

export async function requireUcatTutor() {
  const userClient = createClient() as any
  const { data, error } = await userClient.rpc('is_ucat_tutor')

  if (error) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: 'Failed to verify UCAT tutor access' }, { status: 500 }),
    }
  }

  if (!data) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: 'Forbidden: UCAT tutor access required' }, { status: 403 }),
    }
  }

  return { ok: true as const, userClient }
}
