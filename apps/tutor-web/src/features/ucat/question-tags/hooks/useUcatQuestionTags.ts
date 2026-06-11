import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ucatKeys } from '@/features/ucat/shared/lib/query-keys'
import { ucatQuestionTagsApi, type UcatQuestionTagPayload } from '@/features/ucat/question-tags/api/question-tags'

export function useUcatQuestionTags() {
  return useQuery({ queryKey: ucatKeys.tags(), queryFn: ucatQuestionTagsApi.list })
}

export function useCreateUcatQuestionTag() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: UcatQuestionTagPayload) => ucatQuestionTagsApi.create(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ucatKeys.tags() }),
  })
}

export function useUpdateUcatQuestionTag() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UcatQuestionTagPayload }) =>
      ucatQuestionTagsApi.update(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ucatKeys.tags() }),
  })
}

export function useDeleteUcatQuestionTag() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => ucatQuestionTagsApi.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ucatKeys.tags() }),
  })
}

export function useUcatTagLinkedQuestions(tagId: string | null) {
  return useQuery({
    queryKey: ucatKeys.tagQuestions(tagId ?? ''),
    queryFn: () => ucatQuestionTagsApi.listLinkedQuestions(tagId ?? ''),
    enabled: Boolean(tagId),
  })
}
