import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ucatKeys } from '@/features/ucat/shared/lib/query-keys'
import { fetchReconciliationData } from '../api/reconciliation'
import { ucatQuestionsApi } from '@/features/ucat/questions/api/questions'

export function useReconciliationData() {
  return useQuery({
    queryKey: ucatKeys.reconciliation(),
    queryFn: fetchReconciliationData,
  })
}

export function useSetStemCategory() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ stemId, categoryId }: { stemId: string; categoryId: string }) =>
      ucatQuestionsApi.bulkUpdateMetadata([stemId], { categoryId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ucatKeys.reconciliation() })
      queryClient.invalidateQueries({ queryKey: ucatKeys.questions() })
      queryClient.invalidateQueries({ queryKey: ucatKeys.stemCatalog() })
    },
  })
}
