import { z } from 'zod'
import { isValidAuditCatalogFilter } from '@/features/ucat/questions/lib/audit-catalog'
import { UCAT_DURABLE_AI_REVIEW_STATUSES } from '@/features/ucat/questions/lib/ai-assessment/review-status'

type CatalogStatus = 'draft' | 'in_review' | 'published'
type CatalogAccessScope = 'public' | 'private'

export const AUDIT_CATALOG_FILTER_DESCRIPTION =
  'Audit-history tokens: not_audited; {runId}; {runId}:{status}; {runId}:{status}:{result}. Within one clause these are OR-ed unless combined with explicit all/any expressions.'

export const AuditCatalogFiltersSchema = z.array(
  z.string().refine(isValidAuditCatalogFilter, 'Invalid audit catalog filter'),
).max(50).optional().describe(AUDIT_CATALOG_FILTER_DESCRIPTION)

export const QuestionCatalogSearchScopesSchema = z.array(
  z.enum(['stem_text', 'question_text', 'answer_option_text', 'tutor_source_note']),
).optional().describe(
  'Text-search scopes. Defaults to stem, question, answer-option, and tutor-source-note text.',
)

export const QuestionCatalogSortBySchema = z.enum([
  'section_name',
  'category_name',
  'question_count',
  'sets',
  'visibility',
  'source',
  'created_at',
  'status',
]).optional()

export const CatalogFilterClauseSchema = z.object({
  statuses: z.array(z.enum(['draft', 'in_review', 'published'])).max(3).optional().describe(
    'Match any listed lifecycle status. Omit to include every status.',
  ),
  auditFilters: AuditCatalogFiltersSchema,
  stemIds: z.array(z.string().uuid()).max(200).optional(),
  sectionIds: z.array(z.string().uuid()).max(200).optional(),
  categoryIds: z.array(z.string().uuid()).max(200).optional(),
  includeNoCategory: z.boolean().optional(),
  tagIds: z.array(z.string().uuid()).max(200).optional(),
  accessScopes: z.array(z.enum(['public', 'private'])).max(2).optional(),
  practicePool: z.boolean().optional(),
  setIds: z.array(z.string().uuid()).max(200).optional(),
  includeWithoutSet: z.boolean().optional(),
  sourceChannels: z.array(z.enum(['individual', 'bulk_import', 'ai_generation'])).max(3).optional(),
  aiReviewStatuses: z.array(z.enum(UCAT_DURABLE_AI_REVIEW_STATUSES)).max(20).optional(),
  createdBy: z.array(z.string().uuid()).max(200).optional(),
  createdFrom: z.string().datetime({ offset: true }).optional(),
  createdTo: z.string().datetime({ offset: true }).optional(),
  questionCountMin: z.number().int().min(0).optional(),
  questionCountMax: z.number().int().min(0).optional(),
}).describe(
  'Atomic stem predicate. Every populated field in one clause is AND-ed; values inside an array field are OR-ed.',
)

export type CatalogFilterClause = z.infer<typeof CatalogFilterClauseSchema>

export type CatalogFilterExpression =
  | { all: CatalogFilterExpression[] }
  | { any: CatalogFilterExpression[] }
  | { clause: CatalogFilterClause }

export const CatalogFilterExpressionSchema: z.ZodType<CatalogFilterExpression> = z.lazy(() => z.union([
  z.object({
    all: z.array(CatalogFilterExpressionSchema).min(1).max(25),
  }).describe('Stem must satisfy every child expression.'),
  z.object({
    any: z.array(CatalogFilterExpressionSchema).min(1).max(25),
  }).describe('Stem must satisfy at least one child expression.'),
  z.object({
    clause: CatalogFilterClauseSchema,
  }),
])) as z.ZodType<CatalogFilterExpression>

const QuestionCatalogFilterFieldsSchema = CatalogFilterClauseSchema.extend({
  filter: CatalogFilterExpressionSchema.optional().describe(
    'Composable filter tree using all/any/clause. Flat fields, when also present, are AND-ed with this expression.',
  ),
  searchScopes: QuestionCatalogSearchScopesSchema,
  sortBy: QuestionCatalogSortBySchema,
  sortDirection: z.enum(['asc', 'desc']).optional(),
})

export type QuestionCatalogFilterFields = z.infer<typeof QuestionCatalogFilterFieldsSchema>

export const StemCatalogFilterSelectorSchema = QuestionCatalogFilterFieldsSchema.extend({
  kind: z.literal('filter'),
  contentType: z.literal('stem'),
  status: z.enum(['draft', 'in_review', 'published']).optional().describe(
    'Single-status alias for statuses: [status].',
  ),
  accessScope: z.enum(['public', 'private']).optional().describe(
    'Single-scope alias for accessScopes: [accessScope].',
  ),
  sectionId: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional(),
  query: z.string().trim().max(500).optional(),
}).describe(
  'Server-side stem selection. status/statuses are optional; omit both to include every lifecycle. Use filter for explicit AND/OR trees.',
)

export type StemCatalogFilterSelector = z.infer<typeof StemCatalogFilterSelectorSchema>

export type McpStemSearchRpcArgs = {
  p_payload: Record<string, unknown>
  p_show_deleted: boolean
  p_search: string | null
  p_search_scopes: string[]
  p_sort_by: string | null
  p_sort_direction: 'asc' | 'desc'
  p_page: number
  p_page_size: number
  p_ids_only: boolean
}

