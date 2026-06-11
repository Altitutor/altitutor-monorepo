import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireUcatTutor, type UcatTutorSupabaseClient } from '@/features/ucat/shared/server/guard'

const ApprovalBodySchema = z.object({
  approvalStatus: z.enum(['approved', 'pending', 'rejected']),
})

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const access = await requireUcatTutor()
  if (!access.ok) return access.response

  let body: z.infer<typeof ApprovalBodySchema>
  try {
    body = ApprovalBodySchema.parse(await request.json())
  } catch (error) {
    return NextResponse.json(
      { error: 'Invalid approval payload', details: error instanceof Error ? error.message : undefined },
      { status: 400 }
    )
  }

  const client = access.userClient as unknown as UcatTutorSupabaseClient
  const { error } = await client.rpc('tutor_ucat_set_skill_trainer_item_approval', {
    p_item_id: params.id,
    p_approval_status: body.approvalStatus,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}
