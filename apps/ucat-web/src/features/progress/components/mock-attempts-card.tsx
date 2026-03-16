'use client'

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
import { format, addDays, subDays } from 'date-fns'
import { ProgressGraph, type GraphDataType } from './progress-graph'
import { formatTimeSeconds } from '../lib/format-time'
import type { MockAttemptRow } from '@/app/api/ucat/progress/route'

type MockAttemptsCardProps = {
  attempts: MockAttemptRow[]
}

const DATE_RANGES = [
  { value: '7', label: 'Last 7 days' },
  { value: '14', label: 'Last 14 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
] as const

const GRAPH_DATA_TYPES: { value: GraphDataType; label: string }[] = [
  { value: 'scaled_score', label: 'Scaled score' },
  { value: 'percentage', label: 'Percentage' },
  { value: 'time_taken', label: 'Time taken' },
  { value: 'exam_speed', label: 'Exam speed' },
]

const PAGE_SIZE_OPTIONS = [10, 20, 50]

export function MockAttemptsCard({ attempts }: MockAttemptsCardProps) {
  const [dateRangeDays, setDateRangeDays] = useState<string>('30')
  const [graphDataType, setGraphDataType] = useState<GraphDataType>('scaled_score')
  const [graphType, setGraphType] = useState<'line' | 'bar'>('line')
  const [wasTimedFilter, setWasTimedFilter] = useState<'all' | 'timed' | 'untimed'>(
    'all'
  )
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const filteredAttempts = useMemo(() => {
    if (wasTimedFilter === 'timed') return attempts.filter((a) => a.wasTimed)
    if (wasTimedFilter === 'untimed') return attempts.filter((a) => !a.wasTimed)
    return attempts
  }, [attempts, wasTimedFilter])

  const { graphData, dateRangeLabel } = useMemo(() => {
    const days = parseInt(dateRangeDays, 10) || 30
    const endDate = new Date()
    endDate.setHours(23, 59, 59, 999)
    const startDate = subDays(endDate, days - 1)
    startDate.setHours(0, 0, 0, 0)

    const filtered = filteredAttempts.filter((a) => {
      const d = a.completedAt ? new Date(a.completedAt) : new Date(a.attemptedAt)
      return d >= startDate && d <= endDate
    })

    const byDate = new Map<string, number[]>()
    for (const a of filtered) {
      const dateStr = a.completedAt
        ? format(new Date(a.completedAt), 'yyyy-MM-dd')
        : format(new Date(a.attemptedAt), 'yyyy-MM-dd')

      let value: number
      if (graphDataType === 'scaled_score') {
        value = a.scaledScore ?? 0
      } else if (graphDataType === 'percentage') {
        const total = a.totalPoints ?? 0
        value = total > 0 ? ((a.scorePoints ?? 0) / total) * 100 : 0
      } else if (graphDataType === 'time_taken') {
        value = Math.round(a.timeTakenSeconds ?? 0)
      } else {
        value = (a.studentExamSpeed ?? 0) * 100
      }

      const list = byDate.get(dateStr) ?? []
      list.push(value)
      byDate.set(dateStr, list)
    }

    const allDates: string[] = []
    let d = new Date(startDate)
    while (d <= endDate) {
      allDates.push(format(d, 'yyyy-MM-dd'))
      d = addDays(d, 1)
    }

    const graphData = allDates.map((date) => {
      const values = byDate.get(date) ?? []
      const value =
        values.length > 0 ? values.reduce((s, v) => s + v, 0) / values.length : null
      return { date, value }
    })

    return {
      graphData,
      dateRangeLabel: `Last ${days} days`,
    }
  }, [filteredAttempts, dateRangeDays, graphDataType])

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
          <Select value={dateRangeDays} onValueChange={setDateRangeDays}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Date range" />
            </SelectTrigger>
            <SelectContent>
              {DATE_RANGES.map((r) => (
                <SelectItem key={r.value} value={r.value}>
                  {r.label}
                </SelectItem>
              ))}
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
                      <TableRow key={a.id}>
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
