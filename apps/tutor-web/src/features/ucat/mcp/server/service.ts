import type { Database, Json } from '@altitutor/shared'
import {
  evaluateBlueprint,
  type BlueprintAnswerScheme,
  type BlueprintComposition,
  type BlueprintSectionCode,
  type BlueprintStem,
} from '@altitutor/ucat-blueprint'
import {
  getAnswerSchemePresentation,
  type AnswerScheme,
} from '@altitutor/ucat-response-contract'
import type { SupabaseClient } from '@supabase/supabase-js'
import { proseMirrorToPlainText } from '@/features/ucat/shared/lib/rich-text'
import {
  isUcatVisibilityBlockedError,
  isUcatVisibilityBlockedMessage,
  parseUcatLifecycleBlockers,
  ucatVisibilityBlockedFallbackMessage,
  type UcatVisibilityContentType,
} from '@/features/ucat/shared/lifecycle-errors'
import {
  applyLearningModuleOperations,
  applyMockOperations,
  applyQuestionSetOperations,
  applyQuestionStemOperations,
  blockFromInput,
  learningModuleDraftFromDetail,
  mockDraftFromDetail,
  questionFromInput,
  questionSetDraftFromDetail,
  questionStemDraftFromDetail,
  reindexBlocks,
  reindexQuestions,
  toRichTextJson,
  toStemRpcQuestions,
  type LearningModuleDraft,
  type MockDraft,
  type QuestionSetDraft,
  type QuestionStemDraft,
} from '@/features/ucat/mcp/server/operations'
import type {
  CreateMockInput as CreateMockToolInput,
  CreateQuestionSetInput as CreateQuestionSetToolInput,
  LearningModuleBlockInput,
  LearningModuleOperation,
  MockOperation,
  QuestionInput,
  QuestionSetOperation,
  QuestionStemOperation,
  ValidateMockCompositionInput,
  ValidateQuestionSetCompositionInput,
} from '@/features/ucat/mcp/server/schemas'
import {
  blueprintRowToModel,
  evaluationToStoredCompliance,
  type BlueprintRow,
} from '@/features/ucat/mocks/lib/blueprint-compliance'
import {
  decodeAuthoringRevision,
  encodeAuthoringRevision,
} from '@/features/ucat/mcp/server/revision'
import {
  buildMcpStemSearchRpcArgs,
  type QuestionCatalogFilterFields,
} from '@/features/ucat/mcp/server/catalog-filters'
import { enqueueUcatQuestionAssessmentPreparation } from '@/features/ucat/questions/server/ai-assessment/dispatcher'

export type UcatMcpAggregateType = 'learning_module' | 'stem' | 'set' | 'mock'
export type UcatMcpStatus = 'draft' | 'in_review' | 'published'
export type UcatMcpAccessScope = 'public' | 'private'

type RpcResult = {
  data: unknown
  error: { message: string } | null
}

type UcatMcpRpcClient = {
  rpc: (name: string, args?: Record<string, unknown>) => Promise<RpcResult>
}

type MutationResult = {
  id: string
  status: UcatMcpStatus
  revision: string
}

type SearchInput = QuestionCatalogFilterFields & {
  contentType: UcatMcpAggregateType
  query?: string
  status?: UcatMcpStatus
  statuses?: UcatMcpStatus[]
  accessScope?: UcatMcpAccessScope
  sectionId?: string
  categoryId?: string
  includeDeleted?: boolean
  offset?: number
  limit?: number
  projection?: 'catalogue' | 'composition' | 'full'
}

type CreateQuestionStemInput = {
  sectionId: string
  categoryId?: string | null
  stemText: string | Record<string, unknown>
  accessScope: UcatMcpAccessScope
  tutorSourceNote?: string | null
  questions: QuestionInput[]
}

type CreateQuestionSetInput = Omit<CreateQuestionSetToolInput, 'idempotencyKey'>
type CreateMockInput = Omit<CreateMockToolInput, 'idempotencyKey'>

type CreateLearningModuleInput = {
  kind: 'folder' | 'lesson'
  title: string
  description?: string | null
  sectionId?: string | null
  parentId?: string | null
  index?: number
  accessScope: UcatMcpAccessScope
  iconKey?: string
  estimatedMinutes?: number | null
  studyPlanPriority?: 'essential' | 'recommended' | 'optional' | 'excluded'
  studyPlanCategoryIds?: string[]
  studyPlanTagIds?: string[]
  blocks?: LearningModuleBlockInput[]
}

