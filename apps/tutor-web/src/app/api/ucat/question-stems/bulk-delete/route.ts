import { NextRequest, NextResponse } from 'next/server'
import { requireUcatTutor, type UcatTutorSupabaseClient } from '@/features/ucat/shared/server/guard'
import { jsonUcatDeleteErrorResponse } from '@/features/ucat/shared/server/delete-blocked-response'

export async function POST(request: NextRequest) {
  const access = await requireUcatTutor()
  if (!access.ok) return access.response

  try {
    const body = await request.json()
    const stemIds = body.stemIds as string[] | undefined

    if (!Array.isArray(stemIds) || stemIds.length === 0) {
      return NextResponse.json({ error: 'stemIds must be a non-empty array' }, { status: 400 })
    }

    const client = access.userClient as unknown as UcatTutorSupabaseClient
    const { error } = await client.rpc('tutor_ucat_bulk_delete_question_stems', {
      p_stem_ids: stemIds,
    })

    if (error) {
      return jsonUcatDeleteErrorResponse(client, {
        contentType: 'stem',
        contentId: stemIds[0],
        errorMessage: error.message,
      })
    }
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ error: 'Invalid request payload', details: String(error) }, { status: 400 })
  }
}
