import { NextRequest, NextResponse } from 'next/server'
import { requireUcatTutor } from '@/features/ucat/shared/server/guard'

export async function POST(request: NextRequest) {
  const access = await requireUcatTutor()
  if (!access.ok) return access.response

  try {
    const body = await request.json()
    const userClient = access.userClient

    const { data, error } = await (userClient as any).rpc('tutor_ucat_upsert_mock', {
      p_mock_id: null,
      p_name: body.name,
      p_is_private: !!body.isPrivate,
      p_set_ids: body.setIds ?? [],
    })

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ id: data })
  } catch (error) {
    return NextResponse.json({ error: 'Invalid request payload', details: String(error) }, { status: 400 })
  }
}
