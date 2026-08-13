import { NextRequest, NextResponse } from 'next/server'
import { requireUcatTutor, type UcatTutorSupabaseClient } from '@/features/ucat/shared/server/guard'
import { jsonUcatDeleteErrorResponse, jsonUcatVisibilityErrorResponse, ucatMemberIds } from '@/features/ucat/shared/server/delete-blocked-response'

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const access = await requireUcatTutor()
  if (!access.ok) return access.response

  try {
    const body = await request.json()
    const client = access.userClient as unknown as UcatTutorSupabaseClient

    const { data, error } = await client.rpc('tutor_ucat_upsert_question_set', {
      p_set_id: params.id,
      p_name: body.name ?? null,
      p_description: body.description ?? {},
      p_time_limit_seconds: body.timeLimitSeconds ?? null,
      p_access_scope: body.accessScope ?? 'public',
      p_stem_ids: body.stemIds ?? [],
    })

    if (error) {
      return jsonUcatVisibilityErrorResponse(client, {
        contentType: 'set',
        contentId: params.id,
        accessScope: body.accessScope === 'private' ? 'private' : 'public',
        memberIds: ucatMemberIds(body.stemIds),
        errorMessage: error.message,
      })
    }
    return NextResponse.json({ id: data })
  } catch (error) {
    return NextResponse.json({ error: 'Invalid request payload', details: String(error) }, { status: 400 })
  }
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const access = await requireUcatTutor()
  if (!access.ok) return access.response

  const client = access.userClient as unknown as UcatTutorSupabaseClient
  const { error } = await client.rpc('tutor_ucat_delete_question_set', { p_set_id: params.id })

  if (error) {
    return jsonUcatDeleteErrorResponse(client, {
      contentType: 'set',
      contentId: params.id,
      errorMessage: error.message,
    })
  }
  return NextResponse.json({ ok: true })
}