function rpcClient(client: SupabaseClient<Database>): UcatMcpRpcClient {
  return client as unknown as UcatMcpRpcClient
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

const sectionCodeByNumber: Record<number, BlueprintSectionCode> = {
  1: 'verbal_reasoning',
  2: 'decision_making',
  3: 'quantitative_reasoning',
  4: 'situational_judgement',
}

const blueprintAnswerSchemes = new Set<BlueprintAnswerScheme>([
  'single_choice',
  'situational_judgement_rating',
  'decision_making_binary_placement',
  'situational_judgement_most_least',
])

function isBlueprintAnswerScheme(value: unknown): value is BlueprintAnswerScheme {
  return typeof value === 'string'
    && blueprintAnswerSchemes.has(value as BlueprintAnswerScheme)
}

function arrayOfRecords(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter(isRecord) : []
}

function publicationIssueCodes(value: unknown): string[] {
  return arrayOfRecords(value).flatMap((issue) => (
    typeof issue.code === 'string' ? [issue.code] : []
  ))
}

function blueprintStemFromDetail(row: Record<string, unknown>): BlueprintStem | null {
  if (typeof row.id !== 'string') return null
  const questions = arrayOfRecords(row.questions).flatMap((question) => {
    if (typeof question.id !== 'string' || !isBlueprintAnswerScheme(question.answer_scheme)) {
      return []
    }
    const optionIds = arrayOfRecords(question.answer_options).flatMap((option) => (
      typeof option.id === 'string' ? [option.id] : []
    ))
    const presentation = getAnswerSchemePresentation(
      question.answer_scheme as AnswerScheme['kind'],
      optionIds,
    )
    return [{
      id: question.id,
      answerScheme: question.answer_scheme,
      optionCount: optionIds.length,
      requiredPlacementCount: presentation.kind === 'placement'
        ? presentation.requiredPlacements
        : 0,
    }]
  })
  return {
    id: row.id,
    category: typeof row.category_name === 'string' ? row.category_name : 'Uncategorised',
    categoryId: typeof row.question_stem_category_id === 'string'
      ? row.question_stem_category_id
      : undefined,
    questions,
  }
}

function stemCompositionProjection(
  row: Record<string, unknown>,
  catalog?: Record<string, unknown>,
): Record<string, unknown> {
  const questions = arrayOfRecords(row.questions)
  const issueCodes = publicationIssueCodes(row.publication_issues)
  return {
    contentType: 'stem',
    id: row.id,
    revision: row.revision,
    status: row.status,
    accessScope: row.access_scope,
    sectionId: row.section_id,
    sectionName: row.section_name,
    sectionNumber: row.section_number,
    categoryId: row.question_stem_category_id,
    categoryName: row.category_name,
    questionCount: questions.length,
    questionIds: questions.flatMap((question) => (
      typeof question.id === 'string' ? [question.id] : []
    )),
    responseTypes: [...new Set(questions.flatMap((question) => (
      typeof question.response_type === 'string' ? [question.response_type] : []
    )))],
    answerSchemes: [...new Set(questions.flatMap((question) => (
      typeof question.answer_scheme === 'string' ? [question.answer_scheme] : []
    )))],
    difficultyMean: (() => {
      const values = questions.flatMap((question) => (
        typeof question.difficulty === 'number' ? [question.difficulty] : []
      ))
      return values.length > 0
        ? values.reduce((total, value) => total + value, 0) / values.length
        : null
    })(),
    timeBurdenSecondsTotal: questions.reduce((total, question) => (
      total + (typeof question.time_burden_seconds === 'number'
        ? question.time_burden_seconds
        : 0)
    ), 0),
    publicationReady: issueCodes.length === 0,
    publicationIssueCodes: issueCodes,
    setIds: Array.isArray(catalog?.set_ids) ? catalog.set_ids : [],
    isAvailableInQuestionPool: catalog?.is_available_in_question_pool ?? false,
    contentFingerprint: catalog?.question_bundle_fingerprint ?? null,
    comparisonFingerprint: catalog?.stem_comparison_hash ?? null,
    deletedAt: row.deleted_at,
    updatedAt: row.updated_at,
  }
}

function requireRow(
  data: unknown,
  error: { message: string } | null,
  label: string,
): Record<string, unknown> {
  if (error) throw new Error(error.message)
  if (!isRecord(data)) throw new Error(`${label} not found`)
  return data
}

function updatedAtOf(row: Record<string, unknown>): string {
  if (typeof row.updated_at !== 'string') {
    throw new Error('Aggregate does not expose an authoring revision')
  }
  return row.updated_at
}

function withRevision(row: Record<string, unknown>): Record<string, unknown> {
  const id = typeof row.id === 'string' ? row.id : null
  if (!id) throw new Error('Aggregate id is missing')
  return {
    ...row,
    revision: encodeAuthoringRevision(id, updatedAtOf(row)),
  }
}

function richTextSearchValue(value: unknown): string {
  if (typeof value === 'string') return value
  return proseMirrorToPlainText(value as Json) ?? ''
}

function referencedFileIds(value: unknown, output = new Set<string>()): Set<string> {
  if (Array.isArray(value)) {
    value.forEach((child) => referencedFileIds(child, output))
    return output
  }
  if (!isRecord(value)) return output
  for (const [key, child] of Object.entries(value)) {
    if (
      (key === 'fileId' || key === 'file_id')
      && typeof child === 'string'
      && child
    ) {
      output.add(child)
    } else {
      referencedFileIds(child, output)
    }
  }
  return output
}

async function referencedFiles(
  client: SupabaseClient<Database>,
  aggregate: Record<string, unknown>,
): Promise<unknown[]> {
  const ids = [...referencedFileIds(aggregate)]
  if (ids.length === 0) return []
  const { data, error } = await client
    .from('vtutor_files')
    .select('id,filename,mimetype,size_bytes,bucket,storage_path,external_url,metadata,created_at')
    .in('id', ids)
  if (error) throw new Error(error.message)
  return data ?? []
}

async function getLearningModule(
  client: SupabaseClient<Database>,
  id: string,
): Promise<Record<string, unknown>> {
  const [moduleResult, blocksResult, categoriesResult, tagsResult] = await Promise.all([
    client.from('vtutor_ucat_learning_modules').select('*').eq('id', id).maybeSingle(),
    client
      .from('vtutor_ucat_learning_module_blocks')
      .select('*')
      .eq('learning_module_id', id)
      .order('index'),
    client
      .from('vtutor_ucat_learning_module_question_stem_categories')
      .select('question_stem_category_id')
      .eq('learning_module_id', id),
    client
      .from('vtutor_ucat_learning_module_question_tags')
      .select('question_tag_id')
      .eq('learning_module_id', id),
  ])
  const learningModule = requireRow(moduleResult.data, moduleResult.error, 'Learning module')
  if (blocksResult.error) throw new Error(blocksResult.error.message)
  if (categoriesResult.error) throw new Error(categoriesResult.error.message)
  if (tagsResult.error) throw new Error(tagsResult.error.message)

  const aggregate = withRevision({
    ...learningModule,
    study_plan_category_ids: (categoriesResult.data ?? [])
      .map((row) => row.question_stem_category_id)
      .filter((value): value is string => typeof value === 'string'),
    study_plan_tag_ids: (tagsResult.data ?? [])
      .map((row) => row.question_tag_id)
      .filter((value): value is string => typeof value === 'string'),
    blocks: blocksResult.data ?? [],
  })
  return {
    ...aggregate,
    referencedFiles: await referencedFiles(client, aggregate),
  }
}

async function getStem(
  client: SupabaseClient<Database>,
  id: string,
): Promise<Record<string, unknown>> {
  const { data, error } = await client
    .from('vtutor_ucat_question_stem_detail')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  const aggregate = withRevision(requireRow(data, error, 'Question stem'))
  return {
    ...aggregate,
    referencedFiles: await referencedFiles(client, aggregate),
  }
}

async function getSet(
  client: SupabaseClient<Database>,
  id: string,
): Promise<Record<string, unknown>> {
  const { data, error } = await client
    .from('vtutor_ucat_question_set_detail')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  const aggregate = withRevision(requireRow(data, error, 'Question set'))
  return {
    ...aggregate,
    referencedFiles: await referencedFiles(client, aggregate),
  }
}

async function getMock(
  client: SupabaseClient<Database>,
  id: string,
): Promise<Record<string, unknown>> {
  const { data, error } = await client
    .from('vtutor_ucat_mock_detail')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  const aggregate = withRevision(requireRow(data, error, 'Mock exam'))
  return {
    ...aggregate,
    referencedFiles: await referencedFiles(client, aggregate),
  }
}

async function getStemDetails(
  client: SupabaseClient<Database>,
  ids: string[],
): Promise<Record<string, unknown>[]> {
  if (ids.length === 0) return []
  const { data, error } = await client
    .from('vtutor_ucat_question_stem_detail')
    .select('*')
    .in('id', ids)
  if (error) throw new Error(error.message)
  const byId = new Map((data ?? []).flatMap((row) => (
    row.id ? [[row.id, row as unknown as Record<string, unknown>] as const] : []
  )))
  return ids.flatMap((id) => {
    const row = byId.get(id)
    return row ? [row] : []
  })
}

async function getStemCatalogRows(
  client: SupabaseClient<Database>,
  ids: string[],
): Promise<Map<string, Record<string, unknown>>> {
  if (ids.length === 0) return new Map()
  const { data, error } = await client
    .from('vtutor_ucat_question_catalog')
    .select('id,set_ids,is_available_in_question_pool,question_bundle_fingerprint,stem_comparison_hash')
    .in('id', ids)
  if (error) throw new Error(error.message)
  return new Map((data ?? []).flatMap((row) => (
    row.id ? [[row.id, row as unknown as Record<string, unknown>] as const] : []
  )))
}

function setStemIds(row: Record<string, unknown>): string[] {
  return arrayOfRecords(row.stems).flatMap((stem) => (
    typeof stem.stem_id === 'string' ? [stem.stem_id] : []
  ))
}

async function setCompositionProjection(
  client: SupabaseClient<Database>,
  row: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const stemIds = setStemIds(row)
  const [stems, catalogRows] = await Promise.all([
    getStemDetails(client, stemIds),
    getStemCatalogRows(client, stemIds),
  ])
  const issueCodes = publicationIssueCodes(row.publication_issues)
  return {
    contentType: 'set',
    id: row.id,
    revision: row.revision,
    status: row.status,
    accessScope: row.access_scope,
    sectionId: row.section_id,
    sectionName: row.section_name,
    sectionNumber: row.section_number,
    setFormat: row.set_format,
    timingMode: row.timing_mode,
    paceMultiplier: row.pace_multiplier,
    fixedTimeLimitSeconds: row.fixed_time_limit_seconds,
    timeLimitSeconds: row.time_limit_seconds,
    referenceBlueprintId: row.reference_blueprint_id,
    mockId: row.mock_id,
    stemIds,
    stemCount: stemIds.length,
    questionCount: stems.reduce(
      (total, stem) => total + arrayOfRecords(stem.questions).length,
      0,
    ),
    stems: stems.map((stem) => stemCompositionProjection(
      stem,
      typeof stem.id === 'string' ? catalogRows.get(stem.id) : undefined,
    )),
    publicationReady: issueCodes.length === 0,
    publicationIssueCodes: issueCodes,
    deletedAt: row.deleted_at,
    updatedAt: row.updated_at,
  }
}

async function mockCompositionProjection(
  client: SupabaseClient<Database>,
  row: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const sets = arrayOfRecords(row.sets)
  return {
    contentType: 'mock',
    id: row.id,
    revision: row.revision,
    status: row.status,
    accessScope: row.access_scope,
    blueprintId: row.blueprint_id,
    sectionSets: sets.map((set) => ({
      sectionId: set.section_id,
      setId: set.id,
      setFormat: set.set_format,
      referenceBlueprintId: set.reference_blueprint_id,
      timingMode: set.timing_mode,
      paceMultiplier: set.pace_multiplier,
    })),
    setCount: sets.length,
    blueprintCompliance: row.blueprint_compliance,
    publicationReady: publicationIssueCodes(row.publication_issues).length === 0,
    publicationIssueCodes: publicationIssueCodes(row.publication_issues),
    deletedAt: row.deleted_at,
    updatedAt: row.updated_at,
  }
}

export type UcatMcpReadProjection = 'catalogue' | 'composition' | 'full'

export async function getUcatMcpAggregate(
  client: SupabaseClient<Database>,
  contentType: UcatMcpAggregateType,
  id: string,
  projection: UcatMcpReadProjection = 'full',
): Promise<Record<string, unknown>> {
  const aggregate = contentType === 'learning_module'
    ? await getLearningModule(client, id)
    : contentType === 'stem'
      ? await getStem(client, id)
      : contentType === 'set'
        ? await getSet(client, id)
        : await getMock(client, id)
  if (projection === 'full') return aggregate
  if (projection === 'composition' && contentType === 'stem') {
    const catalogRows = await getStemCatalogRows(client, [id])
    return stemCompositionProjection(aggregate, catalogRows.get(id))
  }
  if (projection === 'composition' && contentType === 'set') {
    return setCompositionProjection(client, aggregate)
  }
  if (projection === 'composition' && contentType === 'mock') {
    return mockCompositionProjection(client, aggregate)
  }
  return searchSummary(contentType, aggregate)
}

export type UcatMcpAggregateTarget = {
  contentType: UcatMcpAggregateType
  id: string
}

type UcatMcpAggregateReadResult = UcatMcpAggregateTarget & (
  | { ok: true; content: Record<string, unknown> }
  | { ok: false; error: string }
)

export async function getUcatMcpAggregates(
  client: SupabaseClient<Database>,
  targets: UcatMcpAggregateTarget[],
  projection: UcatMcpReadProjection = 'full',
): Promise<{
  items: UcatMcpAggregateReadResult[]
  requestedCount: number
  successCount: number
  errorCount: number
}> {
  const items: UcatMcpAggregateReadResult[] = new Array(targets.length)
  const concurrency = 4
  for (let offset = 0; offset < targets.length; offset += concurrency) {
    const chunk = targets.slice(offset, offset + concurrency)
    await Promise.all(chunk.map(async (target, chunkIndex) => {
      try {
        items[offset + chunkIndex] = {
          ...target,
          ok: true,
          content: await getUcatMcpAggregate(
            client,
            target.contentType,
            target.id,
            projection,
          ),
        }
      } catch (error) {
        items[offset + chunkIndex] = {
          ...target,
          ok: false,
          error: error instanceof Error ? error.message : 'UCAT content read failed',
        }
      }
    }))
  }
  const successCount = items.filter((item) => item.ok).length
  return {
    items,
    requestedCount: items.length,
    successCount,
    errorCount: items.length - successCount,
  }
}

function matchesQuery(row: Record<string, unknown>, query: string): boolean {
  const needle = query.trim().toLocaleLowerCase()
  if (!needle) return true
  const values = [
    row.title,
    row.name,
    row.description,
    row.stem_text,
    row.section_name,
    row.category_name,
  ]
  return values.some((value) => richTextSearchValue(value).toLocaleLowerCase().includes(needle))
}

function searchSummary(
  contentType: UcatMcpAggregateType,
  row: Record<string, unknown>,
): Record<string, unknown> {
  const id = typeof row.id === 'string' ? row.id : ''
  const updatedAt = updatedAtOf(row)
  return {
    contentType,
    id,
    title: contentType === 'learning_module'
      ? row.title
      : contentType === 'mock'
        ? row.name
        : richTextSearchValue(row.name ?? row.stem_text).slice(0, 240),
    kind: row.kind ?? undefined,
    status: row.status,
    accessScope: row.access_scope,
    sectionId: row.ucat_section_id ?? row.section_id ?? null,
    sectionName: row.section_name ?? null,
    categoryId: row.question_stem_category_id ?? null,
    categoryName: row.category_name ?? null,
    deletedAt: row.deleted_at ?? null,
    updatedAt,
    revision: encodeAuthoringRevision(id, updatedAt),
  }
}

function stemCatalogSearchSummary(row: Record<string, unknown>): Record<string, unknown> {
  const id = typeof row.id === 'string' ? row.id : ''
  const updatedAt = updatedAtOf(row)
  return {
    contentType: 'stem',
    id,
    title: richTextSearchValue(row.stem_text).slice(0, 240),
    status: row.status,
    accessScope: row.access_scope,
    sectionId: row.section_id ?? null,
    sectionName: row.section_name ?? null,
    categoryId: row.question_stem_category_id ?? null,
    categoryName: row.category_name ?? null,
    deletedAt: row.deleted_at ?? null,
    updatedAt,
    revision: encodeAuthoringRevision(id, updatedAt),
    auditMemberships: row.audit_memberships ?? [],
  }
}

async function searchUcatMcpQuestionStemsViaCatalog(
  client: SupabaseClient<Database>,
  input: SearchInput,
): Promise<Record<string, unknown>> {
  const limit = Math.min(input.limit ?? 25, 100)
  const offset = input.offset ?? 0
  const page = Math.floor(offset / limit) + 1
  const rpcArgs = buildMcpStemSearchRpcArgs(input, { page, pageSize: limit })
  const { data, error } = await rpcClient(client).rpc(
    'tutor_ucat_mcp_search_question_stems',
    rpcArgs as Record<string, unknown>,
  )
  if (error) throw new Error(error.message)

  const payload = isRecord(data) ? data : { items: [], total: 0 }
  const items = Array.isArray(payload.items) ? payload.items : []
  const total = typeof payload.total === 'number' ? payload.total : items.length
  const nextOffset = offset + items.length < total ? offset + items.length : null
  const summaries = items
    .filter((item): item is Record<string, unknown> => isRecord(item))
    .map((item) => stemCatalogSearchSummary(item))
  const projectedItems = input.projection && input.projection !== 'catalogue'
    ? await Promise.all(summaries.map((summary) => getUcatMcpAggregate(
        client,
        'stem',
        String(summary.id),
        input.projection,
      )))
    : summaries

  return {
    items: projectedItems,
    nextOffset,
    matchedCount: total,
    truncatedSource: false,
  }
}

export async function searchUcatMcpContent(
  client: SupabaseClient<Database>,
  input: SearchInput,
): Promise<Record<string, unknown>> {
  const fetchLimit = 500
  let rows: Record<string, unknown>[] = []

  if (input.contentType === 'stem') {
    return searchUcatMcpQuestionStemsViaCatalog(client, input)
  }

  if (input.contentType === 'learning_module') {
    let query = client
      .from('vtutor_ucat_learning_modules')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(fetchLimit)
    if (input.status) query = query.eq('status', input.status)
    if (input.accessScope) query = query.eq('access_scope', input.accessScope)
    if (input.sectionId) query = query.eq('ucat_section_id', input.sectionId)
    if (!input.includeDeleted) query = query.is('deleted_at', null)
    const result = await query
    if (result.error) throw new Error(result.error.message)
    rows = (result.data ?? []) as unknown as Record<string, unknown>[]
  } else if (input.contentType === 'set') {
    let query = client
      .from('vtutor_ucat_question_sets')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(fetchLimit)
    if (input.status) query = query.eq('status', input.status)
    if (input.accessScope) query = query.eq('access_scope', input.accessScope)
    if (!input.includeDeleted) query = query.is('deleted_at', null)
    const result = await query
    if (result.error) throw new Error(result.error.message)
    rows = (result.data ?? []) as unknown as Record<string, unknown>[]
  } else {
    let query = client
      .from('vtutor_ucat_mocks')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(fetchLimit)
    if (input.status) query = query.eq('status', input.status)
    if (input.accessScope) query = query.eq('access_scope', input.accessScope)
    if (!input.includeDeleted) query = query.is('deleted_at', null)
    const result = await query
    if (result.error) throw new Error(result.error.message)
    rows = (result.data ?? []) as unknown as Record<string, unknown>[]
  }

  const filtered = input.query
    ? rows.filter((row) => matchesQuery(row, input.query ?? ''))
    : rows
  const offset = input.offset ?? 0
  const limit = Math.min(input.limit ?? 25, 100)
  const page = filtered.slice(offset, offset + limit)
  const nextOffset = offset + page.length < filtered.length ? offset + page.length : null
  const items = input.projection && input.projection !== 'catalogue'
    ? await Promise.all(page.flatMap((row) => (
        typeof row.id === 'string'
          ? [getUcatMcpAggregate(client, input.contentType, row.id, input.projection)]
          : []
      )))
    : page.map((row) => searchSummary(input.contentType, row))
  return {
    items,
    nextOffset,
    matchedCount: filtered.length,
    truncatedSource: rows.length === fetchLimit,
  }
}

export async function getUcatMcpReferenceData(
  client: SupabaseClient<Database>,
): Promise<Record<string, unknown>> {
  const [sections, categories, tags, modelProfiles, skillTrainers, blueprints] = await Promise.all([
    client.from('vtutor_ucat_sections').select('*').order('section_number'),
    client.from('vtutor_ucat_question_stem_categories').select('*').order('name'),
    client.from('vtutor_ucat_question_tags').select('*').order('name'),
    client
      .from('vtutor_ucat_ai_generation_model_profiles')
      .select('id,name,model,is_enabled,is_default,created_at,updated_at')
      .eq('is_enabled', true)
      .order('name'),
    client
      .from('vtutor_ucat_skill_trainers')
      .select(
        'id,key,name,description,ucat_section_id,section_name,section_number,is_enabled,item_count,approved_active_item_count',
      )
      .eq('is_enabled', true)
      .order('sort_order'),
    client
      .from('vtutor_ucat_mock_blueprints')
      .select('*')
      .order('test_year', { ascending: false })
      .order('version', { ascending: false }),
  ])
  for (const result of [sections, categories, tags, modelProfiles, skillTrainers, blueprints]) {
    if (result.error) throw new Error(result.error.message)
  }
  return {
    sections: sections.data ?? [],
    categories: categories.data ?? [],
    tags: tags.data ?? [],
    generationModelProfiles: modelProfiles.data ?? [],
    skillTrainers: skillTrainers.data ?? [],
    blueprints: blueprints.data ?? [],
  }
}

type BlueprintRead = {
  databaseId: string
  code: string
  testYear: number
  version: number
  officialFactsLabel: string
  altitutorPolicyLabel: string
  createdAt: string | null
  sections: Array<Record<string, unknown>>
}

async function blueprintSectionReferences(
  client: SupabaseClient<Database>,
): Promise<Map<number, { sectionId: string; sectionName: string }>> {
  const { data, error } = await client
    .from('vtutor_ucat_sections')
    .select('id,name,section_number')
    .order('section_number')
  if (error) throw new Error(error.message)
  return new Map((data ?? []).flatMap((section) => (
    section.id && section.name && section.section_number != null
      ? [[section.section_number, {
          sectionId: section.id,
          sectionName: section.name,
        }] as const]
      : []
  )))
}

function blueprintReadFromRow(
  row: Record<string, unknown>,
  sectionReferences: Map<number, { sectionId: string; sectionName: string }>,
): BlueprintRead | null {
  if (
    typeof row.id !== 'string'
    || typeof row.code !== 'string'
    || typeof row.test_year !== 'number'
    || typeof row.version !== 'number'
    || typeof row.official_facts_label !== 'string'
    || typeof row.altitutor_policy_label !== 'string'
  ) return null
  return {
    databaseId: row.id,
    code: row.code,
    testYear: row.test_year,
    version: row.version,
    officialFactsLabel: row.official_facts_label,
    altitutorPolicyLabel: row.altitutor_policy_label,
    createdAt: typeof row.created_at === 'string' ? row.created_at : null,
    sections: arrayOfRecords(row.sections).map((section) => {
      const sectionIndex = typeof section.sectionIndex === 'number'
        ? section.sectionIndex
        : -1
      return {
        ...section,
        ...(sectionReferences.get(sectionIndex + 1) ?? {
          sectionId: null,
          sectionName: null,
        }),
      }
    }),
  }
}

export async function listUcatMcpBlueprints(
  client: SupabaseClient<Database>,
  input: { testYear?: number; latestOnly?: boolean },
): Promise<Record<string, unknown>> {
  let query = client
    .from('vtutor_ucat_mock_blueprints')
    .select('*')
    .order('test_year', { ascending: false })
    .order('version', { ascending: false })
  if (input.testYear != null) query = query.eq('test_year', input.testYear)
  const [{ data, error }, sectionReferences] = await Promise.all([
    query,
    blueprintSectionReferences(client),
  ])
  if (error) throw new Error(error.message)
  let items = (data ?? []).flatMap((row) => {
    const blueprint = blueprintReadFromRow(
      row as unknown as Record<string, unknown>,
      sectionReferences,
    )
    return blueprint ? [blueprint] : []
  })
  if (input.latestOnly) {
    const seen = new Set<string>()
    items = items.filter((item) => {
      const key = `${item.code}:${item.testYear}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }
  return { items, count: items.length }
}

export async function getUcatMcpBlueprint(
  client: SupabaseClient<Database>,
  blueprintId: string,
): Promise<Record<string, unknown>> {
  const [{ data, error }, sectionReferences] = await Promise.all([
    client
      .from('vtutor_ucat_mock_blueprints')
      .select('*')
      .eq('id', blueprintId)
      .maybeSingle(),
    blueprintSectionReferences(client),
  ])
  const row = requireRow(data, error, 'UCAT blueprint')
  const blueprint = blueprintReadFromRow(row, sectionReferences)
  if (!blueprint) throw new Error('UCAT blueprint is malformed')
  return blueprint
}

async function getBlueprintModel(
  client: SupabaseClient<Database>,
  blueprintId: string,
): Promise<{
  databaseId: string
  model: NonNullable<ReturnType<typeof blueprintRowToModel>>
}> {
  const { data, error } = await client
    .from('vtutor_ucat_mock_blueprints')
    .select('*')
    .eq('id', blueprintId)
    .maybeSingle()
  const row = requireRow(data, error, 'UCAT blueprint')
  const model = blueprintRowToModel(row as unknown as BlueprintRow)
  if (!model) throw new Error('UCAT blueprint is malformed')
  return { databaseId: blueprintId, model }
}

async function getSectionReference(
  client: SupabaseClient<Database>,
  sectionId: string,
): Promise<{ code: BlueprintSectionCode; name: string; number: number }> {
  const { data, error } = await client
    .from('vtutor_ucat_sections')
    .select('name,section_number')
    .eq('id', sectionId)
    .maybeSingle()
  const row = requireRow(data, error, 'UCAT section')
  const number = typeof row.section_number === 'number' ? row.section_number : 0
  const code = sectionCodeByNumber[number]
  if (!code || typeof row.name !== 'string') throw new Error('UCAT section is malformed')
  return { code, name: row.name, number }
}

function setAnsweringTimeSeconds(
  input: ValidateQuestionSetCompositionInput,
  officialQuestionCount: number,
  officialAnsweringTimeSeconds: number,
  actualQuestionCount: number,
): number {
  if (input.timingMode === 'fixed') return input.fixedTimeLimitSeconds ?? 0
  if (input.timingMode === 'untimed') return 0
  const examTime = officialAnsweringTimeSeconds * actualQuestionCount / officialQuestionCount
  return Math.ceil(examTime / (input.paceMultiplier ?? 1))
}

export async function validateUcatMcpQuestionSetComposition(
  client: SupabaseClient<Database>,
  input: ValidateQuestionSetCompositionInput,
): Promise<Record<string, unknown>> {
  const [{ model }, section, stemRows] = await Promise.all([
    getBlueprintModel(client, input.referenceBlueprintId),
    getSectionReference(client, input.sectionId),
    getStemDetails(client, input.stemIds),
  ])
  const missingStemIds = input.stemIds.filter(
    (id) => !stemRows.some((row) => row.id === id),
  )
  const wrongSectionStemIds = stemRows.flatMap((row) => (
    row.section_id !== input.sectionId && typeof row.id === 'string' ? [row.id] : []
  ))
  const duplicateStemIds = input.stemIds.filter(
    (id, index) => input.stemIds.indexOf(id) !== index,
  )
  const stems = stemRows.flatMap((row) => {
    const stem = blueprintStemFromDetail(row)
    return stem ? [stem] : []
  })
  const official = model.official.sections.find((candidate) => candidate.section === section.code)
  if (!official) throw new Error('Blueprint does not define the selected UCAT section')

  if (input.setFormat === 'partial_section') {
    const errors = [
      ...missingStemIds.map((stemId) => ({
        code: 'STEM_NOT_FOUND', severity: 'error', stemId,
        message: `Stem ${stemId} was not found.`,
      })),
      ...wrongSectionStemIds.map((stemId) => ({
        code: 'STEM_SECTION_MISMATCH', severity: 'error', stemId,
        message: `Stem ${stemId} does not belong to ${section.name}.`,
      })),
      ...duplicateStemIds.map((stemId) => ({
        code: 'DUPLICATE_STEM_ID', severity: 'error', stemId,
        message: `Stem ${stemId} appears more than once.`,
      })),
    ]
    return {
      applicable: false,
      compliant: errors.length === 0,
      blueprintId: input.referenceBlueprintId,
      sectionId: input.sectionId,
      setFormat: input.setFormat,
      totals: { stems: stems.length, questions: stems.reduce((sum, stem) => sum + stem.questions.length, 0) },
      reasons: [
        ...errors,
        {
          code: 'FOCUSED_PRACTICE_EXEMPT',
          severity: 'information',
          message: 'Partial sets are not required to match a complete exam section.',
        },
      ],
      checks: [],
    }
  }

  const actualQuestionCount = stems.reduce((sum, stem) => sum + stem.questions.length, 0)
  const evaluation = evaluateBlueprint(model, {
    purpose: 'full_mock',
    sections: [{
      section: section.code,
      answeringTimeSeconds: setAnsweringTimeSeconds(
        input,
        official.questionCount,
        official.answeringTimeSeconds,
        actualQuestionCount,
      ),
      instructionTimeSeconds: official.instructionTimeSeconds,
      stems,
    }],
  })
  const compliance = evaluationToStoredCompliance(evaluation)
  const reasons = (compliance.reasons ?? []).filter((reason) => (
    reason.code !== 'SECTION_MISSING' && reason.code !== 'SECTION_ORDER_INVALID'
  ))
  const extraReasons = [
    ...missingStemIds.map((stemId) => ({
      code: 'STEM_NOT_FOUND', severity: 'error' as const, stemId,
      message: `Stem ${stemId} was not found.`,
    })),
    ...wrongSectionStemIds.map((stemId) => ({
      code: 'STEM_SECTION_MISMATCH', severity: 'error' as const, stemId,
      message: `Stem ${stemId} does not belong to ${section.name}.`,
    })),
  ]
  return {
    ...compliance,
    compliant: reasons.every((reason) => reason.severity !== 'error')
      && extraReasons.length === 0,
    blueprintId: input.referenceBlueprintId,
    sectionId: input.sectionId,
    setFormat: input.setFormat,
    sections: compliance.sections.filter((candidate) => candidate.section === section.code),
    reasons: [...reasons, ...extraReasons],
  }
}

export async function validateUcatMcpMockComposition(
  client: SupabaseClient<Database>,
  input: ValidateMockCompositionInput,
): Promise<Record<string, unknown>> {
  const [{ model }, sectionReferences] = await Promise.all([
    getBlueprintModel(client, input.blueprintId),
    blueprintSectionReferences(client),
  ])
  const setIds = input.sectionSets.map((item) => item.setId)
  const duplicateSectionIds = input.sectionSets.filter(
    (item, index) => input.sectionSets.findIndex((candidate) => candidate.sectionId === item.sectionId) !== index,
  ).map((item) => item.sectionId)
  const duplicateSetIds = setIds.filter((id, index) => setIds.indexOf(id) !== index)
  const setDetails = await Promise.all(setIds.map((id) => getSet(client, id)))
  const bySectionId = new Map(input.sectionSets.map((item, index) => [
    item.sectionId,
    setDetails[index],
  ]))
  const compositionSections: BlueprintComposition['sections'] = []
  const membershipReasons: Array<Record<string, unknown>> = []
  for (const official of model.official.sections) {
    const sectionNumber = Object.entries(sectionCodeByNumber).find(([, code]) => code === official.section)?.[0]
    const sectionRef = sectionNumber ? sectionReferences.get(Number(sectionNumber)) : undefined
    const set = sectionRef ? bySectionId.get(sectionRef.sectionId) : undefined
    if (!set || !sectionRef) continue
    if (set.section_id !== sectionRef.sectionId) {
      membershipReasons.push({
        code: 'SET_SECTION_MISMATCH', severity: 'error', setId: set.id,
        sectionId: sectionRef.sectionId,
        message: `Set ${String(set.id)} does not belong to ${sectionRef.sectionName}.`,
      })
    }
    if (set.reference_blueprint_id !== input.blueprintId) {
      membershipReasons.push({
        code: 'SET_BLUEPRINT_MISMATCH', severity: 'error', setId: set.id,
        message: `Set ${String(set.id)} references a different blueprint.`,
      })
    }
    const stems = (await getStemDetails(client, setStemIds(set))).flatMap((row) => {
      const stem = blueprintStemFromDetail(row)
      return stem ? [stem] : []
    })
    compositionSections.push({
      section: official.section,
      answeringTimeSeconds: typeof set.time_limit_seconds === 'number'
        ? set.time_limit_seconds
        : 0,
      instructionTimeSeconds: official.instructionTimeSeconds,
      stems,
    })
  }
  membershipReasons.push(
    ...duplicateSectionIds.map((sectionId) => ({
      code: 'DUPLICATE_SECTION_ID', severity: 'error', sectionId,
      message: `Section ${sectionId} is assigned more than once.`,
    })),
    ...duplicateSetIds.map((setId) => ({
      code: 'DUPLICATE_SET_ID', severity: 'error', setId,
      message: `Set ${setId} is assigned more than once.`,
    })),
  )
  const compliance = evaluationToStoredCompliance(evaluateBlueprint(model, {
    purpose: 'full_mock',
    sections: compositionSections,
  }))
  return {
    ...compliance,
    compliant: compliance.compliant && membershipReasons.length === 0,
    blueprintId: input.blueprintId,
    sectionSets: input.sectionSets,
    reasons: [...(compliance.reasons ?? []), ...membershipReasons],
  }
}

async function callMutation(
  client: SupabaseClient<Database>,
  name: string,
  args: Record<string, unknown>,
): Promise<MutationResult> {
  const { data, error } = await rpcClient(client).rpc(name, args)
  if (error) {
    if (error.message.includes('mcp_stale_revision')) {
      throw new Error('The authoring revision is stale. Re-read the aggregate and reconcile your operations.')
    }
    if (error.message.includes('mcp_published_content_read_only')) {
      throw new Error('Published content requires a dedicated published-change tool.')
    }
    if (error.message.includes('mcp_live_learning_folder_read_only')) {
      throw new Error('This live Learn folder requires a dedicated published-learning-module change tool.')
    }
    if (error.message.includes('delete_blocked_by_dependency')) {
      throw new Error('This content is still used by another active UCAT aggregate or session and cannot be deleted.')
    }
    if (error.message.includes('status_blocked_by_attachment')) {
      throw new Error('This learning module is attached to a session and cannot be deleted.')
    }
    if (isUcatVisibilityBlockedError(error.message)) {
      throw new Error(ucatVisibilityBlockedFallbackMessage(error.message))
    }
    if (error.message.includes('mcp_content_already_deleted')) {
      throw new Error('This content is already deleted. Re-read search results before retrying.')
    }
    if (error.message.includes('mcp_content_not_deleted')) {
      throw new Error('This content is not deleted. Re-read search results before retrying.')
    }
    throw new Error(error.message)
  }
  if (!isRecord(data) || typeof data.id !== 'string') {
    throw new Error('Authoring mutation returned an invalid result')
  }
  return data as MutationResult
}

const NIL_AUTHORING_ID = '00000000-0000-0000-0000-000000000000'

async function throwEnrichedVisibilityError(
  client: SupabaseClient<Database>,
  error: unknown,
  options: {
    contentType: UcatVisibilityContentType
    contentId: string
    accessScope: 'public' | 'private'
    memberIds?: string[]
  },
): Promise<never> {
  const message = error instanceof Error ? error.message : ''
  if (!isUcatVisibilityBlockedMessage(message)) throw error
  const { data } = await rpcClient(client).rpc('tutor_ucat_content_visibility_blockers', {
    p_content_type: options.contentType,
    p_content_id: options.contentId,
    p_access_scope: options.accessScope,
    p_member_ids: options.memberIds ?? null,
  })
  const blockers = parseUcatLifecycleBlockers(data)
  const extraCount = Math.max(0, blockers.length - 1)
  const extra = extraCount > 0
    ? ` There ${extraCount === 1 ? 'is' : 'are'} ${extraCount} more blocker${extraCount === 1 ? '' : 's'}.`
    : ''
  throw new Error((blockers[0]?.message ?? ucatVisibilityBlockedFallbackMessage(message)) + extra)
}

async function callMutationWithVisibility(
  client: SupabaseClient<Database>,
  name: string,
  args: Record<string, unknown>,
  visibility: {
    contentType: UcatVisibilityContentType
    contentId: string
    accessScope: 'public' | 'private'
    memberIds?: string[]
  },
): Promise<MutationResult> {
  try {
    return await callMutation(client, name, args)
  } catch (error) {
    return throwEnrichedVisibilityError(client, error, visibility)
  }
}

export async function recordUcatMcpAuxiliaryActivity(
  client: SupabaseClient<Database>,
  input: {
    entityType: 'ucat_ai_generation_runs' | 'files' | 'ucat_ai_question_assessments'
    entityId: string
    toolName:
      | 'start_question_generation'
      | 'generate_ucat_image'
      | 'revise_ucat_image'
      | 'request_question_ai_assessment'
    operationKinds: string[]
  },
): Promise<void> {
  const { error } = await rpcClient(client).rpc(
    'tutor_ucat_mcp_record_auxiliary_activity',
    {
      p_entity_type: input.entityType,
      p_entity_id: input.entityId,
      p_tool_name: input.toolName,
      p_operation_kinds: input.operationKinds,
    },
  )
  if (error) throw new Error(error.message)
}

function operationKinds(operations: Array<{ type: string }>): string[] {
  return [...new Set(operations.map((operation) => operation.type))]
}

export async function createUcatMcpQuestionStem(
  client: SupabaseClient<Database>,
  input: CreateQuestionStemInput,
): Promise<Record<string, unknown>> {
  const questions = input.questions.map(questionFromInput)
  reindexQuestions(questions)
  const draft: QuestionStemDraft = {
    sectionId: input.sectionId,
    categoryId: input.categoryId ?? null,
    stemText: toRichTextJson(input.stemText) ?? {},
    accessScope: input.accessScope,
    tutorSourceNote: input.tutorSourceNote ?? null,
    questions,
  }
  const metadata = {
    source: 'codex_mcp',
    generatedAt: new Date().toISOString(),
  }
  const result = await callMutationWithVisibility(client, 'tutor_ucat_mcp_upsert_question_stem_bundle', {
    p_stem_id: null,
    p_expected_updated_at: null,
    p_section_id: draft.sectionId,
    p_question_stem_category_id: draft.categoryId,
    p_stem_text: draft.stemText,
    p_access_scope: draft.accessScope,
    p_questions: toStemRpcQuestions(draft),
    p_source_channel: 'ai_generation',
    p_tutor_source_note: draft.tutorSourceNote,
    p_ai_generation_metadata: metadata,
    p_operation_kinds: ['create'],
  }, {
    contentType: 'stem',
    contentId: NIL_AUTHORING_ID,
    accessScope: draft.accessScope,
  })
  return getStem(client, result.id)
}

export async function updateUcatMcpQuestionStem(
  client: SupabaseClient<Database>,
  id: string,
  revision: string,
  operations: QuestionStemOperation[],
): Promise<Record<string, unknown>> {
  const current = await getStem(client, id)
  const draft = applyQuestionStemOperations(questionStemDraftFromDetail(current), operations)
  const result = await callMutationWithVisibility(client, 'tutor_ucat_mcp_upsert_question_stem_bundle', {
    p_stem_id: id,
    p_expected_updated_at: decodeAuthoringRevision(revision, id),
    p_section_id: draft.sectionId,
    p_question_stem_category_id: draft.categoryId,
    p_stem_text: draft.stemText,
    p_access_scope: draft.accessScope,
    p_questions: toStemRpcQuestions(draft),
    p_source_channel: 'ai_generation',
    p_tutor_source_note: draft.tutorSourceNote,
    p_ai_generation_metadata: null,
    p_operation_kinds: operationKinds(operations),
  }, {
    contentType: 'stem',
    contentId: id,
    accessScope: draft.accessScope,
  })
  const updated = await getStem(client, result.id)
  if (updated.status === 'in_review') {
    await enqueueUcatQuestionAssessmentPreparation({
      stemIds: [id],
      triggerKind: 'content_change',
    }).catch((error) => {
      console.error('Could not request UCAT AI assessment after MCP stem update', error)
    })
  }
  return updated
}

export async function createUcatMcpQuestionSet(
  client: SupabaseClient<Database>,
  input: CreateQuestionSetInput,
): Promise<Record<string, unknown>> {
  const draft: QuestionSetDraft = {
    authoringNote: input.authoringNote ?? null,
    description: toRichTextJson(input.description) ?? {},
    timingMode: input.timingMode,
    paceMultiplier: input.paceMultiplier ?? null,
    fixedTimeLimitSeconds: input.fixedTimeLimitSeconds ?? null,
    setFormat: input.setFormat,
    accessScope: input.accessScope,
    sectionId: input.sectionId,
    referenceBlueprintId: input.referenceBlueprintId,
    stemIds: [...input.stemIds],
  }
  const result = await callMutationWithVisibility(client, 'tutor_ucat_mcp_upsert_question_set', {
    p_set_id: null,
    p_expected_updated_at: null,
    p_authoring_note: draft.authoringNote,
    p_description: draft.description,
    p_timing_mode: draft.timingMode,
    p_pace_multiplier: draft.paceMultiplier,
    p_fixed_time_limit_seconds: draft.fixedTimeLimitSeconds,
    p_set_format: draft.setFormat,
    p_access_scope: draft.accessScope,
    p_stem_ids: draft.stemIds,
    p_section_id: draft.sectionId,
    p_reference_blueprint_id: draft.referenceBlueprintId,
    p_operation_kinds: ['create'],
  }, {
    contentType: 'set',
    contentId: NIL_AUTHORING_ID,
    accessScope: draft.accessScope,
    memberIds: draft.stemIds,
  })
  return getSet(client, result.id)
}

export async function updateUcatMcpQuestionSet(
  client: SupabaseClient<Database>,
  id: string,
  revision: string,
  operations: QuestionSetOperation[],
): Promise<Record<string, unknown>> {
  const current = await getSet(client, id)
  const draft = applyQuestionSetOperations(questionSetDraftFromDetail(current), operations)
  const result = await callMutationWithVisibility(client, 'tutor_ucat_mcp_upsert_question_set', {
    p_set_id: id,
    p_expected_updated_at: decodeAuthoringRevision(revision, id),
    p_authoring_note: draft.authoringNote,
    p_description: draft.description,
    p_timing_mode: draft.timingMode,
    p_pace_multiplier: draft.paceMultiplier,
    p_fixed_time_limit_seconds: draft.fixedTimeLimitSeconds,
    p_set_format: draft.setFormat,
    p_access_scope: draft.accessScope,
    p_stem_ids: draft.stemIds,
    p_section_id: draft.sectionId,
    p_reference_blueprint_id: draft.referenceBlueprintId,
    p_operation_kinds: operationKinds(operations),
  }, {
    contentType: 'set',
    contentId: id,
    accessScope: draft.accessScope,
    memberIds: draft.stemIds,
  })
  return getSet(client, result.id)
}

export async function createUcatMcpMock(
  client: SupabaseClient<Database>,
  input: CreateMockInput,
): Promise<Record<string, unknown>> {
  const draft: MockDraft = {
    authoringNote: input.authoringNote ?? null,
    instructionsText: toRichTextJson(input.instructionsText ?? null),
    accessScope: input.accessScope,
    blueprintId: input.blueprintId,
    setIds: [],
    sectionSets: [],
  }
  const result = await callMutationWithVisibility(client, 'tutor_ucat_mcp_upsert_mock', {
    p_mock_id: null,
    p_expected_updated_at: null,
    p_authoring_note: draft.authoringNote,
    p_access_scope: draft.accessScope,
    p_instructions_text: draft.instructionsText,
    p_blueprint_id: draft.blueprintId,
    p_set_ids: null,
    p_operation_kinds: ['create'],
  }, {
    contentType: 'mock',
    contentId: NIL_AUTHORING_ID,
    accessScope: draft.accessScope,
    memberIds: [],
  })
  return getMock(client, result.id)
}

export async function updateUcatMcpMock(
  client: SupabaseClient<Database>,
  id: string,
  revision: string,
  operations: MockOperation[],
): Promise<Record<string, unknown>> {
  const current = await getMock(client, id)
  const draft = applyMockOperations(mockDraftFromDetail(current), operations)
  const result = await callMutationWithVisibility(client, 'tutor_ucat_mcp_upsert_mock', {
    p_mock_id: id,
    p_expected_updated_at: decodeAuthoringRevision(revision, id),
    p_authoring_note: draft.authoringNote,
    p_access_scope: draft.accessScope,
    p_set_ids: draft.setIds,
    p_instructions_text: draft.instructionsText,
    p_blueprint_id: draft.blueprintId,
    p_operation_kinds: operationKinds(operations),
  }, {
    contentType: 'mock',
    contentId: id,
    accessScope: draft.accessScope,
    memberIds: draft.setIds,
  })
  return getMock(client, result.id)
}

function learningModuleRpcBlocks(draft: LearningModuleDraft): Json {
  return draft.blocks.map((block) => ({
    ...(block.id ? { id: block.id } : {}),
    block_type: block.block_type,
    index: block.index,
    require_completion_before_next: block.require_completion_before_next,
    content: block.content,
    question_stem_id: block.question_stem_id,
    question_id: block.question_id,
    file_id: block.file_id,
    skill_trainer_id: block.skill_trainer_id,
  })) as Json
}

async function persistLearningModule(
  client: SupabaseClient<Database>,
  id: string | null,
  expectedUpdatedAt: string | null,
  draft: LearningModuleDraft,
  kinds: string[],
): Promise<Record<string, unknown>> {
  const result = await callMutation(client, 'tutor_ucat_mcp_upsert_learning_module', {
    p_module_id: id,
    p_expected_updated_at: expectedUpdatedAt,
    p_kind: draft.kind,
    p_title: draft.title,
    p_description: draft.description,
    p_ucat_section_id: draft.sectionId,
    p_parent_id: draft.parentId,
    p_index: draft.index,
    p_access_scope: draft.accessScope,
    p_icon_key: draft.iconKey,
    p_estimated_minutes: draft.estimatedMinutes,
    p_study_plan_priority: draft.studyPlanPriority,
    p_study_plan_category_ids: draft.studyPlanCategoryIds,
    p_study_plan_tag_ids: draft.studyPlanTagIds,
    p_blocks: learningModuleRpcBlocks(draft),
    p_operation_kinds: kinds,
  })
  return getLearningModule(client, result.id)
}

export async function createUcatMcpLearningModule(
  client: SupabaseClient<Database>,
  input: CreateLearningModuleInput,
): Promise<Record<string, unknown>> {
  const blocks = (input.blocks ?? []).map(blockFromInput)
  reindexBlocks(blocks)
  const draft: LearningModuleDraft = {
    kind: input.kind,
    title: input.title,
    description: input.description ?? null,
    sectionId: input.sectionId ?? null,
    parentId: input.parentId ?? null,
    index: input.index ?? 0,
    accessScope: input.kind === 'folder' ? 'public' : input.accessScope,
    iconKey: input.iconKey ?? 'book-open',
    estimatedMinutes: input.estimatedMinutes ?? null,
    studyPlanPriority: input.studyPlanPriority ?? 'recommended',
    studyPlanCategoryIds: input.studyPlanCategoryIds ?? [],
    studyPlanTagIds: input.studyPlanTagIds ?? [],
    blocks,
  }
  return persistLearningModule(client, null, null, draft, ['create'])
}

export async function updateUcatMcpLearningModule(
  client: SupabaseClient<Database>,
  id: string,
  revision: string,
  operations: LearningModuleOperation[],
): Promise<Record<string, unknown>> {
  const current = await getLearningModule(client, id)
  const rawBlocks = Array.isArray(current.blocks) ? current.blocks : []
  const draft = applyLearningModuleOperations(
    learningModuleDraftFromDetail(current, rawBlocks),
    operations,
  )
  return persistLearningModule(
    client,
    id,
    decodeAuthoringRevision(revision, id),
    draft,
    operationKinds(operations),
  )
}

export async function submitUcatMcpForReview(
  client: SupabaseClient<Database>,
  contentType: UcatMcpAggregateType,
  id: string,
  revision: string,
): Promise<Record<string, unknown>> {
  if (contentType === 'learning_module') {
    const aggregate = await getLearningModule(client, id)
    if (aggregate.kind !== 'lesson') throw new Error('Folders do not have a review lifecycle')
  }
  const result = await callMutation(client, 'tutor_ucat_mcp_submit_for_review', {
    p_content_type: contentType === 'learning_module' ? 'lesson' : contentType,
    p_content_id: id,
    p_expected_updated_at: decodeAuthoringRevision(revision, id),
  })
  if (contentType === 'stem') {
    await enqueueUcatQuestionAssessmentPreparation({
      stemIds: [id],
      triggerKind: 'review_submission',
    }).catch((error) => {
      console.error('Could not request UCAT AI assessment after MCP review submission', error)
    })
  }
  return getUcatMcpAggregate(client, contentType, result.id)
}

export async function deleteUcatMcpContent(
  client: SupabaseClient<Database>,
  contentType: UcatMcpAggregateType,
  id: string,
  revision: string,
): Promise<MutationResult & { deletedAt?: string | null }> {
  try {
    return await callMutation(client, 'tutor_ucat_mcp_set_deleted', {
      p_content_type: contentType,
      p_content_id: id,
      p_expected_updated_at: decodeAuthoringRevision(revision, id),
      p_deleted: true,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    if (
      !message.includes('delete_blocked_by_dependency') &&
      !message.includes('status_blocked_by_attachment') &&
      !message.includes('still used by another active UCAT') &&
      !message.includes('attached to a session')
    ) {
      throw error
    }
    const { data } = await rpcClient(client).rpc('tutor_ucat_content_delete_blockers', {
      p_content_type: contentType === 'learning_module' ? 'lesson' : contentType,
      p_content_id: id,
    })
    const blockers = parseUcatLifecycleBlockers(data)
    const extraCount = Math.max(0, blockers.length - 1)
    const extra = extraCount > 0
      ? ` There ${extraCount === 1 ? 'is' : 'are'} ${extraCount} more blocker${extraCount === 1 ? '' : 's'}.`
      : ''
    throw new Error(
      (blockers[0]?.message ?? (
        message.includes('status_blocked_by_attachment') || message.includes('attached to a session')
          ? 'This learning module is attached to a session and cannot be deleted.'
          : 'This content is still used by another active UCAT aggregate or session and cannot be deleted.'
      )) + extra,
    )
  }
}

export async function restoreUcatMcpContent(
  client: SupabaseClient<Database>,
  contentType: UcatMcpAggregateType,
  id: string,
  revision: string,
): Promise<Record<string, unknown>> {
  const result = await callMutation(client, 'tutor_ucat_mcp_set_deleted', {
    p_content_type: contentType,
    p_content_id: id,
    p_expected_updated_at: decodeAuthoringRevision(revision, id),
    p_deleted: false,
  })
  return getUcatMcpAggregate(client, contentType, result.id)
}

export async function getUcatMcpGenerationRuns(
  client: SupabaseClient<Database>,
  runId?: string,
): Promise<unknown[]> {
  let query = client
    .from('vtutor_ucat_ai_generation_runs')
    .select('id,status,requested_stem_count,accepted_stem_count,discarded_stem_count,processed_stem_count,progress_step,progress_message,error_message,generated_stem_ids,created_at,completed_at,dismissed_at')
    .order('created_at', { ascending: false })
    .limit(runId ? 1 : 20)
  if (runId) query = query.eq('id', runId)
  const { data, error } = await query
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function getUcatMcpAiAssessment(
  client: SupabaseClient<Database>,
  stemId: string,
): Promise<Record<string, unknown>> {
  const [cycles, runs, decisions] = await Promise.all([
    client
      .from('vtutor_ucat_ai_question_assessment_cycles')
      .select('*')
      .eq('stem_id', stemId)
      .order('started_at', { ascending: false }),
    client
      .from('vtutor_ucat_ai_question_assessment_runs')
      .select('*')
      .eq('stem_id', stemId)
      .order('requested_at', { ascending: false }),
    client
      .from('vtutor_ucat_ai_question_assessment_decisions')
      .select('*')
      .eq('stem_id', stemId)
      .order('decided_at', { ascending: false }),
  ])
  for (const result of [cycles, runs, decisions]) {
    if (result.error) throw new Error(result.error.message)
  }
  return {
    stemId,
    cycles: cycles.data ?? [],
    runs: runs.data ?? [],
    decisions: decisions.data ?? [],
  }
}
