import { NextRequest, NextResponse } from 'next/server'
import { requireUcatTutor, type UcatTutorSupabaseClient } from '@/features/ucat/shared/server/guard'
import { jsonUcatDeleteErrorResponse } from '@/features/ucat/shared/server/delete-blocked-response'

export async function POST(request: NextRequest) {
  const access = await requireUcatTutor()
  if (!access.ok) return access.response

  try {
    const body = await request.json()
    const mockIds = body.mockIds as string[] | undefined

    if (!Array.isArray(mockIds) || mockIds.length === 0) {
      return NextResponse.json({ error: 'mockIds must be a non-empty array' }, { status: 400 })
    }

    const client = access.userClient as unknown as UcatTutorSupabaseClient
    const { error } = await client.rpc('tutor_ucat_bulk_delete_mocks', {
      p_mock_ids: mockIds,
    })

    if (error) {
      return jsonUcatDeleteErrorResponse(client, {
        contentType: 'mock',
        contentId: mockIds[0],
        errorMessage: error.message,
      })
    }
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ error: 'Invalid request payload', details: String(error) }, { status: 400 })
  }
}
