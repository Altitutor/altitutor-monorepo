'use client'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@altitutor/ui'
import type { UcatRowAction } from '@/features/ucat/shared/row-actions'
import { AUDIT_RUN_STATUSES, type AuditRunStatus } from '../api/audits'
import { AUDIT_RUN_STATUS_LABELS, auditRunStatusChangeCopy } from '../lib/audit-run-status'

export function auditRunChangeStatusAction(
  onRequest: (status: AuditRunStatus) => void,
): UcatRowAction {
  return {
    label: 'Change status',
    children: AUDIT_RUN_STATUSES.map((status) => ({
      label: AUDIT_RUN_STATUS_LABELS[status],
      onClick: () => onRequest(status),
    })),
  }
}

export function UcatAuditRunStatusConfirmDialog({
  currentStatus,
  nextStatus,
  pending,
  onOpenChange,
  onConfirm,
}: {
  currentStatus: AuditRunStatus | null
  nextStatus: AuditRunStatus | null
  pending?: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}) {
  const copy = currentStatus && nextStatus
    ? auditRunStatusChangeCopy(currentStatus, nextStatus)
    : { title: '', description: '' }

  return (
    <AlertDialog open={nextStatus != null} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{copy.title}</AlertDialogTitle>
          <AlertDialogDescription>{copy.description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={pending}
            onClick={(event) => {
              event.preventDefault()
              onConfirm()
            }}
          >
            Change status
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
