import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ucatKeys } from '@/features/ucat/shared/lib/query-keys'
import {
  fetchExactDuplicateStems,
  fetchPrivateStemsNotInSet,
  fetchReconciliationData,
  type ReconciliationQueueQuery,
} from '../api/reconciliation'
import { ucatQuestionsApi } from '@/features/ucat/questions/api/questions'

export function useReconciliationData() {
  return useQuery({
    queryKey: ucatKeys.reconciliation(),
    queryFn: fetchReconciliationData,
  })
}

export function usePrivateStemsNotInSetQueue(query: ReconciliationQueueQuery) {
  return useQuery({
    queryKey: ucatKeys.reconciliationQueue('private-stems-not-in-set', query),
    queryFn: () => fetchPrivateStemsNotInSet(query),
    placeholderData: (previous) => previous,
  })
}

export function useExactDuplicateStemsQueue(query: ReconciliationQueueQuery) {
  return useQuery({
    queryKey: ucatKeys.reconciliationQueue('exact-duplicates', query),
    queryFn: () => fetchExactDuplicateStems(query),
    placeholderData: (previous) => previous,
  })
}

export function useSetStemCategory() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ stemId, categoryId }: { stemId: string; categoryId: string }) =>
      ucatQuestionsApi.bulkUpdateMetadata([stemId], { categoryId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ucatKeys.reconciliation() })
      queryClient.invalidateQueries({ queryKey: ucatKeys.questions('all') })
      queryClient.invalidateQueries({ queryKey: ucatKeys.stemCatalog() })
    },
  })
}

export function useAddQuestionTag() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ stemId, questionId, tagId }: { stemId: string; questionId: string; tagId: string }) =>
      ucatQuestionsApi.addQuestionTag(stemId, questionId, tagId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ucatKeys.reconciliation() })
      queryClient.invalidateQueries({ queryKey: ucatKeys.questions('all') })
      queryClient.invalidateQueries({ queryKey: ucatKeys.question(variables.stemId) })
      queryClient.invalidateQueries({ queryKey: ucatKeys.stemCatalog() })
    },
  })
}

export function useAddQuestionTags() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ stemId, questionId, tagIds }: { stemId: string; questionId: string; tagIds: string[] }) =>
      ucatQuestionsApi.addQuestionTags(stemId, questionId, tagIds),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ucatKeys.reconciliation() })
      queryClient.invalidateQueries({ queryKey: ucatKeys.questions('all') })
      queryClient.invalidateQueries({ queryKey: ucatKeys.question(variables.stemId) })
      queryClient.invalidateQueries({ queryKey: ucatKeys.stemCatalog() })
    },
  })
}
