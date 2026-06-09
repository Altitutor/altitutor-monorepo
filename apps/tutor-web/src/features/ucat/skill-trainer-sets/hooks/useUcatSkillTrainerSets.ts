import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ucatSkillTrainerSetsApi } from '@/features/ucat/skill-trainer-sets/api/sets'
import type { UcatSkillTrainerSetUpsertPayload } from '@/features/ucat/skill-trainer-sets/types'
import { ucatKeys } from '@/features/ucat/shared/lib/query-keys'

export function useUcatSkillTrainerSets(options?: { trainerKey?: string }) {
  return useQuery({
    queryKey: ucatKeys.skillTrainerSets(options?.trainerKey),
    queryFn: () => ucatSkillTrainerSetsApi.list(options),
  })
}

export function useUcatSkillTrainerSet(setId: string | null) {
  return useQuery({
    queryKey: setId ? ucatKeys.skillTrainerSet(setId) : [...ucatKeys.skillTrainerSets(), 'empty'],
    queryFn: () => ucatSkillTrainerSetsApi.get(setId as string),
    enabled: !!setId,
  })
}

export function useUcatSkillTrainerSetItems(setId: string | null) {
  return useQuery({
    queryKey: setId ? ucatKeys.skillTrainerSetItems(setId) : [...ucatKeys.skillTrainerSets(), 'items-empty'],
    queryFn: () => ucatSkillTrainerSetsApi.listItems(setId as string),
    enabled: !!setId,
  })
}

export function useUcatSkillTrainers() {
  return useQuery({
    queryKey: ucatKeys.skillTrainers(),
    queryFn: () => ucatSkillTrainerSetsApi.listTrainers(),
  })
}

export function useUpsertUcatSkillTrainerSet() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: UcatSkillTrainerSetUpsertPayload) => ucatSkillTrainerSetsApi.upsert(payload),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ucatKeys.skillTrainerSets() })
      if (variables.setId) {
        queryClient.invalidateQueries({ queryKey: ucatKeys.skillTrainerSet(variables.setId) })
      }
    },
  })
}

export function useReplaceUcatSkillTrainerSetItems() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ setId, itemIds }: { setId: string; itemIds: string[] }) =>
      ucatSkillTrainerSetsApi.replaceItems(setId, itemIds),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ucatKeys.skillTrainerSetItems(variables.setId) })
      queryClient.invalidateQueries({ queryKey: ucatKeys.skillTrainerSet(variables.setId) })
      queryClient.invalidateQueries({ queryKey: ucatKeys.skillTrainerSets() })
    },
  })
}

export function useDeleteUcatSkillTrainerSet() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (setId: string) => ucatSkillTrainerSetsApi.remove(setId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ucatKeys.skillTrainerSets() }),
  })
}
