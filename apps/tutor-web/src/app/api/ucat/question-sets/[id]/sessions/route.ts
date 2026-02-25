import { NextRequest, NextResponse } from 'next/server'
import { requireUcatTutor } from '@/features/ucat/shared/server/guard'

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const access = await requireUcatTutor()
  if (!access.ok) return access.response

  try {
    const body = await request.json()
    const userClient = access.userClient

    const { error } = await (userClient as any).rpc('tutor_ucat_assign_set_sessions', {
      p_set_id: params.id,
      p_session_ids: body.sessionIds ?? [],
    })

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ error: 'Invalid request payload', details: String(error) }, { status: 400 })
  }
}
