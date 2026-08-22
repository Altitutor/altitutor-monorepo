'use client'

import { useCallback, useMemo, useState } from 'react'
import {
  Badge,
  KanbanBoard,
  type EntityListPillColumn,
  type EntityListStatusColumn,
  type KanbanColumnDef,
  useToast,
} from '@altitutor/ui'
import { AlertCircle, CheckCircle2, Circle, Clock3, SkipForward } from 'lucide-react'
import { UcatAccessDenied, UcatPageHeader, UcatPageSkeleton } from '@/features/ucat/shared/components'
import { useUcatAccess } from '@/features/ucat/shared/hooks/useUcatAccess'
import { UcatQuestionStemDialog } from '@/features/ucat/questions/components/UcatQuestionStemDialog'
import type { CategoryOption, TagOption } from '@/features/ucat/questions/components/UcatQuestionStemDialog'
import {
  useUcatCategories,
  useUcatQuestionDetail,
  useUcatSections,
  useUcatTags,
  useUpdateUcatQuestionStem,
} from '@/features/ucat/questions/hooks/useUcatQuestions'
import type { UcatQuestionStemFormValues } from '@/features/ucat/questions/types/schema'
import { formValuesToStemBundlePayload } from '@/features/ucat/questions/lib/stem-editor-form'
import { mapCategoriesToOptions, mapTagsToOptions } from '@/features/ucat/shared/lib/taxonomy-paths'
import { cn, formatDateTime } from '@/shared/utils'
import { clickableCardInteractiveCn } from '@altitutor/ui'
import {
  AUDIT_TARGET_STATUSES,
  type AuditContentType,
  type AuditTarget,
  type AuditTargetStatus,
} from '../api/audits'
import { useAudit, useSetAuditTargetStatus } from '../hooks/useAudits'

const STATUS_META: Record<AuditTargetStatus, {
  label: string
  icon: typeof Circle
  className: string
}> = {
  pending: { label: 'Pending', icon: Circle, className: 'text-slate-500' },
  in_progress: { label: 'In progress', icon: Clock3, className: 'text-blue-600' },
  completed: { label: 'Completed', icon: CheckCircle2, className: 'text-emerald-600' },
  failed: { label: 'Failed', icon: AlertCircle, className: 'text-destructive' },
  skipped: { label: 'Skipped', icon: SkipForward, className: 'text-amber-600' },
}

const CONTENT_LABELS: Record<AuditContentType, string> = {
  learning_module: 'Learning module',
  stem: 'Question stem',
  set: 'Question set',
  mock: 'Mock',
}

function shortId(id: string): string {
  return id.slice(0, 8)
}

