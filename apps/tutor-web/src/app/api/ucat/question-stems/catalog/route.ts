import { NextResponse, type NextRequest } from 'next/server'
import { captureApiErrorResponse } from '@/lib/sentry/capture-api-error'
import {
  requireUcatTutor,
  type UcatTutorSupabaseClient,
} from '@/features/ucat/shared/server/guard'
import { isValidAuditCatalogFilter } from '@/features/ucat/questions/lib/audit-catalog'
import { UCAT_DURABLE_AI_REVIEW_STATUSES } from '@/features/ucat/questions/lib/ai-assessment/review-status'
import { manualReviewEnvironment } from '@/features/ucat/questions/server/ai-assessment/environment'

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu

const SEARCH_SCOPES = new Set([
  'stem_text',
  'question_text',
  'answer_option_text',
  'tutor_source_note',
])
const SORT_KEYS = new Set([
  'section_name',
  'category_name',
  'question_count',
  'sets',
  'visibility',
  'source',
  'created_at',
  'status',
])
const STATUSES = new Set(['draft', 'in_review', 'published'])
const ACCESS_SCOPES = new Set(['public', 'private'])
const SOURCE_CHANNELS = new Set(['individual', 'bulk_import', 'ai_generation'])
const AI_REVIEW_STATUSES = new Set<string>(UCAT_DURABLE_AI_REVIEW_STATUSES)

function parsePositiveInteger(value: string | null, fallback: number, maximum: number): number {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 1) return fallback
  return Math.min(parsed, maximum)
}

function parseUuidList(searchParams: URLSearchParams, key: string): string[] {
  return [...new Set(searchParams.getAll(key).filter((value) => UUID_PATTERN.test(value)))].slice(0, 200)
}

function parseEnumList(
  searchParams: URLSearchParams,
  key: string,
  allowed: Set<string>,
): string[] {
  return [...new Set(searchParams.getAll(key).filter((value) => allowed.has(value)))]
}

function parseTimestamp(value: string | null): string | null {
  if (!value) return null
  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null
}

function parseNonNegativeInteger(value: string | null): number | null {
  if (value == null || value.trim() === '') return null
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 0) return null
  return parsed
}

export async function GET(request: NextRequest) {
  const access = await requireUcatTutor()
  if (!access.ok) return access.response

  const searchParams = request.nextUrl.searchParams
  const status = searchParams.get('status') ?? 'draft'
  if (!STATUSES.has(status)) {
    return NextResponse.json({ error: 'Invalid question status' }, { status: 400 })
  }

  const createdFrom = parseTimestamp(searchParams.get('createdFrom'))
  const createdTo = parseTimestamp(searchParams.get('createdTo'))
  if (
    searchParams.has('createdFrom') && !createdFrom
    || searchParams.has('createdTo') && !createdTo
    || createdFrom && createdTo && createdFrom > createdTo
  ) {
    return NextResponse.json({ error: 'Invalid created-at range' }, { status: 400 })
  }

  const questionCountMin = parseNonNegativeInteger(searchParams.get('questionCountMin'))
  const questionCountMax = parseNonNegativeInteger(searchParams.get('questionCountMax'))
  if (
    searchParams.has('questionCountMin') && questionCountMin == null
    || searchParams.has('questionCountMax') && questionCountMax == null
    || questionCountMin != null
      && questionCountMax != null
      && questionCountMin > questionCountMax
  ) {
    return NextResponse.json({ error: 'Invalid question-count range' }, { status: 400 })
  }

  const sortBy = searchParams.get('sort')
  const search = searchParams.get('search')?.trim().slice(0, 500) ?? ''
  const requestedScopes = parseEnumList(searchParams, 'scope', SEARCH_SCOPES)
  const searchScopes =
    requestedScopes.length > 0
      ? requestedScopes
      : ['stem_text', 'question_text', 'answer_option_text', 'tutor_source_note']

  const aiReviewEnabled = manualReviewEnvironment().enabled
  const aiReviewStatuses = aiReviewEnabled
    ? parseEnumList(searchParams, 'aiReview', AI_REVIEW_STATUSES)
    : []
  const auditFilters = [...new Set(searchParams.getAll('audit').filter(isValidAuditCatalogFilter))]
  if (searchParams.getAll('audit').some((value) => value && !isValidAuditCatalogFilter(value))) {
    return NextResponse.json({ error: 'Invalid audit filter' }, { status: 400 })
  }
  const practicePoolParam = searchParams.get('practicePool')
  if (practicePoolParam != null && practicePoolParam !== '0' && practicePoolParam !== '1') {
    return NextResponse.json({ error: 'Invalid practice-pool filter' }, { status: 400 })
  }

  const client = access.userClient as unknown as UcatTutorSupabaseClient
  const idsOnly = searchParams.get('idsOnly') === '1'
  const { data, error } = await client.rpc('tutor_ucat_list_question_catalog', {
    p_status: status,
    p_show_deleted: searchParams.get('deleted') === '1',
    p_search: search || null,
    p_search_scopes: searchScopes,
    p_stem_ids: parseUuidList(searchParams, 'id'),
    p_section_ids: parseUuidList(searchParams, 'section'),
    p_category_ids: parseUuidList(searchParams, 'category'),
    p_include_no_category: searchParams.get('noCategory') === '1',
    p_tag_ids: parseUuidList(searchParams, 'tag'),
    p_access_scopes: parseEnumList(searchParams, 'access', ACCESS_SCOPES),
    p_practice_pool: practicePoolParam == null ? null : practicePoolParam === '1',
    p_set_ids: parseUuidList(searchParams, 'set'),
    p_include_without_set: searchParams.get('withoutSet') === '1',
    p_source_channels: parseEnumList(searchParams, 'source', SOURCE_CHANNELS),
    p_ai_review_statuses: aiReviewStatuses,
    p_audit_filters: auditFilters,
    p_created_by: parseUuidList(searchParams, 'createdBy'),
    p_created_from: createdFrom,
    p_created_to: createdTo,
    p_question_count_min: questionCountMin,
    p_question_count_max: questionCountMax,
    p_sort_by: sortBy && SORT_KEYS.has(sortBy) ? sortBy : null,
    p_sort_direction: searchParams.get('direction') === 'asc' ? 'asc' : 'desc',
    p_page: parsePositiveInteger(searchParams.get('page'), 1, 100_000),
    p_page_size: parsePositiveInteger(searchParams.get('pageSize'), 20, idsOnly ? 50_000 : 100),
    p_ids_only: idsOnly,
  })

  if (error) {
    return captureApiErrorResponse(
      error,
      '/api/ucat/question-stems/catalog',
      NextResponse.json({ error: error.message }, { status: 500 }),
    )
  }

  const payload = data && typeof data === 'object' && !Array.isArray(data)
    ? data as Record<string, unknown>
    : { items: [], total: 0, questionTotal: 0, page: 1, pageSize: 20 }

  if (!aiReviewEnabled && Array.isArray(payload.items)) {
    payload.items = payload.items.map((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return item
      return { ...item, ai_review_status: 'disabled' }
    })
  }

  return NextResponse.json(
    {
      ...payload,
      questionTotal: typeof payload.questionTotal === 'number' ? payload.questionTotal : 0,
      aiReviewEnabled,
    },
    { headers: { 'Cache-Control': 'private, no-store' } },
  )
}
