import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireUcatTutor, type UcatTutorSupabaseClient } from '@/features/ucat/shared/server/guard'
import type { UcatLifecycleBlocker } from '@/features/ucat/shared/lifecycle-errors'

const BodySchema = z.object({
  contentType: z.enum(['stem', 'set', 'mock']),
  contentIds: z.array(z.string().uuid()).min(1).max(500),
  status: z.enum(['draft', 'in_review', 'published']),
  previousStatus: z.enum(['draft', 'in_review', 'published']).optional(),
})

const FRIENDLY_FALLBACKS: Record<string, string> = {
  send_content_for_review_before_publishing: 'Send this content for review before publishing it.',
  status_blocked_by_parent_set: 'A parent set must be moved or edited first.',
  status_blocked_by_parent_mock: 'A parent mock must be moved or edited first.',
  status_blocked_by_attachment: 'Remove this content from its session or learning module before moving it out of Published.',
  in_review_set_contains_draft_stem: 'This set contains a draft question that must be sent for review first.',
  in_review_mock_contains_draft_set: 'This mock contains a draft set that must be sent for review first.',
  undo_status_changed: 'The status changed again after this action, so it can no longer be undone.',
}

function failedContentId(message: string, fallbackId: string) {
  return message.match(/bulk_status_item:([0-9a-f-]{36}):/i)?.[1] ?? fallbackId
}

function friendlyMessage(rawMessage: string, blockers: UcatLifecycleBlocker[]) {
  if (blockers[0]?.message) return blockers[0].message
  const match = Object.entries(FRIENDLY_FALLBACKS).find(([code]) => rawMessage.includes(code))
  if (match) return match[1]
  if (rawMessage.includes('publication_blocked')) return 'This content still has publication blockers.'
  return 'The lifecycle change could not be completed.'
}

export async function PATCH(request: NextRequest) {
  const access = await requireUcatTutor()
  if (!access.ok) return access.response

  const parsed = BodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid lifecycle status payload' }, { status: 400 })
  }

  const client = access.userClient as unknown as UcatTutorSupabaseClient
  const { contentType, contentIds, status, previousStatus } = parsed.data
  const { error } = previousStatus
    ? await client.rpc('tutor_ucat_restore_content_status_bulk', {
        p_content_type: contentType,
        p_content_ids: contentIds,
        p_current_status: status,
        p_previous_status: previousStatus,
      })
    : await client.rpc('tutor_ucat_set_content_status_bulk', {
        p_content_type: contentType,
        p_content_ids: contentIds,
        p_status: status,
      })

  if (error) {
    const blockerId = failedContentId(error.message, contentIds[0])
    const { data } = await client.rpc('tutor_ucat_content_status_blockers', {
      p_content_type: contentType,
      p_content_id: blockerId,
      p_status: previousStatus ?? status,
    })
    const blockers = Array.isArray(data) ? (data as UcatLifecycleBlocker[]) : []
    return NextResponse.json(
      { error: friendlyMessage(error.message, blockers), blockers, failedContentId: blockerId },
      { status: 409 },
    )
  }

  return NextResponse.json({ ok: true })
}
