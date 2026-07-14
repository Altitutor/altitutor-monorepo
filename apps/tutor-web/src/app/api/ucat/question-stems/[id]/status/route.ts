import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireUcatTutor, type UcatTutorSupabaseClient } from '@/features/ucat/shared/server/guard'

const StatusBodySchema = z.object({
  status: z.enum(['published', 'in_review', 'draft']),
})

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const access = await requireUcatTutor()
  if (!access.ok) return access.response

  let body: z.infer<typeof StatusBodySchema>
  try {
    body = StatusBodySchema.parse(await request.json())
  } catch (error) {
    return NextResponse.json(
      { error: 'Invalid status payload', details: error instanceof Error ? error.message : undefined },
      { status: 400 }
    )
  }

  const client = access.userClient as unknown as UcatTutorSupabaseClient
  const { error } = await client.rpc('tutor_ucat_set_content_status', {
    p_content_type: 'stem',
    p_content_id: params.id,
    p_status: body.status,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}
