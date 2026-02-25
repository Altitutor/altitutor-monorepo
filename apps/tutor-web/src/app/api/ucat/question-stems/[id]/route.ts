import { NextRequest, NextResponse } from 'next/server'
import { requireUcatTutor } from '@/features/ucat/shared/server/guard'

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const access = await requireUcatTutor()
  if (!access.ok) return access.response

  try {
    const body = await request.json()
    const userClient = access.userClient

    const { data, error } = await (userClient as any).rpc('tutor_ucat_upsert_question_stem_bundle', {
      p_stem_id: params.id,
      p_section_id: body.sectionId,
      p_question_stem_category_id: body.categoryId ?? null,
      p_stem_text: body.stemText ?? {},
      p_is_private: !!body.isPrivate,
      p_questions: body.questions ?? [],
    })

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ id: data })
  } catch (error) {
    return NextResponse.json({ error: 'Invalid request payload', details: String(error) }, { status: 400 })
  }
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const access = await requireUcatTutor()
  if (!access.ok) return access.response

  const userClient = access.userClient
  const { error } = await (userClient as any).rpc('tutor_ucat_delete_question_stem', { p_stem_id: params.id })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
