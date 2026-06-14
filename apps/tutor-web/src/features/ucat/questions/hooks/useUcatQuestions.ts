import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ucatKeys } from '@/features/ucat/shared/lib/query-keys'
import { ucatQuestionsApi } from '@/features/ucat/questions/api/questions'
import { ucatAiImportApi } from '@/features/ucat/questions/api/ai-import'
import type { UcatQuestionStemBundlePayload } from '@/features/ucat/shared/types'
import { proseMirrorToPlainText } from '@/features/ucat/shared/lib/rich-text'
import type { UcatApprovalStatus, UcatQuestionListMode } from '@/features/ucat/questions/api/questions'
import type { Json } from '@altitutor/shared'
import type {
  AiImportDraftStemPayload,
  AiImportSectionKey,
} from '@/features/ucat/questions/lib/ai-import/schema'

export function useUcatQuestions(options?: {
  mode?: UcatQuestionListMode
  sectionId?: string | null
  categoryId?: string | null
  approvalStatus?: UcatApprovalStatus | null
}) {
  return useQuery({
    queryKey: ucatKeys.questions(options?.mode ?? 'default'),
    queryFn: () => ucatQuestionsApi.list(options),
  })
}

export function useUcatQuestionDetail(stemId: string | null) {
  return useQuery({
    queryKey: stemId ? ucatKeys.question(stemId) : [...ucatKeys.questions(), 'empty'],
    queryFn: () => ucatQuestionsApi.getDetail(stemId as string),
    enabled: !!stemId,
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

export function useUcatQuestionStemTypes() {
  return useQuery({
    queryKey: ucatKeys.questionStemTypes(),
    queryFn: () => ucatQuestionsApi.getStemTypes(),
  })
}

export function useUcatStemTagIds() {
  return useQuery({
    queryKey: ucatKeys.questionStemTagIds(),
    queryFn: () => ucatQuestionsApi.getStemTagIds(),
  })
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
  isPrivate: boolean
  questionTypes: ('multiple_choice' | 'syllogism')[]
  tagIds: string[]
  createdAt: string | null
}

export type UcatQuestionCatalogItem = {
  id: string
  label: string
  stemId: string
  sectionName: string
  questionType: string
}

export function useUcatQuestionCatalog(enabled: boolean) {
  return useQuery({
    queryKey: ucatKeys.questionCatalog(),
    queryFn: async () => {
      const rows = await ucatQuestionsApi.getStemCatalog()
      const items: UcatQuestionCatalogItem[] = []

      for (const row of rows) {
        if (!row.id) continue
        const stemText = proseMirrorToPlainText(row.stem_text)
        const stemPreview = stemText.length > 36 ? `${stemText.slice(0, 33)}…` : stemText
        const questions = Array.isArray(row.questions)
          ? (row.questions as Array<{
              id?: string
              deleted_at?: string | null
              question_type?: string | null
              index?: number | null
            }>)
          : []

        for (const question of questions) {
          if (!question.id || question.deleted_at) continue
          const questionIndex = (question.index ?? 0) + 1
          items.push({
            id: question.id,
            label: `${stemPreview} · Q${questionIndex} (${question.question_type ?? 'unknown'})`,
            stemId: row.id,
            sectionName: row.section_name ?? 'Unknown section',
            questionType: question.question_type ?? 'unknown',
          })
        }
      }

      return items
    },
    enabled,
  })
}

export function useUcatStemCatalog(enabled: boolean) {
  return useQuery({
    queryKey: ucatKeys.stemCatalog(),
    queryFn: async () => {
      const rows = await ucatQuestionsApi.getStemCatalog()
      return rows.map((row) => {
        const activeQuestions = Array.isArray(row.questions)
          ? (row.questions as Array<{
              deleted_at?: string | null
              question_type?: string | null
              tags?: Array<{ id?: string | null }> | null
            }>).filter((q) => !q.deleted_at)
          : []
        const tagIds = new Set<string>()
        for (const question of activeQuestions) {
          const tags = Array.isArray(question.tags) ? question.tags : []
          for (const tag of tags) {
            if (tag.id) tagIds.add(tag.id)
          }
        }
        return {
          id: row.id ?? '',
          text: proseMirrorToPlainText(row.stem_text),
          questionsCount: activeQuestions.length,
          sectionName: row.section_name ?? 'Unknown section',
          sectionNumber: row.section_number ?? 0,
          sectionId: row.section_id ?? null,
          categoryId: row.question_stem_category_id ?? null,
          categoryName: row.category_name ?? null,
          isPrivate: !!row.is_private,
          questionTypes: Array.from(
            new Set(
              activeQuestions.flatMap((q) =>
                q.question_type === 'multiple_choice' || q.question_type === 'syllogism' ? [q.question_type] : []
              )
            )
          ) as ('multiple_choice' | 'syllogism')[],
          tagIds: Array.from(tagIds),
          createdAt: row.created_at ?? null,
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
      queryClient.invalidateQueries({ queryKey: ucatKeys.questions('default') })
      queryClient.invalidateQueries({ queryKey: ucatKeys.questions('generated') })
      queryClient.invalidateQueries({ queryKey: ucatKeys.questionStemTagIds() })
    },
  })
}

export function useUpdateUcatQuestionStem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ stemId, payload }: { stemId: string; payload: UcatQuestionStemBundlePayload }) =>
      ucatQuestionsApi.update(stemId, payload),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ucatKeys.questions('default') })
      queryClient.invalidateQueries({ queryKey: ucatKeys.questions('generated') })
      queryClient.invalidateQueries({ queryKey: ucatKeys.question(variables.stemId) })
      queryClient.invalidateQueries({ queryKey: ucatKeys.stemCatalog() })
      queryClient.invalidateQueries({ queryKey: ucatKeys.questionStemTagIds() })
    },
  })
}

