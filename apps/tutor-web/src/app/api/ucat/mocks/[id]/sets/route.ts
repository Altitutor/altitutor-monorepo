import { NextRequest, NextResponse } from 'next/server'
import { requireUcatTutor, type UcatTutorSupabaseClient } from '@/features/ucat/shared/server/guard'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const access = await requireUcatTutor()
  if (!access.ok) return access.response

  const { id } = await params
  const body = await request.json().catch(() => null) as { setId?: string } | null
  if (!body?.setId) return NextResponse.json({ error: 'Set id is required' }, { status: 400 })

  const client = access.userClient as unknown as UcatTutorSupabaseClient
  const { error } = await client.rpc('tutor_ucat_attach_mock_set', {
    p_mock_id: id,
    p_set_id: body.setId,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
