import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireUcatTutor, type UcatTutorSupabaseClient } from '@/features/ucat/shared/server/guard'

const StatusBodySchema = z.object({ status: z.enum(['draft', 'in_review', 'published']) })

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const access = await requireUcatTutor()
  if (!access.ok) return access.response
  const parsed = StatusBodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid status payload' }, { status: 400 })

  const client = access.userClient as unknown as UcatTutorSupabaseClient
  const { error } = await client.rpc('tutor_ucat_set_content_status', {
    p_content_type: 'mock',
    p_content_id: params.id,
    p_status: parsed.data.status,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
