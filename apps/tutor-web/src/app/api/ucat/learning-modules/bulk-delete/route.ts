import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireUcatTutor, type UcatTutorSupabaseClient } from '@/features/ucat/shared/server/guard'

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
    const message = error.message.includes('status_blocked_by_attachment')
      ? 'Remove session-linked lessons from their class sessions before deleting them.'
      : error.message
    return NextResponse.json({ error: message }, { status: 409 })
  }
  return NextResponse.json({ ok: true })
}