type CatalogFilterSource = QuestionCatalogFilterFields & {
  status?: CatalogStatus
  statuses?: CatalogStatus[]
  accessScope?: CatalogAccessScope
  sectionId?: string
  categoryId?: string
  query?: string
  includeDeleted?: boolean
}

const DEFAULT_SEARCH_SCOPES = [
  'stem_text',
  'question_text',
  'answer_option_text',
  'tutor_source_note',
] as const

const CLAUSE_KEYS = [
  'statuses',
  'auditFilters',
  'stemIds',
  'sectionIds',
  'categoryIds',
  'includeNoCategory',
  'tagIds',
  'accessScopes',
  'practicePool',
  'setIds',
  'includeWithoutSet',
  'sourceChannels',
  'aiReviewStatuses',
  'createdBy',
  'createdFrom',
  'createdTo',
  'questionCountMin',
  'questionCountMax',
] as const satisfies ReadonlyArray<keyof CatalogFilterClause>

function uniqueIds(values: Array<string | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))]
}

function isNonEmptyClause(clause: CatalogFilterClause): boolean {
  return CLAUSE_KEYS.some((key) => {
    const value = clause[key]
    if (value == null) return false
    if (Array.isArray(value)) return value.length > 0
    if (typeof value === 'boolean') return value
    return true
  })
}

function buildFlatClause(input: CatalogFilterSource): CatalogFilterClause | null {
  const statuses = uniqueIds([
    ...(input.statuses ?? []),
    input.status,
  ]) as CatalogStatus[]
  const sectionIds = uniqueIds([
    ...(input.sectionIds ?? []),
    input.sectionId,
  ])
  const categoryIds = uniqueIds([
    ...(input.categoryIds ?? []),
    input.categoryId,
  ])
  const accessScopes = uniqueIds([
    ...(input.accessScopes ?? []),
    input.accessScope,
  ]) as CatalogAccessScope[]

  const clause: CatalogFilterClause = {
    ...(statuses.length > 0 ? { statuses } : {}),
    ...(input.auditFilters?.length ? { auditFilters: [...input.auditFilters] } : {}),
    ...(input.stemIds?.length ? { stemIds: [...input.stemIds] } : {}),
    ...(sectionIds.length > 0 ? { sectionIds } : {}),
    ...(categoryIds.length > 0 ? { categoryIds } : {}),
    ...(input.includeNoCategory ? { includeNoCategory: true } : {}),
    ...(input.tagIds?.length ? { tagIds: [...input.tagIds] } : {}),
    ...(accessScopes.length > 0 ? { accessScopes } : {}),
    ...(input.practicePool != null ? { practicePool: input.practicePool } : {}),
    ...(input.setIds?.length ? { setIds: [...input.setIds] } : {}),
    ...(input.includeWithoutSet ? { includeWithoutSet: true } : {}),
    ...(input.sourceChannels?.length ? { sourceChannels: [...input.sourceChannels] } : {}),
    ...(input.aiReviewStatuses?.length ? { aiReviewStatuses: [...input.aiReviewStatuses] } : {}),
    ...(input.createdBy?.length ? { createdBy: [...input.createdBy] } : {}),
    ...(input.createdFrom ? { createdFrom: input.createdFrom } : {}),
    ...(input.createdTo ? { createdTo: input.createdTo } : {}),
    ...(input.questionCountMin != null ? { questionCountMin: input.questionCountMin } : {}),
    ...(input.questionCountMax != null ? { questionCountMax: input.questionCountMax } : {}),
  }

  return isNonEmptyClause(clause) ? clause : null
}

export function compileStemCatalogFilter(
  input: CatalogFilterSource,
): CatalogFilterExpression | null {
  const parts: CatalogFilterExpression[] = []
  if (input.filter) parts.push(input.filter)
  const flatClause = buildFlatClause(input)
  if (flatClause) parts.push({ clause: flatClause })

  if (parts.length === 0) return null
  if (parts.length === 1) return parts[0]
  return { all: parts }
}

export function hasQuestionCatalogFilters(input: QuestionCatalogFilterFields): boolean {
  return compileStemCatalogFilter(input) != null
    || Boolean(input.sortBy || input.sortDirection || input.searchScopes?.length)
}

export function buildMcpStemSearchRpcArgs(
  input: CatalogFilterSource,
  pagination: { page: number; pageSize: number; idsOnly?: boolean },
): McpStemSearchRpcArgs {
  const filter = compileStemCatalogFilter(input)
  return {
    p_payload: filter ? { filter } : {},
    p_show_deleted: input.includeDeleted ?? false,
    p_search: input.query?.trim() ? input.query.trim() : null,
    p_search_scopes: input.searchScopes?.length
      ? [...input.searchScopes]
      : [...DEFAULT_SEARCH_SCOPES],
    p_sort_by: input.sortBy ?? null,
    p_sort_direction: input.sortDirection ?? 'desc',
    p_page: pagination.page,
    p_page_size: pagination.pageSize,
    p_ids_only: pagination.idsOnly ?? false,
  }
}

export function buildAuditSelectorPayload(
  selector: StemCatalogFilterSelector,
): Record<string, unknown> {
  const filter = compileStemCatalogFilter(selector)
  const { kind, contentType, query, ...rest } = selector
  void kind
  void contentType
  void query
  return {
    ...rest,
    ...(query ? { query } : {}),
    ...(filter ? { filter } : {}),
  }
}

export function parseQuestionCatalogFilterFields(
  value: unknown,
): QuestionCatalogFilterFields {
  return QuestionCatalogFilterFieldsSchema.parse(value)
}
