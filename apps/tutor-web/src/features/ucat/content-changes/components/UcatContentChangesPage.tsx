'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Badge,
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  ScrollArea,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tabs,
  TabsList,
  TabsTrigger,
  Textarea,
  useToast,
} from '@altitutor/ui'
import { ExternalLink, Eye, ShieldCheck, X } from 'lucide-react'
import { UcatAccessDenied, UcatPageHeader, UcatPageSkeleton } from '@/features/ucat/shared/components'
import { useUcatAccess } from '@/features/ucat/shared/hooks/useUcatAccess'
import { formatDateTime } from '@/shared/utils'
import {
  CONTENT_CHANGE_STATUSES,
  type ContentChangeStatus,
  type ContentChangeTargetType,
  type UcatContentChange,
} from '../api/content-changes'
import { useContentChanges, useReviewContentChanges } from '../hooks/useContentChanges'
import { contentChangeDiff } from '../lib/content-change-diff'

const STATUS_LABELS: Record<ContentChangeStatus, string> = {
  pending: 'Pending',
  applied: 'Applied',
  rejected: 'Rejected',
  stale: 'Stale',
}

const TYPE_LABELS: Record<ContentChangeTargetType, string> = {
  learning_module: 'Learning module',
  stem: 'Question stem',
  set: 'Question set',
  mock: 'Mock',
}

const SOURCE_LABELS: Record<UcatContentChange['source'], string> = {
  interactive_agent: 'Interactive agent',
  audit_run: 'Audit',
  assessment: 'AI assessment',
  recovery: 'Recovery',
}

function editorHref(change: UcatContentChange): string {
  if (change.targetType === 'stem') return `/ucat/questions/${change.targetId}`
  if (change.targetType === 'set') return `/ucat/sets/${change.targetId}`
  if (change.targetType === 'mock') return `/ucat/mocks/${change.targetId}`
  return `/ucat/learning-modules/${change.targetId}`
}

