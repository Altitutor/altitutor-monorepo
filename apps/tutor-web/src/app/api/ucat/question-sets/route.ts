import { NextRequest, NextResponse } from 'next/server'
import { requireUcatTutor, type UcatTutorSupabaseClient } from '@/features/ucat/shared/server/guard'
import { jsonUcatVisibilityErrorResponse, ucatMemberIds } from '@/features/ucat/shared/server/delete-blocked-response'

export async function POST(request: NextRequest) {
  const access = await requireUcatTutor()
  if (!access.ok) return access.response

  try {
    const body = await request.json()
    const client = access.userClient as unknown as UcatTutorSupabaseClient

    const { data, error } = await client.rpc('tutor_ucat_upsert_question_set', {
      p_set_id: null,
      p_name: body.name ?? null,
      p_description: body.description ?? {},
      p_time_limit_seconds: body.timeLimitSeconds ?? null,
      p_access_scope: body.accessScope ?? 'public',
      p_stem_ids: body.stemIds ?? [],
    })

    if (error) {
      return jsonUcatVisibilityErrorResponse(client, {
        contentType: 'set',
        contentId: '00000000-0000-0000-0000-000000000000',
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
