'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { format, subDays } from 'date-fns'
import {
  Button,
  Card,
  CardContent,
  SearchableSelect,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@altitutor/ui'
import type { MockAttemptRow, SectionProgress } from '@altitutor/shared'
import { lookupUcatAnzTotalPercentile } from '@altitutor/ucat-percentiles'
import {
  tutorCardCn,
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

type MetricOption = { value: GraphDataType; label: string }
type DateRange = 'all' | '30' | '90'

const GRAPH_DATA_TYPES: MetricOption[] = [
  { value: 'scaled_score', label: 'Scaled score' },
  { value: 'percentage', label: 'Accuracy' },
  { value: 'time_taken', label: 'Time taken' },
  { value: 'exam_speed', label: 'Exam speed' },
]
const DATE_RANGES: Array<{ value: DateRange; label: string }> = [
  { value: 'all', label: 'All time' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
]
const PAGE_SIZE_OPTIONS = [10, 20, 50]

function attemptDate(attempt: MockAttemptRow) {
  return attempt.completedAt ?? attempt.attemptedAt
}

function metricValue(attempt: MockAttemptRow, metric: GraphDataType): number {
  if (metric === 'scaled_score') return attempt.scaledScore ?? 0
  if (metric === 'percentage')
    return (attempt.totalPoints ?? 0) > 0
      ? ((attempt.scorePoints ?? 0) / attempt.totalPoints!) * 100
      : 0
  if (metric === 'time_taken') return attempt.timeTakenSeconds ?? 0
  return (attempt.studentExamSpeed ?? 0) * 100
}

function formatMetric(attempt: MockAttemptRow, metric: GraphDataType): string {
  const value = metricValue(attempt, metric)
  if (metric === 'percentage') return `${Math.round(value)}%`
  if (metric === 'time_taken') return formatTimeSeconds(Math.round(value))
  if (metric === 'exam_speed') return `${(value / 100).toFixed(2)}x`
  return value > 0 ? Math.round(value).toString() : '—'
}

function recentWeightedScore(attempts: MockAttemptRow[]): number | null {
  const scored = attempts.filter((attempt) => attempt.scaledScore != null)
  if (!scored.length) return null
  const newest = Math.max(
    ...scored.map((attempt) => new Date(attemptDate(attempt)).getTime())
  )
  let total = 0
  let weight = 0
  for (const attempt of scored) {
    const ageDays = Math.max(
      0,
      (newest - new Date(attemptDate(attempt)).getTime()) / 86_400_000
    )
    const currentWeight = 0.5 ** (ageDays / 60)
    total += attempt.scaledScore! * currentWeight
    weight += currentWeight
  }
  return weight ? Math.round(total / weight) : null
}

export function MockAttemptsCard({
  attempts,
  sections,
  basePath,
}: {
  attempts: MockAttemptRow[]
  sections: SectionProgress[]
  basePath: string
}) {
  const [metric, setMetric] = useState<GraphDataType>('scaled_score')
  const [dateRange, setDateRange] = useState<DateRange>('all')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const filteredAttempts = useMemo(() => {
    const cutoff =
      dateRange === 'all' ? null : subDays(new Date(), Number(dateRange))
    return [...attempts]
      .filter((attempt) => !cutoff || new Date(attemptDate(attempt)) >= cutoff)
      .sort((a, b) => attemptDate(b).localeCompare(attemptDate(a)))
  }, [attempts, dateRange])
  const graphData = useMemo(
    () =>
      aggregateForGraph(
        filteredAttempts,
        attemptDate,
        (attempt) => metricValue(attempt, metric),
        'all_time',
        '30',
        false
      ),
    [filteredAttempts, metric]
  )
  const scoreValues = graphData.flatMap((point) =>
    point.value == null ? [] : [point.value]
  )
  const trend =
    scoreValues.length > 1
      ? Math.round(scoreValues.at(-1)! - scoreValues[0]!)
      : null
  const weightedAverage = recentWeightedScore(filteredAttempts)
  const benchmark = lookupUcatAnzTotalPercentile(weightedAverage)
  const withScores = filteredAttempts.filter(
    (attempt) => attempt.scaledScore != null
  )
  const averageScore = withScores.length
    ? Math.round(
        withScores.reduce((sum, attempt) => sum + attempt.scaledScore!, 0) /
          withScores.length
      )
    : null
  const unreviewedCount = filteredAttempts.filter(
    (attempt) => attempt.reviewCompletedAt == null
  ).length
  const yAxisMax = Math.max(
    2700,
    ...filteredAttempts.map((attempt) => attempt.scaledScoreMax ?? 0)
  )
  const paginated = filteredAttempts.slice(
    (page - 1) * pageSize,
    page * pageSize
  )

  return (
    <div className="space-y-6">
      <section className="relative isolate overflow-hidden border-b border-border/50 bg-gradient-to-b from-background via-muted/15 to-background px-5 py-6 sm:px-8 lg:px-10">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
              Mock progress
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Full-mock scores over time, with the most useful context beside
              the chart.
            </p>
          </div>
          <div className="flex gap-2">
            <SearchableSelect<MetricOption>
              items={GRAPH_DATA_TYPES}
              value={
                GRAPH_DATA_TYPES.find((option) => option.value === metric) ??
                GRAPH_DATA_TYPES[0]
              }
              onValueChange={(option) => option && setMetric(option.value)}
              getItemLabel={(option) => option.label}
              getItemId={(option) => option.value}
              triggerClassName="w-[150px]"
            />
            <SearchableSelect<{ value: DateRange; label: string }>
              items={DATE_RANGES}
              value={
                DATE_RANGES.find((option) => option.value === dateRange) ??
                DATE_RANGES[0]
              }
              onValueChange={(option) => {
                if (option) {
                  setDateRange(option.value)
                  setPage(1)
                }
              }}
              getItemLabel={(option) => option.label}
              getItemId={(option) => option.value}
              triggerClassName="w-[140px]"
            />
          </div>
        </div>
        <div className="relative mt-3 min-h-[430px]">
          <ProgressGraph
            data={graphData}
            type="bar"
            dataType={metric}
            isMockContext
            yAxisMax={metric === 'scaled_score' ? yAxisMax : undefined}
            className="lg:pr-[410px]"
          />
          <aside className="mt-4 rounded-2xl border border-border/70 bg-card/94 p-5 shadow-xl backdrop-blur-xl lg:absolute lg:right-0 lg:top-2 lg:mt-0 lg:w-[390px]">
            <p className="text-xs font-semibold uppercase tracking-[0.13em] text-muted-foreground">
              Mock insight
            </p>
            <div className="mt-3 flex items-end justify-between gap-4">
              <div>
                <p className="text-sm text-muted-foreground">
                  Recent-weighted average
                </p>
                <p className="text-4xl font-semibold tabular-nums">
                  {weightedAverage ?? '—'}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">UCAT ANZ</p>
                <p className="font-medium">
                  {benchmark.percentileLabel ?? 'Not available'}
                </p>
              </div>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              {trend == null
                ? 'Complete at least two mocks to reveal whether exam-day performance is improving.'
                : trend > 0
                  ? `The selected mock trajectory is up ${trend} points. Check the section breakdown to see whether that improvement is balanced.`
                  : trend < 0
                    ? `The selected mock trajectory is down ${Math.abs(trend)} points. Review timing and section-level misses before the next mock.`
                    : 'Mock scores are stable. Section-level review is the best way to find the next gain.'}
            </p>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              Recent mocks carry more weight, with influence halving every 60
              days. The simple average is shown below.
            </p>
            <div className="mt-4 space-y-2 border-t border-border/60 pt-4">
              {sections
                .filter((section) => section.sectionNumber <= 3)
                .map((section) => (
                  <div
                    key={section.sectionId}
                    className="flex items-center justify-between gap-4 text-sm"
                  >
                    <span className="truncate text-muted-foreground">
                      {section.sectionName}
                    </span>
                    <span className="font-medium tabular-nums">
                      {section.averageScaledScore == null
                        ? '—'
                        : Math.round(section.averageScaledScore)}
                    </span>
                  </div>
                ))}
            </div>
          </aside>
        </div>
      </section>

      <section
        aria-label="Mock progress summary"
        className="mx-auto grid w-full max-w-[1400px] gap-4 px-5 sm:grid-cols-3 sm:px-6"
      >
        <Card className={tutorCardCn()}>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Mocks completed</p>
            <p className="mt-2 text-3xl font-semibold tabular-nums">
              {filteredAttempts.length}
            </p>
          </CardContent>
        </Card>
        <Card className={tutorCardCn()}>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Average mock score</p>
            <p className="mt-2 text-3xl font-semibold tabular-nums">
              {averageScore ?? '—'}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Simple average across completed mocks
            </p>
          </CardContent>
        </Card>
        <Card className={tutorCardCn()}>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Unreviewed attempts</p>
            <p className="mt-2 text-3xl font-semibold tabular-nums">
              {unreviewedCount}
            </p>
          </CardContent>
        </Card>
      </section>

      <section className="mx-auto w-full max-w-[1400px] space-y-4 px-5 sm:px-6">
        <h2 className="text-xl font-semibold tracking-tight">Mock attempts</h2>
        <div className={tutorTableShell}>
          <Table>
            <TableHeader>
              <TableRow className={tutorTableHeaderRow}>
                <TableHead>Date</TableHead>
                <TableHead>Mock</TableHead>
                <TableHead>
                  {
                    GRAPH_DATA_TYPES.find((option) => option.value === metric)
                      ?.label
                  }
                </TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.length ? (
                paginated.map((attempt) => {
                  const action = (
                    <Button asChild size="sm" variant="ghost">
                      <Link
                        href={`${basePath}/mocks/${attempt.id}`}
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
                  )
                  return (
                    <TableRow key={attempt.id} className={tutorTableBodyRow}>
                      <TableCell>
                        {format(
                          new Date(attemptDate(attempt)),
                          'dd MMM yyyy'
                        )}
                      </TableCell>
                      <TableCell>{attempt.mockName ?? '—'}</TableCell>
                      <TableCell>{formatMetric(attempt, metric)}</TableCell>
                      <TableCell>
                        {attempt.reviewCompletedAt == null ? (
                          <UnreviewedAttemptTooltip>
                            {action}
                          </UnreviewedAttemptTooltip>
                        ) : (
                          action
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })
              ) : (
                <TableRow className={tutorTableBodyRow}>
                  <TableCell
                    colSpan={4}
                    className="py-8 text-center text-muted-foreground"
                  >
                    No submitted mock attempts yet
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        <ProgressTablePagination
          page={page}
          pageSize={pageSize}
          total={filteredAttempts.length}
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size)
            setPage(1)
          }}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
        />
      </section>
    </div>
  )
}
