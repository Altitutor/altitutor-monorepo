import { getSupabaseClient } from '@/shared/lib/supabase/client'
import { proseMirrorToPlainText } from '@/features/ucat/shared/lib/rich-text'

export const AUDIT_RUN_STATUSES = ['selecting', 'active', 'completed', 'cancelled'] as const
export const AUDIT_TARGET_STATUSES = ['pending', 'in_progress', 'completed', 'failed', 'skipped'] as const

export type AuditRunStatus = (typeof AUDIT_RUN_STATUSES)[number]
export type AuditTargetStatus = (typeof AUDIT_TARGET_STATUSES)[number]
export type AuditContentType = 'learning_module' | 'stem' | 'set' | 'mock'

export type AuditRun = {
  id: string
  title: string
  brief: string | null
  status: AuditRunStatus
  publishedWriteMode: 'proposal_only' | 'apply_valid_changes'
  workflowId: string | null
  workflowVersion: string | null
  createdAt: string
  startedAt: string | null
  completedAt: string | null
  cancelledAt: string | null
  targetCounts: Partial<Record<AuditTargetStatus, number>>
}

export type AuditTarget = {
  id: string
  contentType: AuditContentType
  contentId: string
  label: string | null
  status: AuditTargetStatus
  result: string | null
  outcome: Record<string, unknown> | null
  errorMessage: string | null
  startedAt: string | null
  completedAt: string | null
  createdAt: string
}

export type AuditDetail = { run: AuditRun; targets: AuditTarget[] }

type UnknownRecord = Record<string, unknown>

function record(value: unknown): UnknownRecord {
  return value != null && typeof value === 'object' && !Array.isArray(value)
    ? value as UnknownRecord
    : {}
}

function nullableString(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

function parseRun(value: unknown, countsValue: unknown): AuditRun {
  const run = record(value)
  const counts = record(countsValue)
  return {
    id: String(run.id ?? ''),
    title: String(run.title ?? 'Untitled audit'),
    brief: nullableString(run.brief),
    status: String(run.status ?? 'selecting') as AuditRunStatus,
    publishedWriteMode: String(run.published_write_mode ?? 'proposal_only') as AuditRun['publishedWriteMode'],
    workflowId: nullableString(run.workflow_id),
    workflowVersion: nullableString(run.workflow_version),
    createdAt: String(run.created_at ?? ''),
    startedAt: nullableString(run.started_at),
    completedAt: nullableString(run.completed_at),
    cancelledAt: nullableString(run.cancelled_at),
    targetCounts: Object.fromEntries(
      AUDIT_TARGET_STATUSES.map((status) => [status, Number(counts[status] ?? 0)]),
    ),
  }
}

function parseTarget(value: unknown): AuditTarget {
  const target = record(value)
  return {
    id: String(target.id ?? ''),
    contentType: String(target.content_type ?? 'stem') as AuditContentType,
    contentId: String(target.content_id ?? ''),
    label: null,
    status: String(target.status ?? 'pending') as AuditTargetStatus,
    result: nullableString(target.result),
    outcome: Object.keys(record(target.outcome)).length > 0 ? record(target.outcome) : null,
    errorMessage: nullableString(target.error_message),
    startedAt: nullableString(target.started_at),
    completedAt: nullableString(target.completed_at),
    createdAt: String(target.created_at ?? ''),
  }
}

function chunks<T>(items: T[], size: number): T[][] {
  const result: T[][] = []
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size))
  }
  return result
}

async function loadTargetLabels(targets: AuditTarget[]): Promise<Map<string, string>> {
  const supabase = getSupabaseClient()
  const labels = new Map<string, string>()
  const idsFor = (contentType: AuditContentType) =>
    targets.filter((target) => target.contentType === contentType).map((target) => target.contentId)

  await Promise.all([
    ...chunks(idsFor('stem'), 100).map(async (ids) => {
      const { data } = await supabase
        .from('vtutor_ucat_question_stems')
        .select('id, stem_text')
        .in('id', ids)
      for (const row of data ?? []) {
        if (!row.id) continue
        const label = proseMirrorToPlainText(row.stem_text).trim()
        if (label) labels.set(`stem:${row.id}`, label)
      }
    }),
    ...chunks(idsFor('set'), 100).map(async (ids) => {
      const { data } = await supabase
        .from('vtutor_ucat_question_sets')
        .select('id, name')
        .in('id', ids)
      for (const row of data ?? []) {
        if (!row.id) continue
        const label = proseMirrorToPlainText(row.name).trim()
        if (label) labels.set(`set:${row.id}`, label)
      }
    }),
    ...chunks(idsFor('mock'), 100).map(async (ids) => {
      const { data } = await supabase
        .from('vtutor_ucat_mocks')
        .select('id, name')
        .in('id', ids)
      for (const row of data ?? []) {
        if (row.id && row.name) labels.set(`mock:${row.id}`, row.name)
      }
    }),
    ...chunks(idsFor('learning_module'), 100).map(async (ids) => {
      const { data } = await supabase
        .from('vtutor_ucat_learning_modules')
        .select('id, title')
        .in('id', ids)
      for (const row of data ?? []) {
        if (row.id && row.title) labels.set(`learning_module:${row.id}`, row.title)
      }
    }),
  ])

  return labels
}

