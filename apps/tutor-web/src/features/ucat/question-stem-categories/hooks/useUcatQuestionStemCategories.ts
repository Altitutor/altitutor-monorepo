import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ucatKeys } from '@/features/ucat/shared/lib/query-keys'
import { ucatQuestionStemCategoriesApi, type UcatQuestionStemCategoryPayload } from '@/features/ucat/question-stem-categories/api/question-stem-categories'

export function useUcatQuestionStemCategories() {
  return useQuery({ queryKey: ucatKeys.categories(), queryFn: ucatQuestionStemCategoriesApi.list })
}

export function useCreateUcatQuestionStemCategory() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: UcatQuestionStemCategoryPayload) => ucatQuestionStemCategoriesApi.create(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ucatKeys.categories() }),
  })
}

export function useUpdateUcatQuestionStemCategory() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UcatQuestionStemCategoryPayload }) =>
      ucatQuestionStemCategoriesApi.update(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ucatKeys.categories() }),
  })
}

export function useDeleteUcatQuestionStemCategory() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => ucatQuestionStemCategoriesApi.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ucatKeys.categories() }),
  })
}
