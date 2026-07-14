import { getSupabaseClient } from '@/shared/lib/supabase/client'
import type { Database, Json } from '@altitutor/shared'
import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  UcatAccessScope,
  UcatContentStatus,
  UcatPublicationIssue,
  UcatQuestionStem,
  UcatQuestionStemBundlePayload,
} from '@/features/ucat/shared/types'
import { proseMirrorToPlainText } from '@/features/ucat/shared/lib/rich-text'
import { fetchAllSupabaseRows } from '@/features/ucat/shared/lib/fetch-all-supabase-rows'
import { throwUcatLifecycleResponseError } from '@/features/ucat/shared/lifecycle-errors'

export type UcatGenerationDebugCall = {
  stemIndex: number
  categoryName: string | null
  operation: string
  model: string | null
  durationMs: number
  status: 'ok' | 'error'
  error?: string
  request: {
    systemPrompt: string
    userPrompt: string
    maxCompletionTokens: number
    timeoutMs: number
    providerSort?: 'price' | 'throughput' | 'latency'
    reasoningEffort?: 'none' | 'minimal' | 'low' | 'medium' | 'high'
  }
  response?: {
    content: string
    finishReason: string | null
    usage: unknown
    contentLength: number
  }
  parsedSummary?: {
    stemCount: number
    categories: Array<string | null>
    questionCounts: number[]
  }
}

export type UcatGenerationDebugInfo = {
  runId?: string | null
  requestedStemCount: number
  sectionName: string | null
  selectedCategoryName: string | null
  sourceSampleIds: string[]
  promptLayerCount: number
  calls: UcatGenerationDebugCall[]
  gateIssues: Array<{
    severity: string
    code: string
    message: string
    stemIndex: number
    questionIndex?: number
    details?: Record<string, unknown>
  }>
}

export type UcatGenerationProgress = {
  step: 'setup' | 'sources' | 'generating' | 'gates' | 'images' | 'drafts'
  message: string
  completedStems?: number
  totalStems?: number
  runId?: string | null
}

export class UcatGenerationApiError extends Error {
  debug: UcatGenerationDebugInfo | null

  constructor(message: string, debug: UcatGenerationDebugInfo | null) {
    super(message)
    this.name = 'UcatGenerationApiError'
    this.debug = debug
  }
}

export type UcatGeneratedDraftStem = {
  sectionId: string
  categoryId: string | null
  stemText: Json
  accessScope: UcatAccessScope
  questions: Array<{
    index: number
    questionText: Json
    answerExplanation: Json | null
    difficulty: number | null
    timeBurdenSeconds: number | null
    questionType: 'multiple_choice' | 'syllogism'
    tagIds: string[]
    options: Array<{
      index: number
      answerText: Json
      answerExplanation: Json | null
      isAnswer: boolean
    }>
  }>
  aiGenerationMetadata: Json | null
}

export type UcatGenerateDraftsResult = {
  discardedCount?: number
  debug?: UcatGenerationDebugInfo | null
  debugRunId?: string | null
  stems: UcatGeneratedDraftStem[]
}

type UcatGenerationStreamFinal = UcatGenerateDraftsResult & {
  type?: string
  status?: number
  error?: string
}

export type UcatQuestionStemRow = UcatQuestionStem & {
  ai_generation_metadata?: Json | null
  source_channel?: UcatQuestionSourceChannel | null
  tutor_source_note?: string | null
  status: UcatContentStatus
  access_scope: UcatAccessScope
  publication_issues?: UcatPublicationIssue[] | null
  status_changed_at?: string | null
  status_changed_by?: string | null
  status_changed_by_first_name?: string | null
  status_changed_by_last_name?: string | null
}

export type UcatQuestionSourceChannel = 'individual' | 'bulk_import' | 'ai_generation'

