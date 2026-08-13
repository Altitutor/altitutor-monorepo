import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ucatKeys } from '@/features/ucat/shared/lib/query-keys'
import { ucatMocksApi } from '@/features/ucat/mocks/api/mocks'
import type { UcatContentStatus, UcatMockPayload } from '@/features/ucat/shared/types'

export function useUcatMocks() {
  return useQuery({ queryKey: ucatKeys.mocks(), queryFn: ucatMocksApi.list })
}

export function useUcatMockBlueprints() {
  return useQuery({ queryKey: ucatKeys.mockBlueprints(), queryFn: ucatMocksApi.blueprints })
}

export function useUcatMockDetail(mockId: string | null) {
  return useQuery({
    queryKey: mockId ? ucatKeys.mock(mockId) : [...ucatKeys.mocks(), 'empty'],
    queryFn: () => ucatMocksApi.detail(mockId as string),
    enabled: !!mockId,
  })
}

export function useUcatMockBlueprintAudits(mockId: string | null) {
  return useQuery({
    queryKey: mockId ? [...ucatKeys.mock(mockId), 'blueprint-audits'] : [...ucatKeys.mocks(), 'empty-blueprint-audits'],
    queryFn: () => ucatMocksApi.blueprintAudits(mockId as string),
    enabled: !!mockId,
  })
}

export function useAuditUcatMockBlueprint() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ mockId, blueprintId }: { mockId: string; blueprintId: string }) =>
      ucatMocksApi.auditBlueprint(mockId, blueprintId),
    onSuccess: (_, variables) => queryClient.invalidateQueries({ queryKey: [...ucatKeys.mock(variables.mockId), 'blueprint-audits'] }),
  })
}

export function useConfirmUcatMockBlueprintAudit() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ mockId, auditId }: { mockId: string; auditId: string }) =>
      ucatMocksApi.confirmBlueprintAudit(mockId, auditId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ucatKeys.mock(variables.mockId) })
      queryClient.invalidateQueries({ queryKey: ucatKeys.mocks() })
      queryClient.invalidateQueries({ queryKey: [...ucatKeys.mock(variables.mockId), 'blueprint-audits'] })
    },
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

export function useSetUcatMockStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ mockId, status }: { mockId: string; status: UcatContentStatus }) =>
      ucatMocksApi.setStatus(mockId, status),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ucatKeys.mocks() })
      queryClient.invalidateQueries({ queryKey: ucatKeys.mock(variables.mockId) })
      queryClient.invalidateQueries({ queryKey: ucatKeys.reconciliation() })
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
