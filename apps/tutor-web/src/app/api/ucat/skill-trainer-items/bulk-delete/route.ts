import { NextRequest, NextResponse } from 'next/server'
import { requireUcatTutor, type UcatTutorSupabaseClient } from '@/features/ucat/shared/server/guard'

export async function POST(request: NextRequest) {
  const access = await requireUcatTutor()
  if (!access.ok) return access.response

  try {
    const body = await request.json()
    const itemIds = body.itemIds as string[] | undefined

    if (!Array.isArray(itemIds) || itemIds.length === 0) {
      return NextResponse.json({ error: 'itemIds must be a non-empty array' }, { status: 400 })
    }

    const client = access.userClient as unknown as UcatTutorSupabaseClient
    const results = await Promise.all(
      itemIds.map((itemId) =>
        client.rpc('tutor_ucat_soft_delete_skill_trainer_item', {
          p_item_id: itemId,
        })
      )
    )

    const failed = results.find((result) => result.error)
    if (failed?.error) {
      return NextResponse.json({ error: failed.error.message }, { status: 400 })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ error: 'Invalid request payload', details: String(error) }, { status: 400 })
  }
}
