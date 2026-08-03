import type { Database } from '@altitutor/shared'
import type { SupabaseClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireUcatTutor } from '@/features/ucat/shared/server/guard'
import {
  getUcatMcpContentChanges,
  restoreUcatMcpPublishedChange,
} from '@/features/ucat/mcp/server/workflow-service'

const RestoreSchema = z.object({ changeId: z.string().uuid() })

type ChangeItem = {
  id?: unknown
  source?: unknown
  status?: unknown
  reverse_of_change_id?: unknown
  summary?: unknown
  rationale?: unknown
  created_at?: unknown
  resulting_revision?: unknown
}

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const access = await requireUcatTutor()
  if (!access.ok) return access.response
  const client = access.userClient as unknown as SupabaseClient<Database>
  try {
    const result = await getUcatMcpContentChanges(client, {
      contentType: 'stem',
      targetId: params.id,
      limit: 50,
    })
    const items = Array.isArray(result.items) ? result.items as ChangeItem[] : []
    const reversedIds = new Set(items.flatMap((item) => (
      typeof item.reverse_of_change_id === 'string' ? [item.reverse_of_change_id] : []
    )))
    const repairs = items.flatMap((item) => (
      typeof item.id === 'string'
      && item.source === 'assessment'
      && item.status === 'applied'
      && !reversedIds.has(item.id)
        ? [{
            id: item.id,
            summary: typeof item.summary === 'string' ? item.summary : 'Verified AI repair',
            rationale: typeof item.rationale === 'string' ? item.rationale : null,
            createdAt: typeof item.created_at === 'string' ? item.created_at : null,
          }]
        : []
    ))
    return NextResponse.json({ repairs })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Could not load saved AI repairs.' },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const access = await requireUcatTutor()
  if (!access.ok) return access.response
  const parsed = RestoreSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid repair restore request.' }, { status: 400 })
  const client = access.userClient as unknown as SupabaseClient<Database>
  try {
    const changeResult = await getUcatMcpContentChanges(client, {
      changeId: parsed.data.changeId,
      limit: 1,
    })
    const change = Array.isArray(changeResult.items) ? changeResult.items[0] : null
    if (!change
      || typeof change !== 'object'
      || Array.isArray(change)
      || change.target_type !== 'stem'
      || change.target_id !== params.id) {
      return NextResponse.json({ error: 'Saved AI repair not found for this question.' }, { status: 404 })
    }
    const result = await restoreUcatMcpPublishedChange(
      client,
      parsed.data.changeId,
      'Restore the version before a verified AI repair',
      'Tutor requested rollback from the question AI review panel.',
    )
    const restored = typeof result.revision === 'string'
    return NextResponse.json({ restored, result })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not restore the saved AI repair.'
    return NextResponse.json({ error: message }, { status: message.includes('stale') ? 409 : 400 })
  }
}