function AuditTargetCard({ target, onOpenStem }: {
  target: AuditTarget
  onOpenStem: (id: string) => void
}) {
  const isStem = target.contentType === 'stem'
  const outcomeSummary = target.outcome && typeof target.outcome.summary === 'string'
    ? target.outcome.summary
    : null

  return (
    <div
      role={isStem ? 'button' : undefined}
      tabIndex={isStem ? 0 : undefined}
      onClick={() => isStem && onOpenStem(target.contentId)}
      onKeyDown={(event) => {
        if (isStem && (event.key === 'Enter' || event.key === ' ')) onOpenStem(target.contentId)
      }}
      className={cn(
        'space-y-2 rounded-lg border bg-card p-3 transition-all',
        isStem && ['cursor-pointer', clickableCardInteractiveCn],
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="line-clamp-3 text-sm font-medium">
          {target.label ?? CONTENT_LABELS[target.contentType]}
        </div>
        <Badge variant="outline" className="shrink-0 font-mono text-[10px]">{shortId(target.contentId)}</Badge>
      </div>
      {outcomeSummary ? <p className="line-clamp-2 text-xs text-muted-foreground">{outcomeSummary}</p> : null}
      {target.errorMessage ? <p className="line-clamp-2 text-xs text-destructive">{target.errorMessage}</p> : null}
      {target.result ? <Badge variant="secondary" className="capitalize">{target.result.replaceAll('_', ' ')}</Badge> : null}
      {!isStem ? <p className="text-[11px] text-muted-foreground">Editor available from its content page</p> : null}
    </div>
  )
}

export function UcatAuditBoardPage({ auditId }: { auditId: string }) {
  const access = useUcatAccess()
  const audit = useAudit(auditId)
  const updateTarget = useSetAuditTargetStatus(auditId)
  const { toast } = useToast()
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState<Record<string, unknown[]>>({})
  const [editingStemId, setEditingStemId] = useState<string | null>(null)

  const sections = useUcatSections()
  const categories = useUcatCategories()
  const tags = useUcatTags()
  const stemDetail = useUcatQuestionDetail(editingStemId)
  const updateStem = useUpdateUcatQuestionStem()

  const handleStatusChange = useCallback((target: AuditTarget, status: AuditTargetStatus) => {
    if (audit.data?.run.status !== 'active') {
      toast({ title: 'This audit is read-only', description: 'Only active audits can be changed.' })
      return
    }
    updateTarget.mutate(
      { targetId: target.id, status },
      {
        onError: (error) => toast({
          title: 'Could not move audit target',
          description: error instanceof Error ? error.message : 'Please try again.',
          variant: 'destructive',
        }),
      },
    )
  }, [audit.data?.run.status, toast, updateTarget])

  const columnDefs = useMemo<KanbanColumnDef<AuditTarget, unknown>[]>(() => [{
    key: 'status',
    label: 'Status',
    getValue: (target) => target.status,
    options: AUDIT_TARGET_STATUSES.map((status) => ({
      value: status,
      label: STATUS_META[status].label,
      icon: STATUS_META[status].icon,
    })),
    onValueChange: (target, status) => handleStatusChange(target, status as AuditTargetStatus),
  }], [handleStatusChange])

  const rightPills = useMemo<EntityListPillColumn<AuditTarget, unknown>[]>(() => [{
    key: 'content_type',
    label: 'Content type',
    visibleByDefault: true,
    getValue: (target) => target.contentType,
    renderPill: (target) => <Badge variant="outline">{CONTENT_LABELS[target.contentType]}</Badge>,
    filterOptions: Object.entries(CONTENT_LABELS).map(([value, label]) => ({ value, label })),
    filterable: true,
  }], [])

  const statusColumn = useMemo<EntityListStatusColumn<AuditTarget, unknown>>(() => ({
    key: 'status',
    label: 'Status',
    getValue: (target) => target.status,
    options: AUDIT_TARGET_STATUSES.map((status) => ({ value: status, label: STATUS_META[status].label })),
    renderBubble: (value) => {
      const meta = STATUS_META[value as AuditTargetStatus]
      const Icon = meta.icon
      return <Icon className={cn('h-4 w-4', meta.className)} />
    },
    onStatusChange: (target, status) => handleStatusChange(target, status as AuditTargetStatus),
    filterable: true,
  }), [handleStatusChange])

  const items = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()
    return (audit.data?.targets ?? []).filter((target) => {
      if (!normalizedSearch) return true
      return [target.contentId, CONTENT_LABELS[target.contentType], target.result, target.errorMessage]
        .some((value) => value?.toLowerCase().includes(normalizedSearch))
    })
  }, [audit.data?.targets, search])

  const handleStemUpdate = useCallback(async (values: UcatQuestionStemFormValues) => {
    if (!editingStemId) return
    await updateStem.mutateAsync({
      stemId: editingStemId,
      payload: formValuesToStemBundlePayload(values, editingStemId),
    })
    setEditingStemId(null)
  }, [editingStemId, updateStem])

  if (access.isLoading || audit.isLoading) return <UcatPageSkeleton />
  if (!access.data) return <UcatAccessDenied />
  if (audit.error || !audit.data) {
    return <div className="py-12 text-center text-muted-foreground">Unable to load this audit.</div>
  }

  const { run } = audit.data

  return (
    <div className="space-y-6 py-8 md:py-10">
      <UcatPageHeader
        title={run.title}
        description={run.brief ?? 'Review and manage this audit’s content targets.'}
        backHref="/ucat/audits"
        breadcrumbs={[
          { label: 'UCAT', href: '/ucat' },
          { label: 'Audits', href: '/ucat/audits' },
          { label: run.title },
        ]}
        actions={(
          <div className="flex items-center gap-2">
            <Badge variant={run.status === 'active' ? 'default' : 'secondary'} className="capitalize">
              {run.status}
            </Badge>
            <span className="text-sm text-muted-foreground">Created {formatDateTime(run.createdAt)}</span>
          </div>
        )}
      />

      {run.status !== 'active' ? (
        <div className="rounded-xl bg-muted/55 px-4 py-3 text-sm text-muted-foreground">
          This audit is {run.status} and is read-only. Open an active audit to move targets between statuses.
        </div>
      ) : null}

      <div className="h-[calc(100vh-19rem)] min-h-[520px] overflow-hidden rounded-2xl shadow-sm ring-1 ring-black/[0.06] dark:ring-white/10">
        <KanbanBoard<AuditTarget>
          items={items}
          getItemId={(target) => target.id}
          columnDefs={columnDefs}
          activeColumnKey="status"
          renderCard={(target) => <AuditTargetCard target={target} onOpenStem={setEditingStemId} />}
          statusColumn={statusColumn}
          rightPills={rightPills}
          filters={filters}
          onFiltersChange={setFilters}
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search audit targets"
          sortByOptions={[
            { key: 'content_type', label: 'Content type' },
            { key: 'status', label: 'Status' },
          ]}
          emptyMessage="No targets in this status"
        />
      </div>

      <UcatQuestionStemDialog
        open={Boolean(editingStemId)}
        title="Edit Question Stem"
        submitLabel="Save"
        onClose={() => setEditingStemId(null)}
        onSubmit={handleStemUpdate}
        sections={(sections.data ?? []).map((section) => ({
          id: section.id,
          name: section.name,
          display_columns: section.display_columns,
        }))}
        categories={mapCategoriesToOptions(categories.data ?? []) as CategoryOption[]}
        tags={mapTagsToOptions(tags.data ?? []) as TagOption[]}
        initial={stemDetail.data}
        loading={updateStem.isPending || stemDetail.isLoading}
      />
    </div>
  )
}
