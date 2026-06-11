import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ucatSkillTrainerItemsApi } from '@/features/ucat/skill-trainer/api/items'
import { ucatKeys } from '@/features/ucat/shared/lib/query-keys'

export function useUcatSkillTrainerItems(options?: {
  trainerKey?: string
  approvalStatus?: 'approved' | 'pending' | 'rejected'
}) {
  return useQuery({
    queryKey: ucatKeys.skillTrainerItems(options?.trainerKey, options?.approvalStatus),
    queryFn: () => ucatSkillTrainerItemsApi.list(options),
  })
}

export function useUcatSkillTrainerItem(itemId: string | null) {
  return useQuery({
    queryKey: itemId ? ucatKeys.skillTrainerItem(itemId) : [...ucatKeys.skillTrainerItems(), 'empty'],
    queryFn: () => ucatSkillTrainerItemsApi.get(itemId as string),
    enabled: !!itemId,
  })
}

export function useUcatSkillTrainersCatalog() {
  return useQuery({
    queryKey: ucatKeys.skillTrainers(),
    queryFn: () => ucatSkillTrainerItemsApi.listTrainers(),
  })
}

export function useUpsertUcatSkillTrainerItem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ucatSkillTrainerItemsApi.upsert,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...ucatKeys.all, 'skill-trainer-items'] })
    },
  })
}

export function useSetUcatSkillTrainerItemApproval() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      itemId,
      approvalStatus,
    }: {
      itemId: string
      approvalStatus: 'approved' | 'pending' | 'rejected'
    }) => ucatSkillTrainerItemsApi.setApproval(itemId, approvalStatus),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [...ucatKeys.all, 'skill-trainer-items'] })
      queryClient.invalidateQueries({ queryKey: ucatKeys.skillTrainerItem(variables.itemId) })
    },
  })
}
