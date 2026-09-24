import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireUcatTutor, type UcatTutorSupabaseClient } from '@/features/ucat/shared/server/guard'
import { jsonUcatDeleteErrorResponse } from '@/features/ucat/shared/server/delete-blocked-response'

const BodySchema = z.object({
  moduleIds: z.array(z.string().uuid()).min(1).max(500),
})

export async function POST(request: NextRequest) {
  const access = await requireUcatTutor()
  if (!access.ok) return access.response

  const parsed = BodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid bulk delete payload' }, { status: 400 })
  }

  const client = access.userClient as unknown as UcatTutorSupabaseClient
  const { error } = await client.rpc('tutor_ucat_bulk_delete_learning_modules', {
    p_module_ids: parsed.data.moduleIds,
  })
  if (error) {
    return jsonUcatDeleteErrorResponse(client, {
      contentType: 'lesson',
      contentId: parsed.data.moduleIds[0],
      errorMessage: error.message,
    })
  }
  return NextResponse.json({ ok: true })
}
