import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ucatMockBlueprintsApi } from '@/features/ucat/mock-blueprints/api/mock-blueprints'
import type { MockBlueprintPayload } from '@/features/ucat/mock-blueprints/types'
import { ucatKeys } from '@/features/ucat/shared/lib/query-keys'

export function useUcatMockBlueprintsList() {
  return useQuery({ queryKey: ucatKeys.mockBlueprints(), queryFn: ucatMockBlueprintsApi.list })
}

export function useCreateUcatMockBlueprintVersion() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: MockBlueprintPayload) => ucatMockBlueprintsApi.createVersion(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ucatKeys.mockBlueprints() }),
  })
}

