import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ucatKeys } from '@/features/ucat/shared/lib/query-keys'
import { ucatQuestionsApi } from '@/features/ucat/questions/api/questions'
import type { UcatAccessScope, UcatContentStatus, UcatQuestionStemBundlePayload } from '@/features/ucat/shared/types'
import { proseMirrorToPlainText } from '@/features/ucat/shared/lib/rich-text'
import type { Json } from '@altitutor/shared'
import type { QuestionCatalogQuery } from '@/features/ucat/questions/lib/question-catalog-query'
import { getAnswerSchemePresentation } from '@altitutor/ucat-response-contract'
import type { BlueprintStem } from '@altitutor/ucat-blueprint'

function parseStemCatalogSetIds(value: unknown): string[] {
  if (value == null || !Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string')
}

function parseStemCatalogSetNames(value: unknown): string {
  if (value == null || !Array.isArray(value)) return '—'
  const names = value
    .map((item) => proseMirrorToPlainText(item as Json))
    .filter(Boolean)
  return names.length > 0 ? names.join(', ') : '—'
}

export function useUcatQuestions(options?: {
  status?: UcatContentStatus | null
  sourceChannel?: 'individual' | 'bulk_import' | 'ai_generation' | null
  sectionId?: string | null
  categoryId?: string | null
}) {
  return useQuery({
    queryKey: [...ucatKeys.questions('all'), options ?? {}],
    queryFn: () => ucatQuestionsApi.list(options),
  })
}

export function useUcatQuestionCatalogPage(query: QuestionCatalogQuery) {
  return useQuery({
    queryKey: ucatKeys.questionCatalogPage(query),
    queryFn: () => ucatQuestionsApi.listCatalog(query),
    placeholderData: (previous) => previous,
  })
}

export function useUcatQuestionCatalogCreators() {
  return useQuery({
    queryKey: ucatKeys.questionCatalogCreators(),
    queryFn: () => ucatQuestionsApi.getCatalogCreators(),
    staleTime: 5 * 60 * 1000,
  })
}

export function useUcatQuestionDetail(stemId: string | null) {
  return useQuery({
    queryKey: stemId ? ucatKeys.question(stemId) : [...ucatKeys.questions(), 'empty'],
    queryFn: () => ucatQuestionsApi.getDetail(stemId as string),
    enabled: !!stemId,
  })
}

export function useUcatAiAssessment(stemId: string | null) {
  return useQuery({
    queryKey: stemId ? ucatKeys.aiAssessment(stemId) : [...ucatKeys.questions(), 'ai-assessment', 'empty'],
    queryFn: () => ucatQuestionsApi.getAiAssessment(stemId as string),
    enabled: !!stemId,
    refetchInterval: (query) => {
      const status = query.state.data?.status
      return status === 'reviewing' || status === 'deferred' ? 5_000 : false
    },
  })
}

export function useUcatAiAssessmentStatuses(stemIds: string[]) {
  return useQuery({
    queryKey: ucatKeys.aiAssessmentStatuses(stemIds),
    queryFn: () => ucatQuestionsApi.getAiAssessmentStatuses(stemIds),
    enabled: stemIds.length > 0,
    refetchInterval: (query) => Object.values(query.state.data?.statuses ?? {})
      .some((status) => status === 'reviewing' || status === 'deferred')
      ? 5_000
      : false,
  })
}

export function useRetryUcatAiAssessment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ stemId, runId }: { stemId: string; runId: string }) =>
      ucatQuestionsApi.retryAiAssessment(stemId, runId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ucatKeys.aiAssessment(variables.stemId) })
    },
  })
}

export function useRequestUcatAiAssessment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ stemId, force }: { stemId: string; force?: boolean }) =>
      ucatQuestionsApi.requestAiAssessment(stemId, { force }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ucatKeys.aiAssessment(variables.stemId) })
      queryClient.invalidateQueries({
        queryKey: [...ucatKeys.questions('all'), 'ai-assessment-statuses'],
      })
      queryClient.invalidateQueries({ queryKey: ucatKeys.questions() })
    },
  })
}

