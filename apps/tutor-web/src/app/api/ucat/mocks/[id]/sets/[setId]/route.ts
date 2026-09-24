import { NextRequest, NextResponse } from 'next/server'
import { requireUcatTutor, type UcatTutorSupabaseClient } from '@/features/ucat/shared/server/guard'

export async function DELETE(
  _: NextRequest,
  { params }: { params: Promise<{ id: string; setId: string }> },
) {
  const access = await requireUcatTutor()
  if (!access.ok) return access.response

  const { id, setId } = await params
  const client = access.userClient
  const { data: linkedSet, error: lookupError } = await client
    .from('vtutor_ucat_question_sets')
    .select('id')
    .eq('id', setId)
    .eq('mock_id', id)
    .maybeSingle()
  if (lookupError) return NextResponse.json({ error: lookupError.message }, { status: 400 })
  if (!linkedSet) return NextResponse.json({ error: 'Mock set not found' }, { status: 404 })
  const { error } = await (client as unknown as UcatTutorSupabaseClient)
    .rpc('tutor_ucat_detach_mock_set', { p_set_id: setId })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