export function useDeleteUcatQuestionStem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (stemId: string) => ucatQuestionsApi.remove(stemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ucatKeys.questions('default') })
      queryClient.invalidateQueries({ queryKey: ucatKeys.questions('generated') })
      queryClient.invalidateQueries({ queryKey: ucatKeys.questionStemTagIds() })
    },
  })
}

export function useRestoreUcatQuestionStem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (stemId: string) => ucatQuestionsApi.restore(stemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ucatKeys.questions('default') })
      queryClient.invalidateQueries({ queryKey: ucatKeys.questions('generated') })
    },
  })
}

export function useBulkImportUcatQuestionStems() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (args: { sectionId: string; stems: UcatQuestionStemBundlePayload[] }) =>
      ucatQuestionsApi.bulkImport(args.sectionId, args.stems),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ucatKeys.questions('default') })
      queryClient.invalidateQueries({ queryKey: ucatKeys.questions('generated') })
      queryClient.invalidateQueries({ queryKey: ucatKeys.stemCatalog() })
      queryClient.invalidateQueries({ queryKey: ucatKeys.questionStemTagIds() })
    },
  })
}

export function useGenerateUcatQuestionDrafts() {
  return useMutation({
    mutationFn: (args: {
      sectionId: string
      categoryId?: string | null
      profileId?: string | null
      sourceMode: 'none' | 'random' | 'selected'
      sourceStemIds?: string[]
      stemCount: number
      difficultyTarget: 'easy' | 'medium' | 'hard' | 'mixed'
      timeBurdenTarget: 'low' | 'medium' | 'high' | 'mixed'
      targetTagIds: string[]
      runInstructions?: string | null
    }) => ucatQuestionsApi.generateDrafts(args),
  })
}

export function useUcatGenerationProfiles(enabled: boolean) {
  return useQuery({
    queryKey: [...ucatKeys.questions(), 'generation-profiles'],
    queryFn: () => ucatQuestionsApi.getGenerationProfiles(),
    enabled,
  })
}

export function useImportGeneratedUcatQuestionStems() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (args: { sectionId: string; stems: Array<Record<string, unknown>> }) =>
      ucatQuestionsApi.importGenerated(args.sectionId, args.stems),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ucatKeys.questions('generated') })
      queryClient.invalidateQueries({ queryKey: ucatKeys.questions('default') })
      queryClient.invalidateQueries({ queryKey: ucatKeys.stemCatalog() })
      queryClient.invalidateQueries({ queryKey: ucatKeys.questionStemTagIds() })
    },
  })
}

export function useSetUcatQuestionStemApprovalStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ stemId, status }: { stemId: string; status: UcatApprovalStatus }) =>
      ucatQuestionsApi.setApprovalStatus(stemId, status),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ucatKeys.questions('generated') })
      queryClient.invalidateQueries({ queryKey: ucatKeys.questions('default') })
      queryClient.invalidateQueries({ queryKey: ucatKeys.question(variables.stemId) })
    },
  })
}

export function useExtractAiImportQuestionDrafts() {
  return useMutation({
    mutationFn: (args: {
      sectionId: string
      document: Json | null
      expectedQuestionCount?: number | null
    }) => ucatAiImportApi.extract(args),
  })
}

export function useGenerateMissingAiImportAnswers() {
  return useMutation({
    mutationFn: (args: { section: AiImportSectionKey; stems: AiImportDraftStemPayload[] }) =>
      ucatAiImportApi.generateMissing(args),
  })
}

export function useRunAiImportQc() {
  return useMutation({
    mutationFn: (args: { section: AiImportSectionKey; stems: AiImportDraftStemPayload[] }) =>
      ucatAiImportApi.runQc(args),
  })
}
