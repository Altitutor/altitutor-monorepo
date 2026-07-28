import { NextResponse, type NextRequest } from 'next/server'
import { captureApiErrorResponse } from '@/lib/sentry/capture-api-error'
import {
  requireUcatTutor,
  type UcatTutorSupabaseClient,
} from '@/features/ucat/shared/server/guard'

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu

function positiveInteger(value: string | null, fallback: number, maximum: number): number {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, maximum) : fallback
}

export async function GET(request: NextRequest) {
  const access = await requireUcatTutor()
  if (!access.ok) return access.response

  const params = request.nextUrl.searchParams
  const client = access.userClient as unknown as UcatTutorSupabaseClient
  const { data, error } = await client.rpc('tutor_ucat_list_private_stems_not_in_set', {
    p_search: params.get('search')?.trim().slice(0, 500) || null,
    p_section_ids: params.getAll('section').filter((id) => UUID_PATTERN.test(id)),
    p_page: positiveInteger(params.get('page'), 1, 100_000),
    p_page_size: positiveInteger(params.get('pageSize'), 20, 100),
  })

  if (error) {
    return captureApiErrorResponse(
      error,
      '/api/ucat/reconciliation/private-stems-not-in-set',
      NextResponse.json({ error: error.message }, { status: 500 }),
    )
  }

  return NextResponse.json(data, {
    headers: { 'Cache-Control': 'private, no-store' },
  })
}
