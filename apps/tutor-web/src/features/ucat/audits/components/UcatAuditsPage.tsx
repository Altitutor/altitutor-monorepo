'use client'

import { useMemo, useState } from 'react'
import type { DataTableColumnDefinition, DataTableFilterDefinition, DataTableSortOption } from '@altitutor/shared'
import {
  Badge,
  DataTableToolbar,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TablePagination,
  TableRow,
  useToast,
} from '@altitutor/ui'
import { Eye } from 'lucide-react'
import { UcatAccessDenied, UcatPageHeader, UcatPageSkeleton } from '@/features/ucat/shared/components'
import { useUcatAccess } from '@/features/ucat/shared/hooks/useUcatAccess'
import { useUcatTableUrlState } from '@/features/ucat/shared/hooks/useUcatTableUrlState'
import { UcatRowActions } from '@/features/ucat/shared/row-actions'
import { cn, formatDateTime } from '@/shared/utils'
import {
  tutorTableBodyRow,
  tutorTableHeaderRow,
  tutorTableShell,
  tutorToolbarProps,
} from '@/shared/lib/tutor-visual'
import { AUDIT_RUN_STATUSES, type AuditRun, type AuditRunStatus } from '../api/audits'
import { useAudits, useSetAuditRunStatus } from '../hooks/useAudits'
import { AUDIT_RUN_STATUS_LABELS } from '../lib/audit-run-status'
import {
  auditRunChangeStatusAction,
  UcatAuditRunStatusConfirmDialog,
} from './UcatAuditRunStatusConfirmDialog'

const COLUMNS = [
  { key: 'title', label: 'Audit', visibleByDefault: true },
  { key: 'status', label: 'Status', visibleByDefault: true },
  { key: 'progress', label: 'Progress', visibleByDefault: true },
  { key: 'workflow', label: 'Workflow', visibleByDefault: true },
  { key: 'created_at', label: 'Created', visibleByDefault: true },
  { key: 'actions', label: '', visibleByDefault: true },
] satisfies DataTableColumnDefinition[]

const DEFAULT_COLUMNS = COLUMNS.filter((column) => column.visibleByDefault).map((column) => column.key)

const FILTERS: DataTableFilterDefinition[] = [
  {
    key: 'status',
    label: 'Status',
    options: AUDIT_RUN_STATUSES.map((status) => ({ value: status, label: AUDIT_RUN_STATUS_LABELS[status] })),
  },
]

const SORTS: DataTableSortOption[] = [
  { key: 'created_at', label: 'Created' },
  { key: 'title', label: 'Audit title' },
  { key: 'status', label: 'Status' },
]

function targetTotal(audit: AuditRun): number {
  return Object.values(audit.targetCounts).reduce((total, count) => total + (count ?? 0), 0)
}

function finishedTotal(audit: AuditRun): number {
  return (audit.targetCounts.completed ?? 0) +
    (audit.targetCounts.failed ?? 0) +
    (audit.targetCounts.skipped ?? 0)
}

