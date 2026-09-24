import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { ucatKeys } from '@/features/ucat/shared/lib/query-keys'
import { ucatSetsApi } from '@/features/ucat/sets/api/sets'
import type { UcatContentStatus, UcatQuestionSetPayload } from '@/features/ucat/shared/types'

function invalidateSetMembershipCatalogQueries(queryClient: QueryClient) {
  void queryClient.invalidateQueries({ queryKey: ucatKeys.stemCatalog() })
  void queryClient.invalidateQueries({ queryKey: ucatKeys.questions('all') })
}

export function useUcatSets() {
  return useQuery({ queryKey: ucatKeys.sets(), queryFn: ucatSetsApi.list })
}

export function useUcatSetDetail(setId: string | null) {
  return useQuery({
    queryKey: setId ? ucatKeys.set(setId) : [...ucatKeys.sets(), 'empty'],
    queryFn: () => ucatSetsApi.detail(setId as string),
    enabled: !!setId,
  })
}

export function useCreateUcatSet() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: UcatQuestionSetPayload) => ucatSetsApi.create(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ucatKeys.sets() })
      invalidateSetMembershipCatalogQueries(queryClient)
    },
  })
}

export function useUpdateUcatSet() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ setId, payload }: { setId: string; payload: UcatQuestionSetPayload }) =>
      ucatSetsApi.update(setId, payload),
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({ queryKey: ucatKeys.sets() })
      void queryClient.invalidateQueries({ queryKey: ucatKeys.set(variables.setId) })
      invalidateSetMembershipCatalogQueries(queryClient)
    },
  })
}

export function useSetUcatSetStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ setId, status }: { setId: string; status: UcatContentStatus }) =>
      ucatSetsApi.setStatus(setId, status),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ucatKeys.sets() })
      queryClient.invalidateQueries({ queryKey: ucatKeys.set(variables.setId) })
      queryClient.invalidateQueries({ queryKey: ucatKeys.reconciliation() })
    },
  })
}

export function useDeleteUcatSet() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (setId: string) => ucatSetsApi.remove(setId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ucatKeys.sets() })
      invalidateSetMembershipCatalogQueries(queryClient)
    },
  })
}

export function useRestoreUcatSet() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (setId: string) => ucatSetsApi.restore(setId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ucatKeys.sets() })
      invalidateSetMembershipCatalogQueries(queryClient)
    },
  })
}
