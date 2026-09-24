import { NextResponse, type NextRequest } from 'next/server'
import { captureApiErrorResponse } from '@/lib/sentry/capture-api-error'
import {
  requireUcatTutor,
  type UcatTutorSupabaseClient,
} from '@/features/ucat/shared/server/guard'
import { parseDuplicateStemSets } from '@/features/ucat/reconciliation/lib/parse-duplicate-stem-sets'

const ROUTE_PATH = '/api/ucat/reconciliation/potential-duplicates'
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu

function positiveInteger(value: string | null, fallback: number, maximum: number): number {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, maximum) : fallback
}

function similarityThreshold(value: string | null): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.min(Math.max(parsed, 0.8), 1) : 0.95
}

type RawDuplicateStemSide = {
  id: string
  setNames?: unknown
  [key: string]: unknown
}

type RawDuplicatePair = {
  id: string
  stemA: RawDuplicateStemSide
  stemB: RawDuplicateStemSide
  [key: string]: unknown
}

type PotentialDuplicatesPayload = {
  items?: RawDuplicatePair[]
  total?: number
  page?: number
  pageSize?: number
  similarityThreshold?: number
}

function normalizeStemSide(
  stem: RawDuplicateStemSide,
  setIdsByStemId: Map<string, unknown>,
) {
  const { setNames, ...rest } = stem
  return {
    ...rest,
    sets: parseDuplicateStemSets(setNames, setIdsByStemId.get(stem.id) ?? []),
  }
}

export async function GET(request: NextRequest) {
  const access = await requireUcatTutor()
  if (!access.ok) return access.response

  const params = request.nextUrl.searchParams
  const rpcClient = access.userClient as unknown as UcatTutorSupabaseClient
  const { data, error } = await rpcClient.rpc('tutor_ucat_list_duplicate_stem_pairs', {
    p_search: params.get('search')?.trim().slice(0, 500) || null,
    p_section_ids: params.getAll('section').filter((id) => UUID_PATTERN.test(id)),
    p_similarity_threshold: similarityThreshold(params.get('similarityThreshold')),
    p_page: positiveInteger(params.get('page'), 1, 100_000),
    p_page_size: positiveInteger(params.get('pageSize'), 20, 100),
  })

  if (error) {
    return captureApiErrorResponse(
      error,
      ROUTE_PATH,
      NextResponse.json({ error: error.message }, { status: 500 }),
    )
  }

  const payload = (data ?? {}) as PotentialDuplicatesPayload
  const items = Array.isArray(payload.items) ? payload.items : []
  const stemIds = [
    ...new Set(
      items.flatMap((pair) => [pair.stemA?.id, pair.stemB?.id]).filter(
        (id): id is string => typeof id === 'string' && id.length > 0,
      ),
    ),
  ]

  const setIdsByStemId = new Map<string, unknown>()
  if (stemIds.length > 0) {
    const { data: catalogRows, error: catalogError } = await access.userClient
      .from('vtutor_ucat_question_catalog')
      .select('id,set_ids')
      .in('id', stemIds)

    if (catalogError) {
      return captureApiErrorResponse(
        catalogError,
        ROUTE_PATH,
        NextResponse.json({ error: catalogError.message }, { status: 500 }),
      )
    }

    for (const row of catalogRows ?? []) {
      const catalogRow = row as { id: string; set_ids: unknown }
      setIdsByStemId.set(catalogRow.id, catalogRow.set_ids)
    }
  }

  return NextResponse.json(
    {
      ...payload,
      items: items.map((pair) => ({
        ...pair,
        stemA: normalizeStemSide(pair.stemA, setIdsByStemId),
        stemB: normalizeStemSide(pair.stemB, setIdsByStemId),
      })),
    },
    { headers: { 'Cache-Control': 'private, no-store' } },
  )
}
