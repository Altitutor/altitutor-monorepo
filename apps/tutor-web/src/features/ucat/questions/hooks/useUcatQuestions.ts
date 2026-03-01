import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ucatKeys } from '@/features/ucat/shared/lib/query-keys'
import { ucatQuestionsApi } from '@/features/ucat/questions/api/questions'
import type { UcatQuestionStemBundlePayload } from '@/features/ucat/shared/types'
import { proseMirrorToPlainText } from '@/features/ucat/shared/lib/rich-text'

export function useUcatQuestions() {
  return useQuery({ queryKey: ucatKeys.questions(), queryFn: ucatQuestionsApi.list })
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
}

export function useUcatStemCatalog(enabled: boolean) {
  return useQuery({
    queryKey: ucatKeys.stemCatalog(),
    queryFn: async () => {
      const rows = await ucatQuestionsApi.getStemCatalog()
      return rows.map((row) => ({
        id: row.id ?? '',
        text: proseMirrorToPlainText(row.stem_text),
        questionsCount: Array.isArray(row.questions)
          ? (row.questions as Array<{ deleted_at?: string | null }>).filter((q) => !q.deleted_at).length
          : 0,
        sectionName: row.section_name ?? 'Unknown section',
        sectionNumber: row.section_number ?? 0,
        sectionId: row.section_id ?? null,
        categoryId: row.question_stem_category_id ?? null,
        categoryName: row.category_name ?? null,
        isPrivate: !!row.is_private,
        questionTypes: Array.isArray(row.questions)
          ? Array.from(
              new Set(
                (row.questions as Array<{ question_type?: string | null }>).flatMap((q) =>
                  q.question_type === 'multiple_choice' || q.question_type === 'syllogism' ? [q.question_type] : []
                )
              )
            )
          : [],
      }))
    },
    enabled,
  })
}

export function useCreateUcatQuestionStem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: UcatQuestionStemBundlePayload) => ucatQuestionsApi.create(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ucatKeys.questions() }),
  })
}

export function useUpdateUcatQuestionStem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ stemId, payload }: { stemId: string; payload: UcatQuestionStemBundlePayload }) =>
      ucatQuestionsApi.update(stemId, payload),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ucatKeys.questions() })
      queryClient.invalidateQueries({ queryKey: ucatKeys.question(variables.stemId) })
      queryClient.invalidateQueries({ queryKey: ucatKeys.stemCatalog() })
    },
  })
}

export function useDeleteUcatQuestionStem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (stemId: string) => ucatQuestionsApi.remove(stemId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ucatKeys.questions() }),
  })
}

export function useRestoreUcatQuestionStem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (stemId: string) => ucatQuestionsApi.restore(stemId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ucatKeys.questions() }),
  })
}

export function useBulkImportUcatQuestionStems() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (args: { sectionId: string; stems: UcatQuestionStemBundlePayload[] }) =>
      ucatQuestionsApi.bulkImport(args.sectionId, args.stems),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ucatKeys.questions() })
      queryClient.invalidateQueries({ queryKey: ucatKeys.stemCatalog() })
    },
  })
}
