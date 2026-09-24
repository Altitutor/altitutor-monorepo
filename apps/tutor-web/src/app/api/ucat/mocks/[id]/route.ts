import { NextRequest, NextResponse } from 'next/server'
import { requireUcatTutor, type UcatTutorSupabaseClient } from '@/features/ucat/shared/server/guard'
import { jsonUcatDeleteErrorResponse, jsonUcatVisibilityErrorResponse } from '@/features/ucat/shared/server/delete-blocked-response'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const access = await requireUcatTutor()
  if (!access.ok) return access.response

  try {
    const body = await request.json()
    const { id } = await params
    const client = access.userClient as unknown as UcatTutorSupabaseClient

    const { data, error } = await client.rpc('tutor_ucat_upsert_mock_v2', {
      p_mock_id: id,
      p_authoring_note: body.authoringNote ?? null,
      p_access_scope: body.accessScope ?? 'public',
      p_instructions_text: body.instructionsText ?? null,
      p_blueprint_id: body.blueprintId,
    })

    if (error) {
      return jsonUcatVisibilityErrorResponse(client, {
        contentType: 'mock',
        contentId: id,
        accessScope: body.accessScope === 'private' ? 'private' : 'public',
        memberIds: [],
        errorMessage: error.message,
      })
    }
    return NextResponse.json({ id: data })
  } catch (error) {
    return NextResponse.json({ error: 'Invalid request payload', details: String(error) }, { status: 400 })
  }
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const access = await requireUcatTutor()
  if (!access.ok) return access.response

  const client = access.userClient as unknown as UcatTutorSupabaseClient
  const { id } = await params
  const { error } = await client.rpc('tutor_ucat_delete_mock', { p_mock_id: id })

  if (error) {
    return jsonUcatDeleteErrorResponse(client, {
      contentType: 'mock',
      contentId: id,
      errorMessage: error.message,
    })
  }
  return NextResponse.json({ ok: true })
}