export async function listAudits(): Promise<AuditRun[]> {
  const supabase = getSupabaseClient()
  const audits: AuditRun[] = []
  let beforeCreatedAt: string | undefined
  let beforeId: string | undefined

  for (;;) {
    const result = await supabase.rpc('tutor_ucat_mcp_list_audit_runs', {
      p_status: undefined,
      p_before_created_at: beforeCreatedAt,
      p_before_id: beforeId,
      p_limit: 100,
    })
    if (result.error) throw result.error
    const payload = record(result.data)
    const items = Array.isArray(payload.runs) ? payload.runs : []
    for (const item of items) {
      const row = record(item)
      audits.push(parseRun(row.run, row.targetCounts))
    }
    const cursor = record(payload.nextCursor)
    if (typeof cursor.createdAt !== 'string' || typeof cursor.id !== 'string') break
    beforeCreatedAt = cursor.createdAt
    beforeId = cursor.id
  }

  return audits
}

export async function getAudit(id: string): Promise<AuditDetail> {
  const supabase = getSupabaseClient()
  const targets: AuditTarget[] = []
  let run: AuditRun | null = null
  let offset = 0

  for (;;) {
    const result = await supabase.rpc('tutor_ucat_mcp_get_audit_run', {
      p_run_id: id,
      p_target_offset: offset,
      p_target_limit: 500,
    })
    if (result.error) throw result.error
    const payload = record(result.data)
    run ??= parseRun(payload.run, payload.targetCounts)
    const page = Array.isArray(payload.targets) ? payload.targets.map(parseTarget) : []
    targets.push(...page)
    if (page.length < 500) break
    offset += page.length
  }

  if (!run) throw new Error('Audit not found')
  return { run, targets }
}

export function applyAuditTargetStatus(
  detail: AuditDetail,
  targetId: string,
  status: AuditTargetStatus,
): AuditDetail {
  const current = detail.targets.find((target) => target.id === targetId)
  if (!current || current.status === status) return detail
  return {
    ...detail,
    run: {
      ...detail.run,
      targetCounts: {
        ...detail.run.targetCounts,
        [current.status]: Math.max(0, (detail.run.targetCounts[current.status] ?? 0) - 1),
        [status]: (detail.run.targetCounts[status] ?? 0) + 1,
      },
    },
    targets: detail.targets.map((target) =>
      target.id === targetId ? { ...target, status } : target,
    ),
  }
}

export function applyAuditTargetLabels(
  detail: AuditDetail,
  labels: Map<string, string>,
): AuditDetail {
  if (labels.size === 0) return detail
  return {
    ...detail,
    targets: detail.targets.map((target) => ({
      ...target,
      label: labels.get(`${target.contentType}:${target.contentId}`) ?? target.label,
    })),
  }
}

export async function loadAuditTargetLabels(targets: AuditTarget[]): Promise<Map<string, string>> {
  return loadTargetLabels(targets)
}

export function applyAuditRunStatus(run: AuditRun, status: AuditRunStatus): AuditRun {
  if (run.status === status) return run
  const now = new Date().toISOString()
  return {
    ...run,
    status,
    startedAt: status === 'active' ? (run.startedAt ?? now) : run.startedAt,
    completedAt: status === 'completed' ? now : null,
    cancelledAt: status === 'cancelled' ? now : null,
  }
}

export async function setAuditTargetStatus(
  targetId: string,
  status: AuditTargetStatus,
): Promise<void> {
  const supabase = getSupabaseClient()
  const result = await supabase.rpc('tutor_ucat_set_audit_target_status', {
    p_target_id: targetId,
    p_status: status,
  })
  if (result.error) throw result.error
}

export async function setAuditRunStatus(
  auditId: string,
  status: AuditRunStatus,
): Promise<void> {
  const supabase = getSupabaseClient()
  const result = await supabase.rpc('tutor_ucat_set_audit_run_status', {
    p_run_id: auditId,
    p_status: status,
  })
  if (result.error) {
    const message = result.error.message ?? ''
    if (message.includes('audit_run_has_unfinished_targets')) {
      throw new Error('Every target must be finished before this audit can be completed.')
    }
    throw result.error
  }
}
