import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ucatKeys } from '@/features/ucat/shared/lib/query-keys'
import { ucatMocksApi } from '@/features/ucat/mocks/api/mocks'
import type { UcatMockPayload } from '@/features/ucat/shared/types'

export function useUcatMocks() {
  return useQuery({ queryKey: ucatKeys.mocks(), queryFn: ucatMocksApi.list })
}

export function useUcatMockDetail(mockId: string | null) {
  return useQuery({
    queryKey: mockId ? ucatKeys.mock(mockId) : [...ucatKeys.mocks(), 'empty'],
    queryFn: () => ucatMocksApi.detail(mockId as string),
    enabled: !!mockId,
  })
}

export function useCreateUcatMock() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: UcatMockPayload) => ucatMocksApi.create(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ucatKeys.mocks() }),
  })
}

export function useUpdateUcatMock() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ mockId, payload }: { mockId: string; payload: UcatMockPayload }) =>
      ucatMocksApi.update(mockId, payload),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ucatKeys.mocks() })
      queryClient.invalidateQueries({ queryKey: ucatKeys.mock(variables.mockId) })
    },
  })
}

export function useDeleteUcatMock() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (mockId: string) => ucatMocksApi.remove(mockId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ucatKeys.mocks() }),
  })
}

export function useRestoreUcatMock() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (mockId: string) => ucatMocksApi.restore(mockId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ucatKeys.mocks() }),
  })
}
