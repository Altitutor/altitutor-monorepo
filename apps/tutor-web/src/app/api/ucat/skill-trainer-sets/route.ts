import { NextRequest, NextResponse } from 'next/server'
import { requireUcatTutor, type UcatTutorSupabaseClient } from '@/features/ucat/shared/server/guard'

export async function POST(request: NextRequest) {
  const access = await requireUcatTutor()
  if (!access.ok) return access.response

  try {
    const body = await request.json()
    const client = access.userClient as unknown as UcatTutorSupabaseClient

    const { data, error } = await client.rpc('tutor_ucat_upsert_skill_trainer_set', {
      p_set_id: body.setId ?? null,
      p_skill_trainer_id: body.skillTrainerId,
      p_name: body.name,
      p_description: body.description ?? null,
      p_is_private: body.isPrivate ?? true,
    })

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ id: data })
  } catch (error) {
    return NextResponse.json({ error: 'Invalid request payload', details: String(error) }, { status: 400 })
  }
}
