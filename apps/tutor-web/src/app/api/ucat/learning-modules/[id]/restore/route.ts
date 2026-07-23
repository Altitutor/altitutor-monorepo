import { NextResponse } from 'next/server'
import { requireUcatTutor, type UcatTutorSupabaseClient } from '@/features/ucat/shared/server/guard'

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const access = await requireUcatTutor()
  if (!access.ok) return access.response

  const { id } = await params
  const client = access.userClient as unknown as UcatTutorSupabaseClient
  const { error } = await client.rpc('tutor_ucat_restore_learning_module', {
    p_module_id: id,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