export function useRecordUcatAiAssessmentDecision() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ stemId, ...input }: {
      stemId: string
      runId: string
      findingKey: string
      decision: 'dismissed' | 'suggestion_accepted' | 'suggestion_rejected'
      reason?: string | null
    }) => ucatQuestionsApi.recordAiAssessmentDecision(stemId, input),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ucatKeys.aiAssessment(variables.stemId) })
    },
  })
}

export function useUcatSections() {
  return useQuery({ queryKey: ucatKeys.sections(), queryFn: ucatQuestionsApi.getSections })
}

export function useUcatCategories() {
  return useQuery({ queryKey: ucatKeys.categories(), queryFn: ucatQuestionsApi.getCategories })
}

export function useUcatTags() {
  return useQuery({ queryKey: ucatKeys.tags(), queryFn: ucatQuestionsApi.getTags })
}

export function useUcatQuestionStemListIndex() {
  return useQuery({
    queryKey: ucatKeys.questionStemListIndex(),
    queryFn: () => ucatQuestionsApi.getStemListIndex(),
  })
}

/** @deprecated Prefer useUcatQuestionStemListIndex — shares the same cached fetch. */
export function useUcatStemTagIds() {
  const query = useUcatQuestionStemListIndex()
  return { ...query, data: query.data?.tagIds }
}

/** @deprecated Prefer useUcatQuestionStemListIndex — shares the same cached fetch. */
export function useUcatQuestionSearchTexts() {
  const query = useUcatQuestionStemListIndex()
  return { ...query, data: query.data?.searchTexts }
}

export type UcatStemCatalogItem = {
  id: string
  text: string
  questionsCount: number
  sectionName: string
  sectionNumber: number
  sectionId: string | null
  categoryId: string | null
  categoryName: string | null
  accessScope: UcatAccessScope
  status: UcatContentStatus
  sourceChannel: 'individual' | 'bulk_import' | 'ai_generation' | null
  responseTypes?: ('multiple_choice' | 'drag_and_drop')[]
  answerSchemes?: string[]
  blueprintQuestions?: BlueprintStem['questions']
  tagIds: string[]
  createdAt: string | null
  questionSearchText: string
  answerOptionSearchText: string
  setNames: string
  setIds: string[]
  typeSummary: string
}

export type UcatQuestionCatalogItem = {
  id: string
  label: string
  stemId: string
  questionIndex: number
  sectionName: string
  responseType: 'multiple_choice' | 'drag_and_drop'
  answerScheme: string
}

export function useUcatQuestionCatalog(enabled: boolean) {
  return useQuery({
    queryKey: ucatKeys.questionCatalog(),
    queryFn: async () => {
      const rows = await ucatQuestionsApi.getStemCatalog({ publishedOnly: true })
      const items: UcatQuestionCatalogItem[] = []

      for (const row of rows) {
        if (!row.id) continue
        const stemText = proseMirrorToPlainText(row.stem_text)
        const stemPreview = stemText.length > 36 ? `${stemText.slice(0, 33)}…` : stemText
        const questions = Array.isArray(row.questions)
          ? (row.questions as Array<{
              id?: string
              deleted_at?: string | null
              response_type?: string | null
              answer_scheme?: string | null
              index?: number | null
            }>)
          : []

        for (const question of questions) {
          if (!question.id || question.deleted_at) continue
          const questionIndex = question.index ?? 0
          items.push({
            id: question.id,
            label: `${stemPreview} · Q${questionIndex + 1} (${question.answer_scheme ?? 'unknown'})`,
            stemId: row.id,
            questionIndex,
            sectionName: row.section_name ?? 'Unknown section',
            responseType: question.response_type === 'drag_and_drop' ? 'drag_and_drop' : 'multiple_choice',
            answerScheme: question.answer_scheme ?? 'unknown',
          })
        }
      }

      return items
    },
    enabled,
  })
}

