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
  const { data, error } = await client.rpc('tutor_ucat_list_exact_duplicate_stems', {
    p_search: params.get('search')?.trim().slice(0, 500) || null,
    p_section_ids: params.getAll('section').filter((id) => UUID_PATTERN.test(id)),
    p_page: positiveInteger(params.get('page'), 1, 100_000),
    p_page_size: positiveInteger(params.get('pageSize'), 20, 100),
  })

  if (error) {
    return captureApiErrorResponse(
      error,
      '/api/ucat/reconciliation/exact-duplicates',
      NextResponse.json({ error: error.message }, { status: 500 }),
    )
  }

  return NextResponse.json(data, {
    headers: { 'Cache-Control': 'private, no-store' },
  })
}

export async function POST(request: NextRequest) {
  const access = await requireUcatTutor()
  if (!access.ok) return access.response

  const body = (await request.json().catch(() => null)) as {
    stemIdA?: unknown
    stemIdB?: unknown
    reason?: unknown
  } | null
  if (
    typeof body?.stemIdA !== 'string'
    || typeof body.stemIdB !== 'string'
    || body.stemIdA === body.stemIdB
    || !UUID_PATTERN.test(body.stemIdA)
    || !UUID_PATTERN.test(body.stemIdB)
  ) {
    return NextResponse.json({ error: 'Two different question stem IDs are required.' }, { status: 400 })
  }

  const client = access.userClient as unknown as UcatTutorSupabaseClient
  const { error } = await client.rpc('tutor_ucat_dismiss_exact_duplicate_pair', {
    p_stem_id_a: body.stemIdA,
    p_stem_id_b: body.stemIdB,
    p_reason: typeof body.reason === 'string' ? body.reason.slice(0, 100) : 'keep_both',
  })

  if (error) {
    return captureApiErrorResponse(
      error,
      '/api/ucat/reconciliation/exact-duplicates',
      NextResponse.json({ error: error.message }, { status: 400 }),
    )
  }

  return NextResponse.json({ ok: true })
}