type StemDetailQuestion = {
  id: string
  question_text: Json
  answer_explanation: Json | null
  index: number
  difficulty: number | null
  time_burden_seconds: number | null
  question_type: 'multiple_choice' | 'syllogism'
  source_channel?: UcatQuestionSourceChannel | null
  ai_generation_metadata?: Json | null
  tags?: Array<{ id: string; name: string }>
  answer_options: Array<{
    id: string
    answer_text: Json
    answer_explanation: Json | null
    index: number
    is_answer: boolean
    option_text_file_ids?: string[]
    option_explanation_file_ids?: string[]
  }>
}

export type StemDetailRow = {
  id: string
  section_id: string
  section_name: string
  section_number: number
  display_columns: number
  question_stem_category_id: string | null
  category_name: string | null
  status: UcatContentStatus
  access_scope: UcatAccessScope
  publication_issues?: UcatPublicationIssue[] | null
  ai_generation_metadata?: Json | null
  source_channel?: UcatQuestionSourceChannel | null
  tutor_source_note?: string | null
  status_changed_at?: string | null
  status_changed_by?: string | null
  status_changed_by_first_name?: string | null
  status_changed_by_last_name?: string | null
  created_by?: string | null
  created_by_first_name?: string | null
  created_by_last_name?: string | null
  created_at?: string | null
  stem_text: Json
  questions: StemDetailQuestion[]
}

