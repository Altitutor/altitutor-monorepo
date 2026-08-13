import { NextRequest, NextResponse } from 'next/server'
import { requireUcatTutor, type UcatTutorSupabaseClient } from '@/features/ucat/shared/server/guard'
import { jsonUcatDeleteErrorResponse } from '@/features/ucat/shared/server/delete-blocked-response'

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const access = await requireUcatTutor()
  if (!access.ok) return access.response

  const client = access.userClient as unknown as UcatTutorSupabaseClient
  const { error } = await client.rpc('tutor_ucat_soft_delete_learning_module', {
    p_module_id: params.id,
  })

  if (error) {
    return jsonUcatDeleteErrorResponse(client, {
      contentType: 'lesson',
      contentId: params.id,
      errorMessage: error.message,
    })
  }
  return NextResponse.json({ ok: true })
}
