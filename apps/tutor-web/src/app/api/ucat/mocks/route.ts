import { NextRequest, NextResponse } from 'next/server'
import { requireUcatTutor, type UcatTutorSupabaseClient } from '@/features/ucat/shared/server/guard'
import { jsonUcatVisibilityErrorResponse, ucatMemberIds } from '@/features/ucat/shared/server/delete-blocked-response'

export async function POST(request: NextRequest) {
  const access = await requireUcatTutor()
  if (!access.ok) return access.response

  try {
    const body = await request.json()
    const client = access.userClient as unknown as UcatTutorSupabaseClient

    const { data, error } = await client.rpc('tutor_ucat_upsert_mock', {
      p_mock_id: null,
      p_name: body.name,
      p_access_scope: body.accessScope ?? 'public',
      p_set_ids: body.setIds ?? [],
      p_instructions_text: body.instructionsText ?? null,
      p_blueprint_id: body.blueprintId ?? null,
    })

    if (error) {
      return jsonUcatVisibilityErrorResponse(client, {
        contentType: 'mock',
        contentId: '00000000-0000-0000-0000-000000000000',
        accessScope: body.accessScope === 'private' ? 'private' : 'public',
        memberIds: ucatMemberIds(body.setIds),
        errorMessage: error.message,
      })
    }
    return NextResponse.json({ id: data })
  } catch (error) {
    return NextResponse.json({ error: 'Invalid request payload', details: String(error) }, { status: 400 })
  }
}
