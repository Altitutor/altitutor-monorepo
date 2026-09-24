import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireUcatTutor, type UcatTutorSupabaseClient } from '@/features/ucat/shared/server/guard'

const BodySchema = z.object({
  stemIds: z.array(z.string().uuid()).min(1).max(500),
})

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const access = await requireUcatTutor()
  if (!access.ok) return access.response

  const parsed = BodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid question set membership payload' }, { status: 400 })
  }

  const { id } = await params
  const client = access.userClient as unknown as UcatTutorSupabaseClient
  const { error } = await client.rpc('tutor_ucat_remove_question_set_stems', {
    p_set_id: id,
    p_stem_ids: parsed.data.stemIds,
  })

  if (error) {
    if (error.message.includes('question_set_not_found')) {
      return NextResponse.json({ error: 'This set no longer exists.' }, { status: 404 })
    }
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}
