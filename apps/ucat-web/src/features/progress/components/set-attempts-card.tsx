'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
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
import { aggregateForGraph, filterByTimeFrame } from '../lib/progress-data-utils'
import type { SetAttemptRow } from '@/app/api/ucat/progress/route'
import type { ProgressMode, TimeFrameDays } from '../lib/progress-mode'

type SetAttemptsCardProps = {
  attempts: SetAttemptRow[]
  mode: ProgressMode
  timeFrameDays: TimeFrameDays
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
}: SetAttemptsCardProps) {
  const router = useRouter()
  const [graphDataType, setGraphDataType] = useState<GraphDataType>('scaled_score')
  const [graphType, setGraphType] = useState<'line' | 'bar'>('line')
  const [wasTimedFilter, setWasTimedFilter] = useState<'all' | 'timed' | 'untimed'>(
    'all'
  )
  const [setSourceFilter, setSetSourceFilter] = useState<'my' | 'public'>('public')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const standaloneAttempts = useMemo(() => {
    let result = attempts.filter((a) => !a.studentUcatMockAttemptId)
    if (wasTimedFilter === 'timed') result = result.filter((a) => a.wasTimed)
    if (wasTimedFilter === 'untimed') result = result.filter((a) => !a.wasTimed)
    if (setSourceFilter === 'my') result = result.filter((a) => a.isStudentGenerated)
    if (setSourceFilter === 'public') result = result.filter((a) => !a.isStudentGenerated)
    return filterByTimeFrame(result, mode, timeFrameDays)
  }, [attempts, wasTimedFilter, setSourceFilter, mode, timeFrameDays])

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
      isCountMetric
    )
    return {
      graphData,
      dateRangeLabel: getDateRangeLabel(mode, timeFrameDays),
    }
  }, [standaloneAttempts, graphDataType, mode, timeFrameDays])

  const paginatedAttempts = useMemo(() => {
    const start = (page - 1) * pageSize
    return standaloneAttempts.slice(start, start + pageSize)
  }, [standaloneAttempts, page, pageSize])

  return (
    <Card className="rounded-xl border-border">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle>Set attempts</CardTitle>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={wasTimedFilter} onValueChange={(v) => setWasTimedFilter(v as 'all' | 'timed' | 'untimed')}>
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="Timed" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="untimed">Untimed only</SelectItem>
              <SelectItem value="timed">Timed only</SelectItem>
              <SelectItem value="all">All</SelectItem>
            </SelectContent>
          </Select>
          <Select value={setSourceFilter} onValueChange={(v) => setSetSourceFilter(v as 'my' | 'public')}>
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="Source" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="public">Public sets</SelectItem>
              <SelectItem value="my">My sets</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={graphDataType}
            onValueChange={(v) => setGraphDataType(v as GraphDataType)}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Y-axis" />
            </SelectTrigger>
            <SelectContent>
              {GRAPH_DATA_TYPES.map((r) => (
                <SelectItem key={r.value} value={r.value}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
          <div className="rounded-xl border border-border">
            <Table className="[&_tr]:border-border">
              <TableHeader>
                <TableRow>
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
                </TableRow>
              </TableHeader>
              <TableBody>
                {standaloneAttempts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground">
                      No submitted set attempts yet
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedAttempts.map((a) => {
                    const dateStr = a.completedAt
                      ? format(new Date(a.completedAt), 'dd MMM yyyy')
                      : format(new Date(a.attemptedAt), 'dd MMM yyyy')
                    const total = a.totalPoints ?? 0
                    const points = a.scorePoints ?? 0
                    const timeLimit = a.setTimeLimitSeconds ?? 0
                    const timeTaken = a.timeTakenSeconds ?? 0
                    const setSpeed =
                      a.studentSetSpeed != null ? `${(a.studentSetSpeed * 100).toFixed(1)}%` : '—'
                    const examSpeed =
                      a.studentExamSpeed != null ? `${(a.studentExamSpeed * 100).toFixed(1)}%` : '—'

                    return (
                      <TableRow
                        key={a.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => router.push(`/progress/sets/${a.id}`)}
                      >
                        <TableCell>{dateStr}</TableCell>
                        <TableCell>{a.questionSetName ?? '—'}</TableCell>
                        <TableCell>
                          {total > 0 ? `${points} / ${total}` : '—'}
                        </TableCell>
                        <TableCell>{a.scaledScore ?? '—'}</TableCell>
                        <TableCell>
                          {timeLimit > 0 && timeTaken != null
                            ? `${formatTimeSeconds(Math.round(timeTaken))} / ${formatTimeSeconds(Math.round(timeLimit))}`
                            : '—'}
                        </TableCell>
                        <TableCell>{setSpeed}</TableCell>
                        <TableCell>{examSpeed}</TableCell>
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
