'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  SearchableSelect,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@altitutor/ui'
import { TableHeaderWithTooltip } from './table-header-with-tooltip'
import { ProgressTablePagination } from './progress-table-pagination'
import { GraphTypeTabs } from './graph-type-tabs'
import { format } from 'date-fns'
import { ProgressGraph, type GraphDataType } from './progress-graph'
import { formatTimeSeconds } from '../lib/format-time'
import {
  aggregateForGraph,
  filterByTimeFrame,
  type SharedDateRange,
} from '../lib/progress-data-utils'
import type { SetAttemptRow } from '@altitutor/shared'
import type { ProgressMode, TimeFrameDays } from '../lib/progress-mode'
import { tutorCardCn, tutorTableBodyRow, tutorTableHeaderRow, tutorTableShell } from '@/shared/lib/tutor-visual'

type SetAttemptsCardProps = {
  attempts: SetAttemptRow[]
  mode: ProgressMode
  timeFrameDays: TimeFrameDays
  sharedDateRange?: SharedDateRange
  /** Base path for navigation (e.g. /ucat/students/123) */
  basePath?: string
}

const GRAPH_DATA_TYPES: { value: GraphDataType; label: string }[] = [
  { value: 'scaled_score', label: 'Scaled score' },
  { value: 'percentage', label: 'Percentage' },
  { value: 'time_taken', label: 'Time taken' },
  { value: 'exam_speed', label: 'Exam speed' },
  { value: 'attempt_count', label: 'Number of attempts' },
]

const PAGE_SIZE_OPTIONS = [10, 20, 50]

function getDateRangeLabel(mode: ProgressMode, timeFrameDays: TimeFrameDays): string {
  if (mode === 'time_frame') return `Last ${timeFrameDays} days`
  return mode === 'weighted' ? 'Weighted average (all time)' : 'All time'
}

