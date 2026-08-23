'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ucatKeys } from '@/features/ucat/shared/lib/query-keys'
import {
  applyAuditRunStatus,
  applyAuditTargetLabels,
  applyAuditTargetStatus,
  getAudit,
  listAudits,
  loadAuditTargetLabels,
  setAuditRunStatus,
  setAuditTargetStatus,
  type AuditDetail,
  type AuditRun,
  type AuditRunStatus,
  type AuditTargetStatus,
} from '../api/audits'

export function useAudits() {
  return useQuery({ queryKey: ucatKeys.audits(), queryFn: listAudits })
}

export function useAudit(id: string) {
  const queryClient = useQueryClient()
  const audit = useQuery({
    queryKey: ucatKeys.audit(id),
    queryFn: () => getAudit(id),
    enabled: Boolean(id),
  })

  useQuery({
    queryKey: [
      ...ucatKeys.audit(id),
      'labels',
      audit.data?.targets.length ?? 0,
      audit.data?.targets[0]?.id,
      audit.data?.targets.at(-1)?.id,
    ],
    queryFn: async () => {
      const detail = queryClient.getQueryData<AuditDetail>(ucatKeys.audit(id))
      const targets = detail?.targets ?? audit.data?.targets ?? []
      const labels = await loadAuditTargetLabels(targets)
      queryClient.setQueryData<AuditDetail>(ucatKeys.audit(id), (current) =>
        current ? applyAuditTargetLabels(current, labels) : current,
      )
      return labels.size
    },
    enabled: Boolean(id) && (audit.data?.targets.length ?? 0) > 0,
    staleTime: 60_000,
  })

  return audit
}

export function useSetAuditTargetStatus(auditId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ targetId, status }: { targetId: string; status: AuditTargetStatus }) =>
      setAuditTargetStatus(targetId, status),
    onMutate: async ({ targetId, status }) => {
      const queryKey = ucatKeys.audit(auditId)
      await queryClient.cancelQueries({ queryKey, exact: true })
      const previous = queryClient.getQueryData<AuditDetail>(queryKey)
      if (previous) {
        queryClient.setQueryData(queryKey, applyAuditTargetStatus(previous, targetId, status))
      }
      return { previous }
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(ucatKeys.audit(auditId), context.previous)
      }
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: ucatKeys.audits(), exact: true })
    },
  })
}

export function useSetAuditRunStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ auditId, status }: { auditId: string; status: AuditRunStatus }) =>
      setAuditRunStatus(auditId, status),
    onMutate: async ({ auditId, status }) => {
      await queryClient.cancelQueries({ queryKey: ucatKeys.audits(), exact: true })
      await queryClient.cancelQueries({ queryKey: ucatKeys.audit(auditId), exact: true })
      const previousList = queryClient.getQueryData<AuditRun[]>(ucatKeys.audits())
      const previousDetail = queryClient.getQueryData<AuditDetail>(ucatKeys.audit(auditId))
      if (previousList) {
        queryClient.setQueryData(
          ucatKeys.audits(),
          previousList.map((run) => (run.id === auditId ? applyAuditRunStatus(run, status) : run)),
        )
      }
      if (previousDetail) {
        queryClient.setQueryData(ucatKeys.audit(auditId), {
          ...previousDetail,
          run: applyAuditRunStatus(previousDetail.run, status),
        })
      }
      return { previousList, previousDetail, auditId }
    },
    onError: (_error, _variables, context) => {
      if (!context) return
      if (context.previousList) {
        queryClient.setQueryData(ucatKeys.audits(), context.previousList)
      }
      if (context.previousDetail) {
        queryClient.setQueryData(ucatKeys.audit(context.auditId), context.previousDetail)
      }
    },
    onSettled: async (_data, _error, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ucatKeys.audits(), exact: true }),
        queryClient.invalidateQueries({ queryKey: ucatKeys.audit(variables.auditId), exact: true }),
      ])
    },
  })
}
