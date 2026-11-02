import { NextResponse } from 'next/server'
import type { Json, QuickFilter, QuickFilterConfig } from '@altitutor/shared'
import { assertTutorViewWrite, tutorCanReadSavedView } from '@altitutor/shared'
import { createClient } from '@/shared/lib/supabase/server-ssr'
import { getServiceRoleClient } from '@/shared/lib/supabase/service-role'

const VIEW_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isSavedViewId(id: string): boolean {
  return VIEW_ID.test(id)
}

type ExistingView = { target_entity: string; user_id: string | null }

export async function requireTutorActor() {
  const userClient = await createClient()
  const [{ data: userData, error: userError }, { data: isTutor, error: tutorError }] = await Promise.all([
    userClient.auth.getUser(),
    userClient.rpc('is_tutor'),
  ])
  if (userError || tutorError || !userData.user || !isTutor) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 403 }) }
  }
  return { userId: userData.user.id, service: getServiceRoleClient() }
}

export function readViewWriteBody(body: unknown): {
  name: string
  target_entity: string
  user_id: string | null
  config: QuickFilterConfig
} | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null
  const record = body as Record<string, unknown>
  if (typeof record.name !== 'string' || typeof record.target_entity !== 'string') return null
  if (record.user_id !== null && typeof record.user_id !== 'string') return null
  if (!record.config || typeof record.config !== 'object' || Array.isArray(record.config)) return null
  return {
    name: record.name,
    target_entity: record.target_entity,
    user_id: record.user_id,
    config: record.config as QuickFilterConfig,
  }
}

export function viewWriteDecision(
  actorId: string,
  existing: ExistingView | null,
  next: NonNullable<ReturnType<typeof readViewWriteBody>>,
) {
  return assertTutorViewWrite({ actorId, existing, next })
}

export function canChangeView(actorId: string, existing: ExistingView | null): existing is ExistingView {
  return existing !== null && tutorCanReadSavedView(existing, actorId)
}

export function toQuickFilter(row: {
  id: string
  name: string
  target_entity: string
  user_id: string | null
  config: Json
  created_at: string
  updated_at: string
}): QuickFilter {
  return {
    id: row.id,
    name: row.name,
    target_entity: row.target_entity,
    user_id: row.user_id,
    config: row.config as QuickFilterConfig,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}
