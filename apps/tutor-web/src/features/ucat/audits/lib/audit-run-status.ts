import type { AuditRunStatus } from '../api/audits'

export const AUDIT_RUN_STATUS_LABELS: Record<AuditRunStatus, string> = {
  selecting: 'Selecting',
  active: 'Active',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

export function auditRunStatusChangeCopy(
  from: AuditRunStatus,
  to: AuditRunStatus,
): { title: string; description: string } {
  const fromLabel = AUDIT_RUN_STATUS_LABELS[from]
  const toLabel = AUDIT_RUN_STATUS_LABELS[to]
  if (from === to) {
    return {
      title: `Keep this audit ${toLabel.toLowerCase()}?`,
      description: `This audit is already ${fromLabel.toLowerCase()}. Confirming will leave it unchanged.`,
    }
  }

  const consequence: Record<AuditRunStatus, string> = {
    selecting: 'Targets can be added again. The board stays read-only until the audit is active.',
    active: 'Tutors can move targets on the board.',
    completed: 'The board becomes read-only. Every target must already be finished.',
    cancelled: 'The board becomes read-only, and this audit is no longer current catalog review membership.',
  }

  return {
    title: `Change this audit to ${toLabel}?`,
    description: `This audit is currently ${fromLabel.toLowerCase()}. ${consequence[to]}`,
  }
}