export function UcatAuditsPage() {
  const access = useUcatAccess()
  const audits = useAudits()
  const setRunStatus = useSetAuditRunStatus()
  const { toast } = useToast()
  const [pendingChange, setPendingChange] = useState<{
    auditId: string
    from: AuditRunStatus
    to: AuditRunStatus
  } | null>(null)
  const tableState = useUcatTableUrlState(DEFAULT_COLUMNS, {
    availableColumns: COLUMNS.map((column) => column.key),
  })

  const visibleRows = useMemo(() => {
    const search = tableState.state.search.trim().toLowerCase()
    const statuses = (tableState.state.filters.status ?? []).map(String)
    const filtered = (audits.data ?? []).filter((audit) => {
      const matchesSearch = !search || [audit.title, audit.brief, audit.workflowId]
        .some((value) => value?.toLowerCase().includes(search))
      const matchesStatus = statuses.length === 0 || statuses.includes(audit.status)
      return matchesSearch && matchesStatus
    })
    const sorted = [...filtered].sort((left, right) => {
      const field = tableState.state.sortBy ?? 'created_at'
      const leftValue = field === 'title' ? left.title : field === 'status' ? left.status : left.createdAt
      const rightValue = field === 'title' ? right.title : field === 'status' ? right.status : right.createdAt
      const comparison = leftValue.localeCompare(rightValue)
      return tableState.state.sortDirection === 'asc' ? comparison : -comparison
    })
    return sorted
  }, [audits.data, tableState.state.filters.status, tableState.state.search, tableState.state.sortBy, tableState.state.sortDirection])

  if (access.isLoading) return <UcatPageSkeleton />
  if (!access.data) return <UcatAccessDenied />

  const { page, pageSize, visibleColumns } = tableState.state
  const totalPages = Math.max(1, Math.ceil(visibleRows.length / pageSize))
  const effectivePage = Math.min(page, totalPages)
  const pageRows = visibleRows.slice((effectivePage - 1) * pageSize, effectivePage * pageSize)
  const show = (key: string) => visibleColumns.includes(key)

  return (
    <div className="space-y-6 py-8 md:py-10">
      <UcatPageHeader
        title="UCAT Audits"
        description="Review current and historical UCAT content audits."
        backHref="/ucat"
        breadcrumbs={[{ label: 'UCAT', href: '/ucat' }, { label: 'Audits' }]}
      />

      <DataTableToolbar
        state={tableState.state}
        onSearchChange={tableState.actions.onSearchChange}
        onFiltersChange={tableState.actions.onFiltersChange}
        onSortChange={tableState.actions.onSortChange}
        onGroupByChange={tableState.actions.onGroupByChange}
        onVisibleColumnsChange={tableState.actions.onVisibleColumnsChange}
        onQuickFilterApply={tableState.actions.onQuickFilterApply}
        onReset={tableState.actions.onReset}
        filterDefinitions={FILTERS}
        columnDefinitions={COLUMNS}
        sortOptions={SORTS}
        searchPlaceholder="Search audits"
        isLoading={audits.isLoading}
        {...tutorToolbarProps}
      />

      <div className={tutorTableShell}>
        <Table>
          <TableHeader>
            <TableRow className={tutorTableHeaderRow}>
              {show('title') && <TableHead>Audit</TableHead>}
              {show('status') && <TableHead>Status</TableHead>}
              {show('progress') && <TableHead>Progress</TableHead>}
              {show('workflow') && <TableHead>Workflow</TableHead>}
              {show('created_at') && <TableHead>Created</TableHead>}
              {show('actions') && <TableHead className="w-14" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageRows.map((audit) => {
              const total = targetTotal(audit)
              const finished = finishedTotal(audit)
              return (
                <TableRow key={audit.id} className={tutorTableBodyRow}>
                  {show('title') && (
                    <TableCell>
                      <div className="font-medium">{audit.title}</div>
                      {audit.brief ? <div className="line-clamp-1 max-w-xl text-sm text-muted-foreground">{audit.brief}</div> : null}
                    </TableCell>
                  )}
                  {show('status') && (
                    <TableCell>
                      <Badge variant={audit.status === 'active' ? 'default' : 'secondary'}>
                        {AUDIT_RUN_STATUS_LABELS[audit.status]}
                      </Badge>
                    </TableCell>
                  )}
                  {show('progress') && <TableCell>{finished} / {total}</TableCell>}
                  {show('workflow') && <TableCell>{audit.workflowId ?? '—'}</TableCell>}
                  {show('created_at') && <TableCell>{formatDateTime(audit.createdAt)}</TableCell>}
                  {show('actions') && (
                    <TableCell>
                      <UcatRowActions actions={[
                        {
                          label: 'View',
                          href: `/ucat/audits/${audit.id}`,
                          icon: <Eye className="h-4 w-4" />,
                        },
                        auditRunChangeStatusAction((status) => setPendingChange({
                          auditId: audit.id,
                          from: audit.status,
                          to: status,
                        })),
                      ]} />
                    </TableCell>
                  )}
                </TableRow>
              )
            })}
            {!audits.isLoading && pageRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={visibleColumns.length} className={cn('h-28 text-center text-muted-foreground')}>
                  No audits found.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>

      <TablePagination
        page={effectivePage}
        pageSize={pageSize}
        total={visibleRows.length}
        onPageChange={tableState.actions.onPageChange}
        onPageSizeChange={tableState.actions.onPageSizeChange}
        pageSizeOptions={[10, 20, 50, 100]}
      />

      <UcatAuditRunStatusConfirmDialog
        currentStatus={pendingChange?.from ?? null}
        nextStatus={pendingChange?.to ?? null}
        pending={setRunStatus.isPending}
        onOpenChange={(open) => {
          if (!open && !setRunStatus.isPending) setPendingChange(null)
        }}
        onConfirm={() => {
          if (!pendingChange) return
          setRunStatus.mutate(
            { auditId: pendingChange.auditId, status: pendingChange.to },
            {
              onSuccess: () => {
                setPendingChange(null)
                toast({ title: `Audit is now ${AUDIT_RUN_STATUS_LABELS[pendingChange.to].toLowerCase()}` })
              },
              onError: (error) => toast({
                title: 'Could not change audit status',
                description: error instanceof Error ? error.message : 'Please try again.',
                variant: 'destructive',
              }),
            },
          )
        }}
      />
    </div>
  )
}
