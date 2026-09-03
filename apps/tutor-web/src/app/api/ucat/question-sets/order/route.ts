import { NextRequest, NextResponse } from 'next/server'
import { requireUcatTutor, type UcatTutorSupabaseClient } from '@/features/ucat/shared/server/guard'

export async function PATCH(request: NextRequest) {
  const access = await requireUcatTutor()
  if (!access.ok) return access.response

  const body = await request.json().catch(() => null) as {
    sectionId?: string
    setFormat?: 'full_section' | 'partial_section'
    setIds?: string[]
  } | null
  if (!body?.sectionId || !body.setFormat || !Array.isArray(body.setIds)) {
    return NextResponse.json({ error: 'Section, format, and ordered set ids are required' }, { status: 400 })
  }

  const client = access.userClient as unknown as UcatTutorSupabaseClient
  const { error } = await client.rpc('tutor_ucat_reorder_question_sets', {
    p_section_id: body.sectionId,
    p_set_format: body.setFormat,
    p_set_ids: body.setIds,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
