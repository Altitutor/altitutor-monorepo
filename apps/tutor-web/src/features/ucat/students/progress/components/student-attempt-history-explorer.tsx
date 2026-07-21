'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { format } from 'date-fns'
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  SearchableSelect,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@altitutor/ui'
import type { PracticeAttemptRow, SetAttemptRow } from '@altitutor/shared'
import { ArrowRight, CalendarDays } from 'lucide-react'
import {
  tutorTableBodyRow,
  tutorTableHeaderRow,
  tutorTableShell,
} from '@/shared/lib/tutor-visual'
import { ProgressGraph, type GraphDataType } from './progress-graph'
import { ProgressTablePagination } from './progress-table-pagination'
import { aggregateForGraph } from '../lib/progress-data-utils'
import { formatTimeSeconds } from '../lib/format-time'
import {
  UnreviewedAttemptDot,
  UnreviewedAttemptTooltip,
} from './unreviewed-attempt-indicator'

type Attempt = PracticeAttemptRow | SetAttemptRow

type MetricOption = { value: GraphDataType; label: string }

const PAGE_SIZE_OPTIONS = [10, 20, 50]

function dateOf(attempt: Attempt) {
  return attempt.completedAt ?? attempt.attemptedAt
}

function isPractice(attempt: Attempt): attempt is PracticeAttemptRow {
  return 'ucatSectionId' in attempt
}

function nameOf(attempt: Attempt) {
  return isPractice(attempt)
    ? `${attempt.sectionName} practice`
    : (attempt.questionSetName ?? 'UCAT set')
}

function metricValue(attempt: Attempt, metric: GraphDataType): number {
  if (metric === 'attempt_count') return 1
  if (metric === 'percentage') {
    return (attempt.totalPoints ?? 0) > 0
      ? ((attempt.scorePoints ?? 0) / attempt.totalPoints!) * 100
      : 0
  }
  if (metric === 'time_taken') return attempt.timeTakenSeconds ?? 0
  if (!isPractice(attempt)) {
    if (metric === 'scaled_score') return attempt.scaledScore ?? 0
    if (metric === 'exam_speed') return (attempt.studentExamSpeed ?? 0) * 100
  }
  return 0
}

function formattedMetric(attempt: Attempt, metric: GraphDataType): string {
  const value = metricValue(attempt, metric)
  if (metric === 'percentage') return `${Math.round(value)}% accuracy`
  if (metric === 'time_taken') return formatTimeSeconds(Math.round(value))
  if (metric === 'exam_speed') return `${(value / 100).toFixed(2)}x exam speed`
  if (metric === 'scaled_score')
    return value > 0 ? `${Math.round(value)} scaled` : '—'
  return `${Math.round(value)} attempt${value === 1 ? '' : 's'}`
}