function ChangeDiffDialog({ change, onClose }: {
  change: UcatContentChange | null
  onClose: () => void
}) {
  const rows = useMemo(
    () => change ? contentChangeDiff(change.baseSnapshot, change.proposedSnapshot) : [],
    [change],
  )

  return (
    <Dialog open={change != null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>{change?.summary ?? 'Content change'}</DialogTitle>
          <DialogDescription>
            {change ? `${TYPE_LABELS[change.targetType]} · ${change.targetLabel}` : ''}
          </DialogDescription>
        </DialogHeader>

        {change?.rationale ? (
          <div className="rounded-lg bg-muted/60 px-4 py-3 text-sm">
            <span className="font-medium">Rationale:</span> {change.rationale}
          </div>
        ) : null}

        <ScrollArea className="max-h-[62vh] pr-3">
          <div className="space-y-3">
            {rows.map((row) => (
              <div key={row.field} className="overflow-hidden rounded-xl border">
                <div className="border-b bg-muted/50 px-3 py-2 text-xs font-semibold capitalize text-muted-foreground">
                  {row.field || 'Content'}
                </div>
                <div className="grid md:grid-cols-2">
                  <div className="min-w-0 border-b p-3 md:border-b-0 md:border-r">
                    <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Before</div>
                    <pre className="whitespace-pre-wrap break-words font-sans text-sm text-rose-800 dark:text-rose-200">{row.before}</pre>
                  </div>
                  <div className="min-w-0 p-3">
                    <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">After</div>
                    <pre className="whitespace-pre-wrap break-words font-sans text-sm text-emerald-800 dark:text-emerald-200">{row.after}</pre>
                  </div>
                </div>
              </div>
            ))}
            {rows.length === 0 ? (
              <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                No content differences were recorded.
              </div>
            ) : null}
          </div>
        </ScrollArea>

        <DialogFooter>
          {change ? (
            <Button asChild variant="outline">
              <Link href={editorHref(change)}>
                Open editor <ExternalLink className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          ) : null}
          <Button onClick={onClose}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function UcatContentChangesPage() {
  const access = useUcatAccess()
  const { toast } = useToast()
  const [status, setStatus] = useState<ContentChangeStatus>('pending')
  const changes = useContentChanges(status)
  const review = useReviewContentChanges()
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [viewing, setViewing] = useState<UcatContentChange | null>(null)
  const [applyIds, setApplyIds] = useState<string[]>([])
  const [rejectIds, setRejectIds] = useState<string[]>([])
  const [rejectionReason, setRejectionReason] = useState('')

  const rows = changes.data ?? []
  const pendingIds = rows.filter((change) => change.status === 'pending').map((change) => change.id)
  const allPendingSelected = pendingIds.length > 0 && pendingIds.every((id) => selectedIds.includes(id))

  const runReview = (action: 'apply' | 'reject', changeIds: string[], reason?: string) => {
    review.mutate(
      { action, changeIds, reason: reason?.trim() || null },
      {
        onSuccess: (result) => {
          setSelectedIds([])
          setApplyIds([])
          setRejectIds([])
          setRejectionReason('')
          toast({
            title: action === 'apply' ? 'Content changes reviewed' : 'Content changes rejected',
            description: result.failedCount > 0
              ? `${result.succeededCount} succeeded and ${result.failedCount} failed. ${result.errors[0] ?? ''}`
              : `${result.succeededCount} ${result.succeededCount === 1 ? 'change' : 'changes'} processed.`,
            variant: result.failedCount > 0 ? 'destructive' : 'default',
          })
        },
        onError: (error) => toast({
          title: 'Could not review content changes',
          description: error instanceof Error ? error.message : 'Please try again.',
          variant: 'destructive',
        }),
      },
    )
  }

  if (access.isLoading) return <UcatPageSkeleton />
  if (!access.data) return <UcatAccessDenied />

  return (
    <div className="space-y-6 py-8 md:py-10">
      <UcatPageHeader
        title="AI Content Changes"
        description="Inspect, apply, or reject durable changes proposed by UCAT agents and audits."
        backHref="/ucat"
        breadcrumbs={[{ label: 'UCAT', href: '/ucat' }, { label: 'AI Content Changes' }]}
        actions={status === 'pending' && selectedIds.length > 0 ? (
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setRejectIds(selectedIds)}>
              <X className="mr-2 h-4 w-4" /> Reject {selectedIds.length}
            </Button>
            <Button onClick={() => setApplyIds(selectedIds)}>
              <ShieldCheck className="mr-2 h-4 w-4" /> Apply {selectedIds.length}
            </Button>
          </div>
        ) : undefined}
      />

      <Tabs
        value={status}
        onValueChange={(value) => {
          setStatus(value as ContentChangeStatus)
          setSelectedIds([])
        }}
      >
        <TabsList>
          {CONTENT_CHANGE_STATUSES.map((value) => (
            <TabsTrigger key={value} value={value}>{STATUS_LABELS[value]}</TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              {status === 'pending' ? (
                <TableHead className="w-12">
                  <Checkbox
                    aria-label="Select all pending changes"
                    checked={allPendingSelected ? true : selectedIds.length > 0 ? 'indeterminate' : false}
                    onCheckedChange={(checked) => setSelectedIds(checked === true ? pendingIds : [])}
                  />
                </TableHead>
              ) : null}
              <TableHead>Change</TableHead>
              <TableHead>Target</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((change) => (
              <TableRow key={change.id}>
                {status === 'pending' ? (
                  <TableCell>
                    <Checkbox
                      aria-label={`Select ${change.summary}`}
                      checked={selectedIds.includes(change.id)}
                      onCheckedChange={(checked) => setSelectedIds((current) => checked === true
                        ? [...new Set([...current, change.id])]
                        : current.filter((id) => id !== change.id))}
                    />
                  </TableCell>
                ) : null}
                <TableCell className="max-w-md">
                  <div className="font-medium">{change.summary}</div>
                  {change.rationale ? <div className="line-clamp-2 text-sm text-muted-foreground">{change.rationale}</div> : null}
                  {change.rejectionReason ? <div className="line-clamp-2 text-sm text-destructive">{change.rejectionReason}</div> : null}
                </TableCell>
                <TableCell className="max-w-sm">
                  <Badge variant="outline">{TYPE_LABELS[change.targetType]}</Badge>
                  <div className="mt-1 line-clamp-2 text-sm">{change.targetLabel}</div>
                </TableCell>
                <TableCell>
                  <Badge variant="secondary">{SOURCE_LABELS[change.source]}</Badge>
                </TableCell>
                <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                  {formatDateTime(change.createdAt)}
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" onClick={() => setViewing(change)} aria-label={`View ${change.summary}`}>
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" asChild>
                      <Link href={editorHref(change)} aria-label={`Open ${change.targetLabel} editor`}>
                        <ExternalLink className="h-4 w-4" />
                      </Link>
                    </Button>
                    {change.status === 'pending' ? (
                      <>
                        <Button variant="ghost" size="sm" onClick={() => setRejectIds([change.id])}>Reject</Button>
                        <Button size="sm" onClick={() => setApplyIds([change.id])}>Apply</Button>
                      </>
                    ) : null}
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {changes.isError ? (
              <TableRow>
                <TableCell colSpan={status === 'pending' ? 6 : 5} className="h-32 text-center">
                  <div className="space-y-3">
                    <p className="text-sm text-destructive">Could not load content changes.</p>
                    <Button variant="outline" size="sm" onClick={() => void changes.refetch()}>Try again</Button>
                  </div>
                </TableCell>
              </TableRow>
            ) : null}
            {!changes.isLoading && !changes.isError && rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={status === 'pending' ? 6 : 5}
                  className="h-32 text-center text-muted-foreground"
                >
                  No {STATUS_LABELS[status].toLowerCase()} content changes.
                </TableCell>
              </TableRow>
            ) : null}
            {changes.isLoading ? (
              <TableRow>
                <TableCell colSpan={status === 'pending' ? 6 : 5} className="h-32 text-center text-muted-foreground">
                  Loading content changes…
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>

      <ChangeDiffDialog change={viewing} onClose={() => setViewing(null)} />

      <AlertDialog open={applyIds.length > 0} onOpenChange={(open) => !open && !review.isPending && setApplyIds([])}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apply {applyIds.length === 1 ? 'this content change' : `${applyIds.length} content changes`}?</AlertDialogTitle>
            <AlertDialogDescription>
              Each target will be revision-checked and validated independently. Stale changes will not overwrite newer work.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={review.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={review.isPending} onClick={() => runReview('apply', applyIds)}>
              Apply changes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={rejectIds.length > 0}
        onOpenChange={(open) => {
          if (!open && !review.isPending) {
            setRejectIds([])
            setRejectionReason('')
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject {rejectIds.length === 1 ? 'content change' : `${rejectIds.length} content changes`}</DialogTitle>
            <DialogDescription>The reason is retained with the change record for future reviewers.</DialogDescription>
          </DialogHeader>
          <Textarea
            value={rejectionReason}
            onChange={(event) => setRejectionReason(event.target.value)}
            placeholder="Reason for rejection (optional)"
            rows={5}
            maxLength={4000}
          />
          <DialogFooter>
            <Button
              variant="outline"
              disabled={review.isPending}
              onClick={() => {
                setRejectIds([])
                setRejectionReason('')
              }}
            >
              Cancel
            </Button>
            <Button variant="destructive" disabled={review.isPending} onClick={() => runReview('reject', rejectIds, rejectionReason)}>
              Reject changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