export function useUcatStemCatalog(
  enabled: boolean,
  options?: { publishedOnly?: boolean; lite?: boolean },
) {
  const publishedOnly = options?.publishedOnly ?? false
  const lite = options?.lite ?? false
  return useQuery({
    queryKey: [...ucatKeys.stemCatalog(), publishedOnly ? 'published' : 'all', lite ? 'lite' : 'full'],
    queryFn: async () => {
      const rows = await ucatQuestionsApi.getStemCatalog({ publishedOnly })
      return rows.map((row) => {
        const activeQuestions = Array.isArray(row.questions)
          ? (row.questions as Array<{
              deleted_at?: string | null
              response_type?: string | null
              answer_scheme?: string | null
              id?: string | null
              question_text?: Json | null
              tags?: Array<{ id?: string | null }> | null
              answer_options?: Array<{ id?: string | null; deleted_at?: string | null }> | null
            }>).filter((q) => !q.deleted_at)
          : []
        const tagIds = new Set<string>()
        const questionTexts: string[] = []
        const answerOptionTexts: string[] = []
        for (const question of activeQuestions) {
          const tags = Array.isArray(question.tags) ? question.tags : []
          for (const tag of tags) {
            if (tag.id) tagIds.add(tag.id)
          }
          if (!lite) {
            const questionText = proseMirrorToPlainText(question.question_text)
            if (questionText) questionTexts.push(questionText)
            const answerOptions = Array.isArray(
              (question as { answer_options?: Array<{ deleted_at?: string | null; answer_text?: Json | null }> })
                .answer_options,
            )
              ? (question as { answer_options: Array<{ deleted_at?: string | null; answer_text?: Json | null }> })
                  .answer_options
              : []
            for (const option of answerOptions) {
              if (option.deleted_at) continue
              const answerText = proseMirrorToPlainText(option.answer_text)
              if (answerText) answerOptionTexts.push(answerText)
            }
          }
        }
        const responseTypes = Array.from(new Set(activeQuestions.flatMap((question) => (
          question.response_type === 'multiple_choice' || question.response_type === 'drag_and_drop'
            ? [question.response_type]
            : []
        )))) as ('multiple_choice' | 'drag_and_drop')[]
        const answerSchemes = Array.from(new Set(activeQuestions.flatMap((question) => (
          typeof question.answer_scheme === 'string' ? [question.answer_scheme] : []
        ))))
        const blueprintQuestions: BlueprintStem['questions'] = activeQuestions.flatMap((question, questionIndex) => {
          if (
            question.answer_scheme !== 'single_choice'
            && question.answer_scheme !== 'situational_judgement_rating'
            && question.answer_scheme !== 'decision_making_binary_placement'
            && question.answer_scheme !== 'situational_judgement_most_least'
          ) return []
          const optionIds = (question.answer_options ?? [])
            .filter(option => !option.deleted_at)
            .map((option, optionIndex) => option.id ?? `${row.id}-q${questionIndex}-o${optionIndex}`)
          const presentation = getAnswerSchemePresentation(question.answer_scheme, optionIds)
          return [{
            id: question.id ?? `${row.id}-question-${questionIndex}`,
            answerScheme: question.answer_scheme,
            optionCount: optionIds.length,
            requiredPlacementCount: presentation.kind === 'placement' ? presentation.requiredPlacements : 0,
          }]
        })
        const setIds = parseStemCatalogSetIds((row as { set_ids?: unknown }).set_ids)
        const setNames = parseStemCatalogSetNames((row as { set_names?: unknown }).set_names)

        return {
          id: row.id ?? '',
          text: proseMirrorToPlainText(row.stem_text),
          questionsCount: activeQuestions.length,
          sectionName: row.section_name ?? 'Unknown section',
          sectionNumber: row.section_number ?? 0,
          sectionId: row.section_id ?? null,
          categoryId: row.question_stem_category_id ?? null,
          categoryName: row.category_name ?? null,
          accessScope: row.access_scope,
          status: row.status,
          sourceChannel: row.source_channel,
          responseTypes,
          answerSchemes,
          blueprintQuestions,
          tagIds: Array.from(tagIds),
          createdAt: row.created_at ?? null,
          questionSearchText: questionTexts.join(' '),
          answerOptionSearchText: answerOptionTexts.join(' '),
          setIds,
          setNames,
          typeSummary: answerSchemes.length > 0 ? answerSchemes.join(', ') : '-',
        }
      })
    },
    enabled,
  })
}

