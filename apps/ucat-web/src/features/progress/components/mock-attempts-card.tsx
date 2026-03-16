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
import { ProgressTablePagination } from './progress-table-pagination'
import { GraphTypeTabs } from './graph-type-tabs'
import { format } from 'date-fns'
import { ProgressGraph, type GraphDataType } from './progress-graph'
import { formatTimeSeconds } from '../lib/format-time'
import { aggregateForGraph, filterByTimeFrame } from '../lib/progress-data-utils'
import type { MockAttemptRow } from '@/app/api/ucat/progress/route'
import type { ProgressMode, TimeFrameDays } from '../lib/progress-mode'

type MockAttemptsCardProps = {
  attempts: MockAttemptRow[]
  mode: ProgressMode
  timeFrameDays: TimeFrameDays
}

const GRAPH_DATA_TYPES: { value: GraphDataType; label: string }[] = [
  { value: 'scaled_score', label: 'Scaled score' },
  { value: 'percentage', label: 'Percentage' },
  { value: 'time_taken', label: 'Time taken' },
  { value: 'exam_speed', label: 'Exam speed' },
]

const PAGE_SIZE_OPTIONS = [10, 20, 50]

function getDateRangeLabel(mode: ProgressMode, timeFrameDays: TimeFrameDays): string {
  if (mode === 'time_frame') return `Last ${timeFrameDays} days`
  return mode === 'weighted' ? 'Weighted average (all time)' : 'All time'
}

export function MockAttemptsCard({
  attempts,
  mode,
  timeFrameDays,
}: MockAttemptsCardProps) {
  const router = useRouter()
  const [graphDataType, setGraphDataType] = useState<GraphDataType>('scaled_score')
  const [graphType, setGraphType] = useState<'line' | 'bar'>('line')
  const [wasTimedFilter, setWasTimedFilter] = useState<'all' | 'timed' | 'untimed'>(
    'all'
  )
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const filteredAttempts = useMemo(() => {
    let result = attempts
    if (wasTimedFilter === 'timed') result = result.filter((a) => a.wasTimed)
    if (wasTimedFilter === 'untimed') result = result.filter((a) => !a.wasTimed)
    return filterByTimeFrame(result, mode, timeFrameDays)
  }, [attempts, wasTimedFilter, mode, timeFrameDays])

  const { graphData, dateRangeLabel } = useMemo(() => {
    const graphData = aggregateForGraph(
      filteredAttempts,
      (a) => a.completedAt ?? a.attemptedAt,
      (a) => {
        if (graphDataType === 'scaled_score') return a.scaledScore ?? 0
        if (graphDataType === 'percentage') {
          const total = a.totalPoints ?? 0
          return total > 0 ? ((a.scorePoints ?? 0) / total) * 100 : 0
        }
        if (graphDataType === 'time_taken') return Math.round(a.timeTakenSeconds ?? 0)
        return (a.studentExamSpeed ?? 0) * 100
      },
      mode,
      timeFrameDays,
      false
    )
    return {
      graphData,
      dateRangeLabel: getDateRangeLabel(mode, timeFrameDays),
    }
  }, [filteredAttempts, graphDataType, mode, timeFrameDays])

  const paginatedAttempts = useMemo(() => {
    const start = (page - 1) * pageSize
    return filteredAttempts.slice(start, start + pageSize)
  }, [filteredAttempts, page, pageSize])

  return (
    <Card className="rounded-xl border-border">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle>Mock attempts</CardTitle>
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
          <Select
            value={graphDataType}
            onValueChange={(v) => setGraphDataType(v as GraphDataType)}
          >
            <SelectTrigger className="w-[140px]">
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
          <h4 className="mb-3 text-sm font-medium">All mock attempts</h4>
          <div className="rounded-xl border border-border">
            <Table className="[&_tr]:border-border">
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Points</TableHead>
                  <TableHead>Scaled score</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Set speed</TableHead>
                  <TableHead>Exam speed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAttempts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      No submitted mock attempts yet
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
                        onClick={() => router.push(`/progress/mocks/${a.id}`)}
                      >
                        <TableCell>{dateStr}</TableCell>
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
          {filteredAttempts.length > 0 ? (
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
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}
