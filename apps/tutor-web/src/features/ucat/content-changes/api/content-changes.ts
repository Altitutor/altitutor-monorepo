import type { Json } from '@altitutor/shared'
import { proseMirrorToPlainText } from '@/features/ucat/shared/lib/rich-text'

export const CONTENT_CHANGE_STATUSES = ['pending', 'applied', 'rejected', 'stale'] as const
export type ContentChangeStatus = (typeof CONTENT_CHANGE_STATUSES)[number]
export type ContentChangeTargetType = 'learning_module' | 'stem' | 'set' | 'mock'

export type UcatContentChange = {
  id: string
  targetType: ContentChangeTargetType
  targetId: string
  targetLabel: string
  status: ContentChangeStatus
  source: 'interactive_agent' | 'audit_run' | 'assessment' | 'recovery'
  auditRunId: string | null
  baseRevision: string
  resultingRevision: string | null
  baseSnapshot: Record<string, unknown>
  proposedSnapshot: Record<string, unknown>
  operations: unknown[]
  summary: string
  rationale: string | null
  createdAt: string
  appliedAt: string | null
  rejectedAt: string | null
  rejectionReason: string | null
}

type UnknownRecord = Record<string, unknown>

function record(value: unknown): UnknownRecord {
  return value != null && typeof value === 'object' && !Array.isArray(value)
    ? value as UnknownRecord
    : {}
}

function nullableString(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

function contentLabel(targetType: ContentChangeTargetType, snapshot: UnknownRecord): string {
  if (targetType === 'stem') {
    const text = proseMirrorToPlainText(snapshot.stemText as Json | undefined).trim()
    return text || 'Untitled question stem'
  }
  if (targetType === 'set') {
    const text = proseMirrorToPlainText(snapshot.name as Json | undefined).trim()
    return text || 'Untitled question set'
  }
  if (typeof snapshot.title === 'string' && snapshot.title.trim()) return snapshot.title.trim()
  if (typeof snapshot.name === 'string' && snapshot.name.trim()) return snapshot.name.trim()
  return targetType === 'mock' ? 'Untitled mock' : 'Untitled learning module'
}

function parseContentChange(value: unknown): UcatContentChange {
  const row = record(value)
  const targetType = String(row.target_type ?? 'stem') as ContentChangeTargetType
  const proposedSnapshot = record(row.proposed_snapshot)
  return {
    id: String(row.id ?? ''),
    targetType,
    targetId: String(row.target_id ?? ''),
    targetLabel: contentLabel(targetType, proposedSnapshot),
    status: String(row.status ?? 'pending') as ContentChangeStatus,
    source: String(row.source ?? 'interactive_agent') as UcatContentChange['source'],
    auditRunId: nullableString(row.audit_run_id),
    baseRevision: String(row.base_revision ?? ''),
    resultingRevision: nullableString(row.resulting_revision),
    baseSnapshot: record(row.base_snapshot),
    proposedSnapshot,
    operations: Array.isArray(row.operations) ? row.operations : [],
    summary: String(row.summary ?? 'UCAT content change'),
    rationale: nullableString(row.rationale),
    createdAt: String(row.created_at ?? ''),
    appliedAt: nullableString(row.applied_at),
    rejectedAt: nullableString(row.rejected_at),
    rejectionReason: nullableString(row.rejection_reason),
  }
}

export async function listContentChanges(status: ContentChangeStatus): Promise<UcatContentChange[]> {
  const response = await fetch(`/api/ucat/content-changes?status=${encodeURIComponent(status)}&limit=200`)
  const payload = await response.json() as { items?: unknown[]; error?: string }
  if (!response.ok) throw new Error(payload.error ?? 'Could not load UCAT content changes.')
  return (payload.items ?? []).map(parseContentChange)
}

export async function reviewContentChanges(input: {
  action: 'apply' | 'reject'
  changeIds: string[]
  reason?: string | null
}): Promise<{ succeededCount: number; failedCount: number; errors: string[] }> {
  const response = await fetch('/api/ucat/content-changes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  const payload = await response.json() as {
    error?: string
    succeededCount?: number
    failedCount?: number
    results?: Array<{ error?: string }>
  }
  if (!response.ok) throw new Error(payload.error ?? 'Could not review UCAT content changes.')
  return {
    succeededCount: payload.succeededCount ?? 0,
    failedCount: payload.failedCount ?? 0,
    errors: (payload.results ?? []).flatMap((result) => result.error ? [result.error] : []),
  }
}
