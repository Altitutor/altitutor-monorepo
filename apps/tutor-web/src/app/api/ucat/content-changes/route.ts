import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireUcatTutor } from '@/features/ucat/shared/server/guard'
import { getUcatMcpContentChanges } from '@/features/ucat/mcp/server/workflow-service'
import type { Database } from '@altitutor/shared'
import type { SupabaseClient } from '@supabase/supabase-js'

const ContentTypeSchema = z.enum(['learning_module', 'stem', 'set', 'mock'])
const StatusSchema = z.enum(['pending', 'applied', 'rejected', 'stale'])
const ReviewSchema = z.object({
  action: z.enum(['apply', 'reject']),
  changeIds: z.array(z.string().uuid()).min(1).max(50),
  reason: z.string().trim().max(4000).nullable().optional(),
})

export async function GET(request: NextRequest) {
  const access = await requireUcatTutor()
  if (!access.ok) return access.response

  const url = new URL(request.url)
  const parsedStatus = StatusSchema.safeParse(url.searchParams.get('status') ?? 'pending')
  const parsedContentType = ContentTypeSchema.safeParse(url.searchParams.get('contentType'))
  const offset = Math.max(0, Number.parseInt(url.searchParams.get('offset') ?? '0', 10) || 0)
  const limit = Math.min(200, Math.max(1, Number.parseInt(url.searchParams.get('limit') ?? '100', 10) || 100))

  try {
    const result = await getUcatMcpContentChanges(
      access.userClient as unknown as SupabaseClient<Database>,
      {
        status: parsedStatus.success ? parsedStatus.data : 'pending',
        contentType: parsedContentType.success ? parsedContentType.data : undefined,
        offset,
        limit,
      },
    )
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Could not load UCAT content changes.' },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  const access = await requireUcatTutor()
  if (!access.ok) return access.response

  const parsed = ReviewSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid content change review request.' }, { status: 400 })
  }

  const results = []
  for (const changeId of parsed.data.changeIds) {
    const result = await access.userClient.rpc('tutor_ucat_review_content_change', {
      p_change_id: changeId,
      p_decision: parsed.data.action,
      p_reason: parsed.data.reason ?? undefined,
    })
    results.push(result.error
      ? { changeId, status: 'failed', error: result.error.message }
      : { changeId, status: 'succeeded', result: result.data })
  }

  return NextResponse.json({
    results,
    succeededCount: results.filter((result) => result.status === 'succeeded').length,
    failedCount: results.filter((result) => result.status === 'failed').length,
  })
}