export function SetAttemptsCard({
  attempts,
  mode,
  timeFrameDays,
  sharedDateRange,
  basePath = '',
}: SetAttemptsCardProps) {
  const [graphDataType, setGraphDataType] = useState<GraphDataType>('scaled_score')
  const [graphType, setGraphType] = useState<'line' | 'bar'>('line')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const standaloneAttempts = useMemo(() => {
    const result = attempts.filter((a) => !a.studentUcatMockAttemptId)
    return filterByTimeFrame(result, mode, timeFrameDays)
  }, [attempts, mode, timeFrameDays])

  const { graphData, dateRangeLabel } = useMemo(() => {
    const isCountMetric = graphDataType === 'attempt_count'
    const graphData = aggregateForGraph(
      standaloneAttempts,
      (a) => a.completedAt ?? a.attemptedAt,
      (a) => {
        if (graphDataType === 'scaled_score') return a.scaledScore ?? 0
        if (graphDataType === 'percentage') {
          const total = a.totalPoints ?? 0
          return total > 0 ? ((a.scorePoints ?? 0) / total) * 100 : 0
        }
        if (graphDataType === 'time_taken') return Math.round(a.timeTakenSeconds ?? 0)
        if (graphDataType === 'attempt_count') return 1
        return (a.studentExamSpeed ?? 0) * 100
      },
      mode,
      timeFrameDays,
      isCountMetric,
      sharedDateRange
    )
    return {
      graphData,
      dateRangeLabel: getDateRangeLabel(mode, timeFrameDays),
    }
  }, [standaloneAttempts, graphDataType, mode, timeFrameDays, sharedDateRange])

  const paginatedAttempts = useMemo(() => {
    const start = (page - 1) * pageSize
    return standaloneAttempts.slice(start, start + pageSize)
  }, [standaloneAttempts, page, pageSize])

  const setDetailHref = (attemptId: string) =>
    basePath ? `${basePath}/sets/${attemptId}` : null

  return (
    <Card className={tutorCardCn()}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle>Set attempts</CardTitle>
        <div className="flex flex-wrap items-center gap-2">
          <SearchableSelect<{ value: GraphDataType; label: string }>
            items={GRAPH_DATA_TYPES}
            value={GRAPH_DATA_TYPES.find((r) => r.value === graphDataType) ?? GRAPH_DATA_TYPES[0]}
            onValueChange={(item) => item && setGraphDataType(item.value)}
            getItemLabel={(r) => r.label}
            getItemId={(r) => r.value}
            placeholder="Y-axis"
            triggerClassName="w-[160px]"
          />
          <GraphTypeTabs value={graphType} onValueChange={setGraphType} />
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <ProgressGraph
          data={graphData}
          type={graphType}
          dataType={graphDataType}
          dateRangeLabel={dateRangeLabel}
        />
        <div>
          <h4 className="mb-3 text-sm font-medium">All set attempts</h4>
          <div className={tutorTableShell}>
            <Table>
              <TableHeader className="[&_tr]:border-b-0">
                <TableRow className={tutorTableHeaderRow}>
                  <TableHead>Date</TableHead>
                  <TableHead>Set</TableHead>
                  <TableHeaderWithTooltip
                    tooltip="Raw score: correct points earned out of total possible points for this set."
                  >
                    Points
                  </TableHeaderWithTooltip>
                  <TableHeaderWithTooltip
                    tooltip="Scaled score (0–900) normalised to UCAT exam scale for this section."
                  >
                    Scaled score
                  </TableHeaderWithTooltip>
                  <TableHeaderWithTooltip
                    tooltip="Time taken vs time limit for this set (e.g. 25:00 / 30:00)."
                  >
                    Time
                  </TableHeaderWithTooltip>
                  <TableHeaderWithTooltip
                    tooltip="How fast you completed this set vs its time limit. >100% means you finished early."
                  >
                    Set speed
                  </TableHeaderWithTooltip>
                  <TableHeaderWithTooltip
                    tooltip="How fast you completed this set vs exam-pace time. >100% means you finished faster than exam pace."
                  >
                    Exam speed
                  </TableHeaderWithTooltip>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {standaloneAttempts.length === 0 ? (
                  <TableRow className={tutorTableBodyRow}>
                    <TableCell colSpan={8} className="text-center text-muted-foreground">
                      No submitted set attempts yet
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedAttempts.map((a) => {
                    const href = setDetailHref(a.id)
                    return (
                      <TableRow key={a.id} className={tutorTableBodyRow}>
                        <TableCell>
                          {a.completedAt
                            ? format(new Date(a.completedAt), 'dd MMM yyyy')
                            : format(new Date(a.attemptedAt), 'dd MMM yyyy')}
                        </TableCell>
                        <TableCell>{a.questionSetName ?? '—'}</TableCell>
                        <TableCell>
                          {(a.totalPoints ?? 0) > 0
                            ? `${a.scorePoints ?? 0} / ${a.totalPoints ?? 0}`
                            : '—'}
                        </TableCell>
                        <TableCell>{a.scaledScore ?? '—'}</TableCell>
                        <TableCell>
                          {(a.setTimeLimitSeconds ?? 0) > 0 && a.timeTakenSeconds != null
                            ? `${formatTimeSeconds(Math.round(a.timeTakenSeconds))} / ${formatTimeSeconds(Math.round(a.setTimeLimitSeconds ?? 0))}`
                            : '—'}
                        </TableCell>
                        <TableCell>
                          {a.studentSetSpeed != null
                            ? `${(a.studentSetSpeed * 100).toFixed(1)}%`
                            : '—'}
                        </TableCell>
                        <TableCell>
                          {a.studentExamSpeed != null
                            ? `${(a.studentExamSpeed * 100).toFixed(1)}%`
                            : '—'}
                        </TableCell>
                        <TableCell className="text-right">
                          {href ? (
                            <Button variant="outline" size="sm" asChild>
                              <Link href={href}>View attempt</Link>
                            </Button>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
          {standaloneAttempts.length > 0 ? (
            <ProgressTablePagination
              page={page}
              pageSize={pageSize}
              total={standaloneAttempts.length}
              onPageChange={setPage}
              onPageSizeChange={(size) => {
                setPageSize(size)
                setPage(1)
              }}
              pageSizeOptions={PAGE_SIZE_OPTIONS}
            />
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}
