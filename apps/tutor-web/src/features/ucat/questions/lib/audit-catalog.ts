export const AUDIT_CATALOG_NOT_AUDITED = 'not_audited'

export const AUDIT_TARGET_STATUSES = [
  'pending',
  'in_progress',
  'completed',
  'failed',
  'skipped',
] as const

export type AuditTargetStatus = (typeof AUDIT_TARGET_STATUSES)[number]

export const AUDIT_TARGET_RESULTS = [
  'updated',
  'unchanged',
  'suggest_delete',
  'suggest_split',
] as const

export type AuditTargetResult = (typeof AUDIT_TARGET_RESULTS)[number]

export const AUDIT_RUN_CATALOG_STATUSES = ['selecting', 'active', 'completed'] as const

export type AuditRunCatalogStatus = (typeof AUDIT_RUN_CATALOG_STATUSES)[number]

export type CatalogAuditRun = {
  id: string
  title: string
  status: string
  created_at: string
}

export type StemAuditMembership = {
  runId: string
  title: string
  runStatus: AuditRunCatalogStatus
  targetStatus: AuditTargetStatus
  result: AuditTargetResult | null
  createdAt: string
  why: string | null
}

const TARGET_STATUS_LABEL: Record<AuditTargetStatus, string> = {
  pending: 'Pending',
  in_progress: 'In progress',
  completed: 'Completed',
  failed: 'Failed',
  skipped: 'Skipped',
}

const TARGET_RESULT_LABEL: Record<AuditTargetResult, string> = {
  updated: 'Updated',
  unchanged: 'Unchanged',
  suggest_delete: 'Suggest delete',
  suggest_split: 'Suggest split',
}

const TARGET_STATUS_CLASS: Record<AuditTargetStatus, string> = {
  pending: 'border-slate-300 text-slate-600',
  in_progress: 'border-blue-300 bg-blue-50 text-blue-700 dark:bg-blue-950/30',
  completed: 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30',
  failed: 'border-red-300 bg-red-50 text-red-700 dark:bg-red-950/30',
  skipped: 'border-violet-300 bg-violet-50 text-violet-700 dark:bg-violet-950/30',
}

const TARGET_RESULT_CLASS: Record<AuditTargetResult, string> = {
  updated: 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30',
  unchanged: 'border-slate-300 text-slate-600',
  suggest_delete: 'border-red-300 bg-red-50 text-red-700 dark:bg-red-950/30',
  suggest_split: 'border-amber-300 bg-amber-50 text-amber-700 dark:bg-amber-950/30',
}

const RESULT_FOR_STATUS: Record<AuditTargetStatus, readonly AuditTargetResult[]> = {
  pending: [],
  in_progress: [],
  completed: ['updated', 'unchanged'],
  failed: [],
  skipped: ['suggest_delete', 'suggest_split'],
}

const UUID_STATUS_PATTERN =
  /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}):(pending|in_progress|completed|failed|skipped)(?::(updated|unchanged|suggest_delete|suggest_split))?$/iu

export function isAuditTargetStatus(value: string): value is AuditTargetStatus {
  return (AUDIT_TARGET_STATUSES as readonly string[]).includes(value)
}

export function isAuditTargetResult(value: string): value is AuditTargetResult {
  return (AUDIT_TARGET_RESULTS as readonly string[]).includes(value)
}

export function isValidAuditCatalogFilter(value: string): boolean {
  if (value === AUDIT_CATALOG_NOT_AUDITED) return true
  const match = UUID_STATUS_PATTERN.exec(value)
  if (!match) return false
  const status = match[2]
  const result = match[3]
  if (!isAuditTargetStatus(status)) return false
  if (!result) return true
  return (RESULT_FOR_STATUS[status] as readonly string[]).includes(result)
}

export function auditRunOptionPrefix(run: CatalogAuditRun, runs: CatalogAuditRun[]): string {
  const duplicateTitle = runs.some((other) => other.id !== run.id && other.title === run.title)
  if (!duplicateTitle) return run.title
  return `${run.title} · ${run.created_at.slice(0, 10)}`
}

export function buildAuditCatalogFilterOptions(
  runs: CatalogAuditRun[],
): Array<{ label: string; value: string }> {
  const visibleRuns = runs.filter((run) =>
    (AUDIT_RUN_CATALOG_STATUSES as readonly string[]).includes(run.status),
  )
  const options: Array<{ label: string; value: string }> = [
    { label: 'Not audited', value: AUDIT_CATALOG_NOT_AUDITED },
  ]
  for (const run of visibleRuns) {
    const prefix = auditRunOptionPrefix(run, visibleRuns)
    for (const status of AUDIT_TARGET_STATUSES) {
      options.push({
        label: `${prefix} · ${TARGET_STATUS_LABEL[status]}`,
        value: `${run.id}:${status}`,
      })
      for (const result of RESULT_FOR_STATUS[status]) {
        options.push({
          label: `${prefix} · ${TARGET_STATUS_LABEL[status]} · ${TARGET_RESULT_LABEL[result]}`,
          value: `${run.id}:${status}:${result}`,
        })
      }
    }
  }
  return options
}

export function auditMembershipChipLabel(membership: StemAuditMembership): string {
  const resultLabel = membership.result ? TARGET_RESULT_LABEL[membership.result] : null
  const statusLabel = resultLabel ?? TARGET_STATUS_LABEL[membership.targetStatus]
  return `${membership.title} · ${statusLabel}`
}

export function auditMembershipChipClassName(membership: StemAuditMembership): string {
  if (membership.result) return TARGET_RESULT_CLASS[membership.result]
  return TARGET_STATUS_CLASS[membership.targetStatus]
}

export function parseStemAuditMemberships(value: unknown): StemAuditMembership[] {
  if (!Array.isArray(value)) return []
  const memberships: StemAuditMembership[] = []
  for (const item of value) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue
    const record = item as Record<string, unknown>
    const runId = typeof record.runId === 'string' ? record.runId : null
    const title = typeof record.title === 'string' ? record.title : null
    const runStatus = typeof record.runStatus === 'string' ? record.runStatus : null
    const targetStatus = typeof record.targetStatus === 'string' ? record.targetStatus : null
    if (
      !runId
      || !title
      || !runStatus
      || !(AUDIT_RUN_CATALOG_STATUSES as readonly string[]).includes(runStatus)
      || !targetStatus
      || !isAuditTargetStatus(targetStatus)
    ) {
      continue
    }
    const result = typeof record.result === 'string' && isAuditTargetResult(record.result)
      ? record.result
      : null
    memberships.push({
      runId,
      title,
      runStatus: runStatus as AuditRunCatalogStatus,
      targetStatus,
      result,
      createdAt: typeof record.createdAt === 'string' ? record.createdAt : '',
      why: typeof record.why === 'string' && record.why.trim() ? record.why : null,
    })
  }
  return memberships
}
