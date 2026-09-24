import { NextRequest, NextResponse } from 'next/server'
import { requireUcatTutor, type UcatTutorSupabaseClient } from '@/features/ucat/shared/server/guard'
import { jsonUcatVisibilityErrorResponse } from '@/features/ucat/shared/server/delete-blocked-response'

export async function PATCH(request: NextRequest) {
  const access = await requireUcatTutor()
  if (!access.ok) return access.response

  try {
    const body = await request.json()
    const stemIds = body.stemIds as string[] | undefined
    const categoryId = body.categoryId as string | null | undefined
    const accessScope = body.accessScope as 'public' | 'private' | undefined

    if (!Array.isArray(stemIds) || stemIds.length === 0) {
      return NextResponse.json({ error: 'stemIds must be a non-empty array' }, { status: 400 })
    }

    const client = access.userClient as unknown as UcatTutorSupabaseClient
    const { error } = await client.rpc('tutor_ucat_bulk_update_question_stem_metadata', {
      p_stem_ids: stemIds,
      p_question_stem_category_id: categoryId ?? null,
      p_access_scope: accessScope ?? null,
    })

    if (error) {
      return jsonUcatVisibilityErrorResponse(client, {
        contentType: 'stem',
        contentId: stemIds[0],
        accessScope: accessScope === 'private' ? 'private' : 'public',
        errorMessage: error.message,
      })
    }
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ error: 'Invalid request payload', details: String(error) }, { status: 400 })
  }
}
