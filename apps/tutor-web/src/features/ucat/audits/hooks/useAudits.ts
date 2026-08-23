'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ucatKeys } from '@/features/ucat/shared/lib/query-keys'
import { getAudit, listAudits, setAuditTargetStatus, type AuditTargetStatus } from '../api/audits'

export function useAudits() {
  return useQuery({ queryKey: ucatKeys.audits(), queryFn: listAudits })
}

export function useAudit(id: string) {
  return useQuery({ queryKey: ucatKeys.audit(id), queryFn: () => getAudit(id), enabled: Boolean(id) })
}

export function useSetAuditTargetStatus(auditId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ targetId, status }: { targetId: string; status: AuditTargetStatus }) =>
      setAuditTargetStatus(targetId, status),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ucatKeys.audit(auditId) }),
        queryClient.invalidateQueries({ queryKey: ucatKeys.audits() }),
      ])
    },
  })
}