export function StudentAttemptHistoryExplorer({
  source,
  title,
  description,
  attempts,
  basePath,
}: {
  source: 'practice' | 'set'
  title: string
  description: string
  attempts: Attempt[]
  basePath: string
}) {
  const options: MetricOption[] =
    source === 'practice'
      ? [
          { value: 'percentage', label: 'Accuracy' },
          { value: 'time_taken', label: 'Time taken' },
          { value: 'attempt_count', label: 'Number of attempts' },
        ]
      : [
          { value: 'scaled_score', label: 'Scaled score' },
          { value: 'percentage', label: 'Accuracy' },
          { value: 'exam_speed', label: 'Exam speed' },
          { value: 'time_taken', label: 'Time taken' },
        ]
  const [metric, setMetric] = useState<GraphDataType>(options[0].value)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const sortedAttempts = useMemo(
    () => [...attempts].sort((a, b) => dateOf(b).localeCompare(dateOf(a))),
    [attempts]
  )
  const graphData = useMemo(
    () =>
      aggregateForGraph(
        attempts,
        dateOf,
        (attempt) => metricValue(attempt, metric),
        'all_time',
        '30',
        false
      ),
    [attempts, metric]
  )
  const paginated = sortedAttempts.slice((page - 1) * pageSize, page * pageSize)
  const hrefFor = (attempt: Attempt) =>
    isPractice(attempt) ? null : `${basePath}/sets/${attempt.id}`

  return (
    <section
      aria-labelledby={`${source}-attempt-history-title`}
      className="relative isolate overflow-hidden border-b border-border/50 bg-gradient-to-b from-background via-muted/15 to-background px-5 py-6 sm:px-8 lg:px-10"
    >
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2
            id={`${source}-attempt-history-title`}
            className="text-xl font-semibold tracking-tight"
          >
            {title}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
        <SearchableSelect<MetricOption>
          items={options}
          value={
            options.find((option) => option.value === metric) ?? options[0]
          }
          onValueChange={(option) => option && setMetric(option.value)}
          getItemLabel={(option) => option.label}
          getItemId={(option) => option.value}
          placeholder="Metric"
          triggerClassName="w-[165px]"
        />
      </div>

      <div className="relative min-h-[420px]">
        <ProgressGraph
          data={graphData}
          type="bar"
          dataType={metric}
          className="pt-1 lg:pr-[450px]"
        />

        <aside className="mt-4 rounded-2xl border border-border/70 bg-card/94 p-5 shadow-xl backdrop-blur-xl lg:absolute lg:right-0 lg:top-2 lg:mt-0 lg:w-[430px]">
          <p className="text-xs font-semibold uppercase tracking-[0.13em] text-muted-foreground">
            Recent attempts
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            The latest completed work in this section.
          </p>
          <div className="mt-4 divide-y divide-border/60">
            {sortedAttempts.length ? (
              sortedAttempts.slice(0, 6).map((attempt) => {
                const href = hrefFor(attempt)
                const content = (
                  <>
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                      <CalendarDays className="size-4" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {nameOf(attempt)}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {formattedMetric(attempt, metric)} ·{' '}
                        {format(new Date(dateOf(attempt)), 'd MMM')}
                      </span>
                    </span>
                    {href ? (
                      <ArrowRight
                        className="size-4 shrink-0 text-muted-foreground"
                        aria-hidden
                      />
                    ) : null}
                    {attempt.reviewCompletedAt == null ? (
                      <UnreviewedAttemptDot />
                    ) : null}
                  </>
                )
                const attemptRow = href ? (
                  <Link
                    key={attempt.id}
                    href={href}
                    className="group flex items-center gap-3 py-3 first:pt-0 last:pb-0"
                    aria-label={
                      attempt.reviewCompletedAt == null
                        ? `${nameOf(attempt)}. This attempt is unreviewed.`
                        : undefined
                    }
                  >
                    {content}
                  </Link>
                ) : (
                  <div
                    key={attempt.id}
                    className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
                    tabIndex={attempt.reviewCompletedAt == null ? 0 : undefined}
                    aria-label={
                      attempt.reviewCompletedAt == null
                        ? `${nameOf(attempt)}. This attempt is unreviewed.`
                        : undefined
                    }
                  >
                    {content}
                  </div>
                )
                return attempt.reviewCompletedAt == null ? (
                  <UnreviewedAttemptTooltip key={attempt.id}>
                    {attemptRow}
                  </UnreviewedAttemptTooltip>
                ) : (
                  attemptRow
                )
              })
            ) : (
              <p className="py-5 text-sm text-muted-foreground">
                No completed attempts yet.
              </p>
            )}
          </div>
          <Button
            type="button"
            variant="ghost"
            className="mt-4 w-full"
            onClick={() => setDialogOpen(true)}
          >
            View all attempts
          </Button>
        </aside>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="flex max-h-[90vh] w-[min(96vw,1200px)] max-w-none flex-col overflow-hidden sm:max-w-6xl">
          <DialogHeader className="shrink-0">
            <DialogTitle>All {title.toLowerCase()}</DialogTitle>
            <DialogDescription>
              Paginated history for this section.
            </DialogDescription>
          </DialogHeader>
          <div
            className={`${tutorTableShell} min-h-0 flex-1 overflow-auto overscroll-contain`}
          >
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-card">
                <TableRow className={tutorTableHeaderRow}>
                  <TableHead>Date</TableHead>
                  <TableHead>Attempt</TableHead>
                  <TableHead>Result</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.length ? (
                  paginated.map((attempt) => {
                    const href = hrefFor(attempt)
                    const action = href ? (
                      <Button asChild size="sm" variant="ghost">
                        <Link
                          href={href}
                          className="inline-flex items-center gap-1.5"
                          aria-label={
                            attempt.reviewCompletedAt == null
                              ? 'View attempt. This attempt is unreviewed.'
                              : 'View attempt'
                          }
                        >
                          View attempt
                          {attempt.reviewCompletedAt == null ? (
                            <UnreviewedAttemptDot />
                          ) : null}
                        </Link>
                      </Button>
                    ) : null
                    return (
                      <TableRow key={attempt.id} className={tutorTableBodyRow}>
                        <TableCell>
                          {format(new Date(dateOf(attempt)), 'dd MMM yyyy')}
                        </TableCell>
                        <TableCell className="font-medium">
                          {nameOf(attempt)}
                        </TableCell>
                        <TableCell>
                          {formattedMetric(attempt, metric)}
                        </TableCell>
                        <TableCell>
                          {href ? (
                            attempt.reviewCompletedAt == null ? (
                              <UnreviewedAttemptTooltip>
                                {action!}
                              </UnreviewedAttemptTooltip>
                            ) : (
                              action
                            )
                          ) : (
                            attempt.reviewCompletedAt == null ? (
                              <UnreviewedAttemptTooltip>
                                <span
                                  className="inline-flex items-center gap-2 text-xs text-muted-foreground"
                                  tabIndex={0}
                                  aria-label="This attempt is unreviewed."
                                >
                                  Unreviewed
                                  <UnreviewedAttemptDot />
                                </span>
                              </UnreviewedAttemptTooltip>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })
                ) : (
                  <TableRow className={tutorTableBodyRow}>
                    <TableCell
                      colSpan={4}
                      className="py-10 text-center text-muted-foreground"
                    >
                      No attempts yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <div className="shrink-0">
            <ProgressTablePagination
              page={page}
              pageSize={pageSize}
              total={sortedAttempts.length}
              onPageChange={setPage}
              onPageSizeChange={(size) => {
                setPageSize(size)
                setPage(1)
              }}
              pageSizeOptions={PAGE_SIZE_OPTIONS}
            />
          </div>
        </DialogContent>
      </Dialog>
    </section>
  )
}