export const ucatQuestionsApi = {
  async list(options?: {
    status?: UcatContentStatus | null
    sourceChannel?: UcatQuestionSourceChannel | null
    sectionId?: string | null
    categoryId?: string | null
  }) {
    const supabase = getSupabaseClient() as SupabaseClient<Database>
    let query = supabase
      .from('vtutor_ucat_question_stems')
      .select('*')
      .order('updated_at', { ascending: false })
      .order('id')

    if (options?.sectionId) {
      query = query.eq('section_id', options.sectionId)
    }
    if (options?.categoryId) {
      query = query.eq('question_stem_category_id', options.categoryId)
    }
    if (options?.status) {
      query = query.eq('status', options.status)
    }
    if (options?.sourceChannel) {
      query = query.eq('source_channel', options.sourceChannel)
    }

    const data = await fetchAllSupabaseRows((from, to) => query.range(from, to))
    return data as unknown as UcatQuestionStemRow[]
  },

  async getSections() {
    const supabase = getSupabaseClient() as SupabaseClient<Database>
    const { data, error } = await supabase.from('vtutor_ucat_sections').select('*').order('section_number')
    if (error) throw error
    return data ?? []
  },

  async getCategories() {
    const supabase = getSupabaseClient() as SupabaseClient<Database>
    const { data, error } = await supabase.from('vtutor_ucat_question_stem_categories').select('*').order('name')
    if (error) throw error
    return data ?? []
  },

  async getTags() {
    const supabase = getSupabaseClient() as SupabaseClient<Database>
    const { data, error } = await supabase.from('vtutor_ucat_question_tags').select('*').order('name')
    if (error) throw error
    return data ?? []
  },

  async getDetail(stemId: string) {
    const supabase = getSupabaseClient() as SupabaseClient<Database>
    const [detailResult, metaResult] = await Promise.all([
      supabase.from('vtutor_ucat_question_stem_detail').select('*').eq('id', stemId).maybeSingle(),
      supabase
        .from('vtutor_ucat_question_stems')
        .select(
          'created_by, created_by_first_name, created_by_last_name, created_at, status_changed_by, status_changed_at, status_changed_by_first_name, status_changed_by_last_name',
        )
        .eq('id', stemId)
        .maybeSingle(),
    ])

    if (detailResult.error) throw detailResult.error
    if (metaResult.error) throw metaResult.error
    if (!detailResult.data) return null

    const meta = metaResult.data as {
      created_by?: string | null
      created_by_first_name?: string | null
      created_by_last_name?: string | null
      created_at?: string | null
      status_changed_by?: string | null
      status_changed_at?: string | null
      status_changed_by_first_name?: string | null
      status_changed_by_last_name?: string | null
    } | null

    return {
      ...(detailResult.data as Record<string, unknown>),
      created_by: meta?.created_by ?? null,
      created_by_first_name: meta?.created_by_first_name ?? null,
      created_by_last_name: meta?.created_by_last_name ?? null,
      created_at: meta?.created_at ?? null,
      status_changed_by: meta?.status_changed_by ?? null,
      status_changed_at: meta?.status_changed_at ?? null,
      status_changed_by_first_name: meta?.status_changed_by_first_name ?? null,
      status_changed_by_last_name: meta?.status_changed_by_last_name ?? null,
    } as StemDetailRow
  },

  async getStemTypes() {
    const supabase = getSupabaseClient() as SupabaseClient<Database>
    const data = await fetchAllSupabaseRows((from, to) =>
      supabase
        .from('vtutor_ucat_question_stem_detail')
        .select('id,questions')
        .order('id')
        .range(from, to)
    )

    type QuestionWithType = { question_type?: string | null }
    const rows = (data ?? []) as Array<{ id: string | null; questions: unknown }>
    const map: Record<string, Set<'multiple_choice' | 'syllogism'>> = {}

    for (const row of rows) {
      if (!row.id) continue
      const types = new Set<'multiple_choice' | 'syllogism'>()
      const questions = Array.isArray(row.questions) ? (row.questions as QuestionWithType[]) : []
      for (const question of questions) {
        if (question.question_type === 'multiple_choice' || question.question_type === 'syllogism') {
          types.add(question.question_type)
        }
      }
      map[row.id] = types
    }

    return map
  },

  async getStemTagIds() {
    const supabase = getSupabaseClient() as SupabaseClient<Database>
    const data = await fetchAllSupabaseRows((from, to) =>
      supabase
        .from('vtutor_ucat_question_stem_detail')
        .select('id,questions')
        .order('id')
        .range(from, to)
    )

    type QuestionWithTags = {
      deleted_at?: string | null
      tags?: Array<{ id?: string | null }> | null
    }
    const rows = (data ?? []) as Array<{ id: string | null; questions: unknown }>
    const map: Record<string, string[]> = {}

    for (const row of rows) {
      if (!row.id) continue
      const tagIds = new Set<string>()
      const questions = Array.isArray(row.questions) ? (row.questions as QuestionWithTags[]) : []
      for (const question of questions) {
        if (question.deleted_at) continue
        const tags = Array.isArray(question.tags) ? question.tags : []
        for (const tag of tags) {
          if (tag.id) tagIds.add(tag.id)
        }
      }
      map[row.id] = Array.from(tagIds)
    }

    return map
  },

  async getQuestionSearchTexts() {
    const supabase = getSupabaseClient() as SupabaseClient<Database>
    const data = await fetchAllSupabaseRows((from, to) =>
      supabase
        .from('vtutor_ucat_question_stem_detail')
        .select('id,questions')
        .order('id')
        .range(from, to)
    )

    type QuestionWithSearchContent = {
      deleted_at?: string | null
      question_text?: Json | null
      answer_options?: Array<{
        deleted_at?: string | null
        answer_text?: Json | null
      }> | null
    }
    const rows = (data ?? []) as Array<{ id: string | null; questions: unknown }>
    const map: Record<string, { questionText: string; answerOptionText: string }> = {}

    for (const row of rows) {
      if (!row.id) continue
      const questions = Array.isArray(row.questions) ? (row.questions as QuestionWithSearchContent[]) : []
      const questionTexts: string[] = []
      const answerOptionTexts: string[] = []

      for (const question of questions) {
        if (question.deleted_at) continue
        const questionText = proseMirrorToPlainText(question.question_text)
        if (questionText) questionTexts.push(questionText)

        const answerOptions = Array.isArray(question.answer_options) ? question.answer_options : []
        for (const option of answerOptions) {
          if (option.deleted_at) continue
          const answerText = proseMirrorToPlainText(option.answer_text)
          if (answerText) answerOptionTexts.push(answerText)
        }
      }

      map[row.id] = {
        questionText: questionTexts.join(' '),
        answerOptionText: answerOptionTexts.join(' '),
      }
    }

    return map
  },

  async getStemCatalog(options?: { publishedOnly?: boolean }) {
    const supabase = getSupabaseClient() as SupabaseClient<Database>
    const publishedOnly = options?.publishedOnly ?? false
    const [detailData, listData] = await Promise.all([
      fetchAllSupabaseRows((from, to) =>
        (publishedOnly
          ? supabase
              .from('vtutor_ucat_question_stem_detail')
              .select(
                'id,stem_text,questions,section_name,section_number,section_id,question_stem_category_id,category_name,status,access_scope,source_channel,created_at,deleted_at'
              )
              .is('deleted_at', null)
              .eq('status', 'published')
          : supabase
          .from('vtutor_ucat_question_stem_detail')
          .select(
              'id,stem_text,questions,section_name,section_number,section_id,question_stem_category_id,category_name,status,access_scope,source_channel,created_at,deleted_at'
          )
              .is('deleted_at', null))
          .order('id')
          .range(from, to)
      ),
      fetchAllSupabaseRows((from, to) =>
        supabase
          .from('vtutor_ucat_question_stems')
          .select('id,set_names,set_ids')
          .is('deleted_at', null)
          .order('id')
          .range(from, to)
      ),
    ])

    const setInfoById = new Map(
      listData.map((row) => [
        row.id ?? '',
        {
          setNames: row.set_names,
          setIds: row.set_ids,
        },
      ])
    )

    return (detailData as Array<{
      id: string | null
      stem_text: Json | null
      questions: unknown
      section_name: string | null
      section_number: number | null
      section_id: string | null
      question_stem_category_id: string | null
      category_name: string | null
      status: UcatContentStatus
      access_scope: UcatAccessScope
      source_channel: UcatQuestionSourceChannel | null
      created_at: string | null
      set_names?: unknown
      set_ids?: unknown
    }>).map((row) => {
      const setInfo = row.id ? setInfoById.get(row.id) : undefined
      return {
        ...row,
        set_names: setInfo?.setNames ?? null,
        set_ids: setInfo?.setIds ?? null,
      }
    })
  },

  async create(payload: UcatQuestionStemBundlePayload) {
    const response = await fetch('/api/ucat/question-stems', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(serializePayload(payload)),
    })

    if (!response.ok) {
      const body = await response.json().catch(() => ({}))
      throw new Error(body.error ?? 'Failed to create question stem')
    }

    return response.json() as Promise<{ id: string }>
  },

  async update(stemId: string, payload: UcatQuestionStemBundlePayload) {
    const response = await fetch(`/api/ucat/question-stems/${stemId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(serializePayload({ ...payload, stemId })),
    })

    if (!response.ok) {
      const body = await response.json().catch(() => ({}))
      throw new Error(body.error ?? 'Failed to update question stem')
    }

    return response.json() as Promise<{ id: string }>
  },

  async addQuestionTag(stemId: string, questionId: string, tagId: string) {
    return this.addQuestionTags(stemId, questionId, [tagId])
  },

  async addQuestionTags(stemId: string, questionId: string, tagIds: string[]) {
    const detail = await this.getDetail(stemId)
    if (!detail) throw new Error('Question stem not found')
    const questions = (detail.questions ?? []) as StemDetailQuestion[]
    const questionIndex = questions.findIndex((q) => q.id === questionId)
    if (questionIndex === -1) throw new Error('Question not found')
    const existingTagIds = (questions[questionIndex].tags ?? []).map((t) => t.id)
    const newTagIds = Array.from(new Set([...existingTagIds, ...tagIds]))
    if (newTagIds.length === existingTagIds.length) return
    const payload = stemDetailToBundlePayload(detail, (q, i) =>
      i === questionIndex ? newTagIds : (q.tags ?? []).map((t) => t.id)
    )
    return this.update(stemId, payload)
  },

  async remove(stemId: string) {
    const response = await fetch(`/api/ucat/question-stems/${stemId}`, { method: 'DELETE' })
    if (!response.ok) {
      const body = await response.json().catch(() => ({}))
      throw new Error(body.error ?? 'Failed to delete question stem')
    }
  },

  async bulkRemove(stemIds: string[]) {
    const response = await fetch('/api/ucat/question-stems/bulk-delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stemIds }),
    })
    if (!response.ok) {
      const body = await response.json().catch(() => ({}))
      throw new Error(body.error ?? 'Failed to bulk delete question stems')
    }
    return response.json() as Promise<{ ok: true }>
  },

  async restore(stemId: string) {
    const response = await fetch(`/api/ucat/question-stems/${stemId}/restore`, { method: 'POST' })
    if (!response.ok) {
      const body = await response.json().catch(() => ({}))
      throw new Error(body.error ?? 'Failed to restore question stem')
    }
  },

  async bulkUpdateMetadata(
    stemIds: string[],
    updates: { categoryId?: string | null; accessScope?: UcatAccessScope }
  ) {
    const response = await fetch('/api/ucat/question-stems/bulk-update', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        stemIds,
        categoryId: updates.categoryId ?? null,
        accessScope: updates.accessScope ?? null,
      }),
    })

    if (!response.ok) {
      const body = await response.json().catch(() => ({}))
      throw new Error(body.error ?? 'Failed to bulk update question stems')
    }

    return response.json() as Promise<{ ok: true }>
  },

  async bulkImport(sectionId: string, stems: UcatQuestionStemBundlePayload[]) {
    const response = await fetch('/api/ucat/question-stems/bulk-import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sectionId,
        stems: stems.map((stem) => serializePayload(stem)),
      }),
    })

    if (!response.ok) {
      const body = await response.json().catch(() => ({}))
      throw new Error(body.error ?? 'Failed to bulk import question stems')
    }

    return response.json() as Promise<{ ids: string[] }>
  },

  async generateDrafts(input: {
    sectionId: string
    categoryId?: string | null
    modelProfileId?: string | null
    sourceMode: 'none' | 'random' | 'selected'
    includeAiSourceStems?: boolean
    imageGenerationMode?: 'auto' | 'deterministic' | 'ai'
    sourceStemIds?: string[]
    stemCount: number
    difficultyTarget: 'easy' | 'medium' | 'hard' | 'mixed'
    timeBurdenTarget: 'low' | 'medium' | 'high' | 'mixed'
    targetTagIds: string[]
    runInstructions?: string | null
    onProgress?: (progress: UcatGenerationProgress) => void
  }): Promise<UcatGenerateDraftsResult> {
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 600_000)
    let response: Response
    try {
      response = await fetch('/api/ucat/question-stems/generated/generate', {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json', Accept: 'application/x-ndjson' },
        body: JSON.stringify({
          sectionId: input.sectionId,
          categoryId: input.categoryId,
          modelProfileId: input.modelProfileId,
          sourceMode: input.sourceMode,
          includeAiSourceStems: input.includeAiSourceStems ?? false,
          imageGenerationMode: input.imageGenerationMode ?? 'auto',
          sourceStemIds: input.sourceStemIds,
          stemCount: input.stemCount,
          difficultyTarget: input.difficultyTarget,
          timeBurdenTarget: input.timeBurdenTarget,
          targetTagIds: input.targetTagIds,
          runInstructions: input.runInstructions,
        }),
      })
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Generation timed out after 600 seconds. Try fewer stems or a faster model.')
      }
      throw error
    } finally {
      window.clearTimeout(timeout)
    }

    if (response.headers.get('content-type')?.includes('application/x-ndjson')) {
      const reader = response.body?.getReader()
      if (!reader) throw new Error('Generation stream did not include a response body')
      const decoder = new TextDecoder()
      let buffer = ''
      const finalRef: { current: UcatGenerationStreamFinal | null } = { current: null }

      const consumeLine = (line: string) => {
        if (!line.trim()) return
        const event = JSON.parse(line) as {
          type?: string
          step?: UcatGenerationProgress['step']
          message?: string
          completedStems?: number
          totalStems?: number
          runId?: string | null
        }
        if (event.type === 'progress' && event.step && event.message) {
          input.onProgress?.({
            step: event.step,
            message: event.message,
            completedStems: event.completedStems,
            totalStems: event.totalStems,
            runId: event.runId,
          })
          return
        }
        if (event.type === 'complete' || event.type === 'error') {
          finalRef.current = event as UcatGenerationStreamFinal
        }
      }

      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''
        for (const line of lines) consumeLine(line)
      }
      buffer += decoder.decode()
      consumeLine(buffer)

      const finalBody = finalRef.current
      if (!finalBody) throw new Error('Generation stream ended without a final response')
      if (finalBody.type === 'error' || (finalBody.status && finalBody.status >= 400)) {
        throw new UcatGenerationApiError(finalBody.error ?? 'Failed to generate question drafts', finalBody.debug ?? null)
      }
      if (!finalBody.stems) throw new Error('Generation response did not include generated stems')
      return {
        discardedCount: finalBody.discardedCount,
        debug: finalBody.debug,
        debugRunId: finalBody.debugRunId,
        stems: finalBody.stems,
      }
    }

    if (!response.ok) {
      const body = await response.json().catch(() => ({})) as { error?: string; debug?: UcatGenerationDebugInfo | null }
      throw new UcatGenerationApiError(body.error ?? 'Failed to generate question drafts', body.debug ?? null)
    }
    return response.json() as Promise<UcatGenerateDraftsResult>
  },

  async getGenerationModelProfiles() {
    const response = await fetch('/api/ucat/question-stems/generated/model-profiles')
    if (!response.ok) {
      const body = await response.json().catch(() => ({}))
      throw new Error(body.error ?? 'Failed to load generation model profiles')
    }
    return response.json() as Promise<{
      modelProfiles: Array<{
        id: string
        name: string
        model: string
        isDefault: boolean
      }>
      settings: {
        maxRequestedStems: number
      }
    }>
  },

  async generateExplanations(input: {
    modelProfileId?: string | null
    concurrency?: number
    stems: Array<{
      id?: string
      sectionId: string
      sectionName?: string | null
      categoryId?: string | null
      categoryName?: string | null
      stemText: unknown
      isPrivate?: boolean
      questions: Array<{
        questionText: unknown
        questionType: 'multiple_choice' | 'syllogism'
        answerExplanation?: unknown
        difficulty?: number | null
        timeBurdenSeconds?: string | null
        tagIds?: string[]
        options: Array<{
          answerText: unknown
          answerExplanation?: unknown
          isAnswer: boolean
        }>
      }>
      questionIndices?: number[]
    }>
  }) {
    const response = await fetch('/api/ucat/question-stems/explanations/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        modelProfileId: input.modelProfileId ?? null,
        concurrency: input.concurrency,
        stems: input.stems,
      }),
    })
    if (!response.ok) {
      const body = await response.json().catch(() => ({}))
      throw new Error((body as { error?: string }).error ?? 'Failed to generate explanations')
    }
    return response.json() as Promise<{
      results: Array<{
        stemIndex: number
        id: string | null
        updates: Array<{
          questionIndex: number
          answerExplanation?: string | null
          optionExplanations?: Array<string | null>
          confidence?: number
          unresolved?: boolean
          rationale?: string | null
          reviewRequired?: boolean
          reviewMessage?: string | null
          suggestedCorrectOptionIndex?: number | null
          suggestedAnswerExplanation?: string | null
          suggestedChanges?: string | null
        }>
        error: string | null
      }>
      appliedStemCount: number
      errorCount: number
    }>
  },

  async importGenerated(sectionId: string, stems: Array<Record<string, unknown>>) {
    const response = await fetch('/api/ucat/question-stems/generated/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sectionId, stems }),
    })
    if (!response.ok) {
      const body = await response.json().catch(() => ({}))
      throw new Error(body.error ?? 'Failed to import generated question stems')
    }
    return response.json() as Promise<{ ids: string[] }>
  },

  async setStatus(stemId: string, status: UcatContentStatus) {
    return this.bulkSetStatus([stemId], status)
  },

  async bulkSetStatus(stemIds: string[], status: UcatContentStatus) {
    const response = await fetch('/api/ucat/content-status', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contentType: 'stem', contentIds: stemIds, status }),
    })
    if (!response.ok) {
      await throwUcatLifecycleResponseError(response, 'Failed to update question status')
    }
  },

  async bulkRestoreStatus(stemIds: string[], currentStatus: UcatContentStatus, previousStatus: UcatContentStatus) {
    const response = await fetch('/api/ucat/content-status', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contentType: 'stem', contentIds: stemIds, status: currentStatus, previousStatus }),
    })
    if (!response.ok) {
      await throwUcatLifecycleResponseError(response, 'Failed to restore question status')
    }
  },
}

/** Ensure we send actual null for DB, never the string "null". */
function toJsonOrNull(value: unknown): Json | null {
  if (value == null) return null
  if (typeof value === 'string' && value === 'null') return null
  return value as Json
}

function stemDetailToBundlePayload(
  detail: StemDetailRow,
  getTagIds: (q: StemDetailQuestion, index: number) => string[]
): UcatQuestionStemBundlePayload {
  const questions = (detail.questions ?? []) as StemDetailQuestion[]
  return {
    stemId: detail.id,
    sectionId: detail.section_id,
    categoryId: detail.question_stem_category_id ?? null,
    stemText: detail.stem_text ?? {},
    accessScope: detail.access_scope,
    sourceChannel: detail.source_channel ?? null,
    tutorSourceNote: detail.tutor_source_note ?? null,
    questions: questions.map((q, i) => ({
      index: q.index,
      id: q.id,
      questionText: q.question_text ?? {},
      questionType: q.question_type ?? 'multiple_choice',
      answerExplanation: toJsonOrNull(q.answer_explanation),
      difficulty: q.difficulty ?? null,
      timeBurdenSeconds: q.time_burden_seconds ?? null,
      sourceChannel: q.source_channel ?? detail.source_channel ?? null,
      aiGenerationMetadata: q.ai_generation_metadata ?? null,
      tagIds: getTagIds(q, i),
      options: (q.answer_options ?? []).map((opt) => ({
        id: opt.id,
        index: opt.index,
        answerText: opt.answer_text ?? {},
        answerExplanation: toJsonOrNull(opt.answer_explanation),
        isAnswer: opt.is_answer,
      })),
    })),
  }
}

function serializePayload(payload: UcatQuestionStemBundlePayload) {
  return {
    stemId: payload.stemId ?? null,
    sectionId: payload.sectionId,
    categoryId: payload.categoryId ?? null,
    stemText: payload.stemText,
    accessScope: payload.accessScope,
    sourceChannel: payload.sourceChannel ?? null,
    tutorSourceNote: payload.tutorSourceNote ?? null,
    questions: payload.questions.map((question) => ({
      index: question.index,
      id: question.id ?? null,
      question_text: question.questionText,
      answer_explanation: toJsonOrNull(question.answerExplanation),
      difficulty: question.difficulty ?? null,
      time_burden_seconds: question.timeBurdenSeconds ?? null,
      question_type: question.questionType,
      source_channel: question.sourceChannel ?? payload.sourceChannel ?? null,
      ai_generation_metadata: question.aiGenerationMetadata ?? null,
      tag_ids: question.tagIds,
      answer_options: question.options.map((option) => ({
        id: option.id ?? null,
        index: option.index,
        answer_text: option.answerText,
        answer_explanation: toJsonOrNull(option.answerExplanation),
        is_answer: option.isAnswer,
      })),
    })),
  }
}