export function useCreateUcatQuestionStem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: UcatQuestionStemBundlePayload) => ucatQuestionsApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ucatKeys.questions('all') })
    },
  })
}

export function useUpdateUcatQuestionStem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      stemId,
      payload,
      requestAssessment,
      expectedUpdatedAt,
    }: {
      stemId: string
      payload: UcatQuestionStemBundlePayload
      requestAssessment?: boolean
      expectedUpdatedAt?: string | null
      invalidate?: boolean
    }) => ucatQuestionsApi.update(stemId, payload, { requestAssessment, expectedUpdatedAt }),
    onSuccess: (_, variables) => {
      if (variables.invalidate === false) return
      queryClient.invalidateQueries({ queryKey: ucatKeys.questions('all') })
      queryClient.invalidateQueries({ queryKey: ucatKeys.question(variables.stemId) })
      queryClient.invalidateQueries({ queryKey: ucatKeys.aiAssessment(variables.stemId) })
      queryClient.invalidateQueries({ queryKey: ['ucat', 'explanation-feedback', variables.stemId] })
      queryClient.invalidateQueries({ queryKey: ucatKeys.reconciliation() })
    },
  })
}

export function useDeleteUcatQuestionStem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (stemId: string) => ucatQuestionsApi.remove(stemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ucatKeys.questions('all') })
      queryClient.invalidateQueries({ queryKey: ucatKeys.reconciliation() })
    },
  })
}

export function useRestoreUcatQuestionStem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (stemId: string) => ucatQuestionsApi.restore(stemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ucatKeys.questions('all') })
    },
  })
}

export function useBulkImportUcatQuestionStems() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (args: {
      sectionId: string
      stems: Array<UcatQuestionStemBundlePayload & { importStatus: 'draft' | 'in_review' }>
    }) => ucatQuestionsApi.bulkImport(args.sectionId, args.stems),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ucatKeys.questions('all') })
    },
  })
}

export function useStartUcatQuestionGeneration() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (args: {
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
    }) => ucatQuestionsApi.startGeneration(args),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...ucatKeys.questions(), 'generation-runs'] })
    },
  })
}

export function useUcatGenerationModelProfiles(enabled: boolean) {
  return useQuery({
    queryKey: [...ucatKeys.questions(), 'generation-model-profiles'],
    queryFn: () => ucatQuestionsApi.getGenerationModelProfiles(),
    enabled,
  })
}

export function useUcatGenerationRuns(enabled = true) {
  return useQuery({
    queryKey: [...ucatKeys.questions(), 'generation-runs'],
    queryFn: () => ucatQuestionsApi.getGenerationRuns(),
    enabled,
    refetchInterval: (query) =>
      query.state.data?.some((run) => run.status === 'running') ? 1_500 : 10_000,
  })
}

export function useDismissUcatGenerationRun() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (runId: string) => ucatQuestionsApi.dismissGenerationRun(runId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...ucatKeys.questions(), 'generation-runs'] })
    },
  })
}

export function useImportGeneratedUcatQuestionStems() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (args: { sectionId: string; stems: Array<Record<string, unknown>> }) =>
      ucatQuestionsApi.importGenerated(args.sectionId, args.stems),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ucatKeys.questions('all') })
    },
  })
}

export function useSetUcatQuestionStemStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      stemId,
      status,
    }: {
      stemId: string
      status: UcatContentStatus
      invalidate?: boolean
    }) => ucatQuestionsApi.setStatus(stemId, status),
    onSuccess: (_, variables) => {
      if (variables.invalidate === false) return
      queryClient.invalidateQueries({ queryKey: ucatKeys.questions('all') })
      queryClient.invalidateQueries({ queryKey: ucatKeys.question(variables.stemId) })
      queryClient.invalidateQueries({ queryKey: ucatKeys.aiAssessment(variables.stemId) })
      queryClient.invalidateQueries({ queryKey: ucatKeys.reconciliation() })
    },
  })
}
