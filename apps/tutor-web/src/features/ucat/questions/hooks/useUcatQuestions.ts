import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ucatKeys } from '@/features/ucat/shared/lib/query-keys'
import { ucatQuestionsApi } from '@/features/ucat/questions/api/questions'
import type { UcatQuestionStemBundlePayload } from '@/features/ucat/shared/types'

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
