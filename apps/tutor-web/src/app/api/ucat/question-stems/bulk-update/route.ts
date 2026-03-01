import { NextRequest, NextResponse } from 'next/server'
import { requireUcatTutor, type UcatTutorSupabaseClient } from '@/features/ucat/shared/server/guard'

export async function PATCH(request: NextRequest) {
  const access = await requireUcatTutor()
  if (!access.ok) return access.response

  try {
    const body = await request.json()
    const stemIds = body.stemIds as string[] | undefined
    const categoryId = body.categoryId as string | null | undefined
    const isPrivate = body.isPrivate as boolean | undefined

    if (!Array.isArray(stemIds) || stemIds.length === 0) {
      return NextResponse.json({ error: 'stemIds must be a non-empty array' }, { status: 400 })
    }

    const client = access.userClient as unknown as UcatTutorSupabaseClient
    const { error } = await client.rpc('tutor_ucat_bulk_update_question_stem_metadata', {
      p_stem_ids: stemIds,
      p_question_stem_category_id: categoryId ?? null,
      p_is_private: isPrivate ?? null,
    })

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ error: 'Invalid request payload', details: String(error) }, { status: 400 })
  }
}
