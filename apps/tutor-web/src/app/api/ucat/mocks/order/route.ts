import { NextRequest, NextResponse } from 'next/server'
import { requireUcatTutor, type UcatTutorSupabaseClient } from '@/features/ucat/shared/server/guard'

export async function PATCH(request: NextRequest) {
  const access = await requireUcatTutor()
  if (!access.ok) return access.response

  const body = await request.json().catch(() => null) as { mockIds?: string[] } | null
  if (!Array.isArray(body?.mockIds)) {
    return NextResponse.json({ error: 'Ordered mock ids are required' }, { status: 400 })
  }

  const client = access.userClient as unknown as UcatTutorSupabaseClient
  const { error } = await client.rpc('tutor_ucat_reorder_mocks', { p_mock_ids: body.mockIds })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
