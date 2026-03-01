import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ucatKeys } from '@/features/ucat/shared/lib/query-keys'
import { ucatSetsApi } from '@/features/ucat/sets/api/sets'
import type { UcatQuestionSetPayload } from '@/features/ucat/shared/types'

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
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ucatKeys.sets() }),
  })
}

export function useUpdateUcatSet() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ setId, payload }: { setId: string; payload: UcatQuestionSetPayload }) =>
      ucatSetsApi.update(setId, payload),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ucatKeys.sets() })
      queryClient.invalidateQueries({ queryKey: ucatKeys.set(variables.setId) })
    },
  })
}

export function useDeleteUcatSet() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (setId: string) => ucatSetsApi.remove(setId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ucatKeys.sets() }),
  })
}

export function useRestoreUcatSet() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (setId: string) => ucatSetsApi.restore(setId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ucatKeys.sets() }),
  })
}
