import { NextRequest, NextResponse } from 'next/server'
import { requireUcatTutor, type UcatTutorSupabaseClient } from '@/features/ucat/shared/server/guard'

export async function POST(request: NextRequest) {
  const access = await requireUcatTutor()
  if (!access.ok) return access.response

  try {
    const body = await request.json()
    const client = access.userClient as unknown as UcatTutorSupabaseClient

    const { data, error } = await client.rpc('tutor_ucat_upsert_learning_module', {
      p_module_id: body.moduleId ?? null,
      p_kind: body.kind,
      p_title: body.title,
      p_description: body.description ?? null,
      p_ucat_section_id: body.ucatSectionId ?? null,
      p_parent_id: body.parentId ?? null,
      p_index: body.index ?? 0,
      p_is_private: body.isPrivate ?? true,
      p_display_mode: body.displayMode ?? 'stepped',
    })

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ id: data })
  } catch (error) {
    return NextResponse.json({ error: 'Invalid request payload', details: String(error) }, { status: 400 })
  }
}
