export type UcatAiReviewStatus =
  | 'disabled'
  | 'not_requested'
  | 'reviewing'
  | 'deferred'
  | 'format_blocked'
  | 'unavailable'
  | 'unreviewable'
  | 'passed'
  | 'concerns'
  | 'critical'

/** Durable catalog statuses — excludes env-only `disabled`. */
export const UCAT_DURABLE_AI_REVIEW_STATUSES = [
  'not_requested',
  'reviewing',
  'deferred',
  'format_blocked',
  'unavailable',
  'unreviewable',
  'passed',
  'concerns',
  'critical',
] as const satisfies ReadonlyArray<Exclude<UcatAiReviewStatus, 'disabled'>>

export type UcatDurableAiReviewStatus = (typeof UCAT_DURABLE_AI_REVIEW_STATUSES)[number]

export const UCAT_AI_REVIEW_RUNNING_STALE_MS = 9 * 60_000

export function isStaleUcatAiReviewRun(
  run: { status: string; started_at?: string | null },
  now = new Date(),
): boolean {
  if (run.status !== 'running') return false
  if (!run.started_at) return true
  const startedAt = new Date(run.started_at).getTime()
  return !Number.isFinite(startedAt)
    || now.getTime() - startedAt > UCAT_AI_REVIEW_RUNNING_STALE_MS
}

export function shouldShowRequestAiReviewAction(status: UcatAiReviewStatus | undefined): boolean {
  return status === 'not_requested'
}

export function deriveUcatAiScopeReviewStatus(params: {
  overallStatus: UcatAiReviewStatus
  ratings: Array<'pass' | 'critical' | 'concern' | 'unreviewable' | 'not_applicable'>
  formatSeverities: Array<'warning' | 'error'>
}): UcatAiReviewStatus {
  if (['disabled', 'not_requested', 'reviewing', 'deferred', 'unavailable'].includes(params.overallStatus)) {
    return params.overallStatus
  }
  if (params.formatSeverities.includes('error')) return 'format_blocked'
  if (params.ratings.includes('critical')) return 'critical'
  if (params.ratings.includes('unreviewable')) return 'unreviewable'
  if (params.ratings.includes('concern') || params.formatSeverities.includes('warning')) return 'concerns'
  return 'passed'
}

export const UCAT_AI_REVIEW_STATUS_COPY: Record<
  UcatAiReviewStatus,
  { label: string; shortLabel: string; className: string }
> = {
  disabled: { label: 'AI review disabled', shortLabel: 'Disabled', className: 'border-slate-300 text-slate-600' },
  not_requested: { label: 'AI review not requested', shortLabel: 'Not requested', className: 'border-slate-300 text-slate-600' },
  reviewing: { label: 'AI reviewing', shortLabel: 'Reviewing', className: 'border-blue-300 bg-blue-50 text-blue-700 dark:bg-blue-950/30' },
  deferred: { label: 'AI review deferred', shortLabel: 'Deferred', className: 'border-amber-300 bg-amber-50 text-amber-700 dark:bg-amber-950/30' },
  format_blocked: { label: 'Format checks', shortLabel: 'Format checks', className: 'border-amber-300 bg-amber-50 text-amber-700 dark:bg-amber-950/30' },
  unavailable: { label: 'AI unavailable', shortLabel: 'Unavailable', className: 'border-slate-300 text-slate-600' },
  unreviewable: { label: 'Needs human review', shortLabel: 'Human review', className: 'border-violet-300 bg-violet-50 text-violet-700 dark:bg-violet-950/30' },
  passed: { label: 'AI review passed', shortLabel: 'Passed', className: 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30' },
  concerns: { label: 'AI concerns', shortLabel: 'Concerns', className: 'border-amber-300 bg-amber-50 text-amber-700 dark:bg-amber-950/30' },
  critical: { label: 'AI critical', shortLabel: 'Critical', className: 'border-red-300 bg-red-50 text-red-700 dark:bg-red-950/30' },
}
