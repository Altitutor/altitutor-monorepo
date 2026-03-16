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
} from '@altitutor/ui'
import { GraphTypeTabs } from './graph-type-tabs'
import { format, addDays, subDays } from 'date-fns'
import { ProgressGraph, type GraphDataType } from './progress-graph'
import type { QuestionAttemptRow } from '@/app/api/ucat/progress/route'

type QuestionAttemptsCardProps = {
  attempts: QuestionAttemptRow[]
}

const DATE_RANGES = [
  { value: '7', label: 'Last 7 days' },
  { value: '14', label: 'Last 14 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
] as const

const GRAPH_DATA_TYPES: { value: GraphDataType; label: string }[] = [
  { value: 'attempt_count', label: 'Number of attempts' },
  { value: 'percentage', label: 'Percentage correct' },
  { value: 'time_taken', label: 'Time taken' },
  { value: 'question_speed', label: 'Question speed' },
]

export function QuestionAttemptsCard({ attempts }: QuestionAttemptsCardProps) {
  const [dateRangeDays, setDateRangeDays] = useState<string>('30')
  const [graphDataType, setGraphDataType] = useState<GraphDataType>('percentage')
  const [graphType, setGraphType] = useState<'line' | 'bar'>('line')
  const [wasTimedFilter, setWasTimedFilter] = useState<'all' | 'timed' | 'untimed'>(
    'all'
  )

  const filteredAttempts = useMemo(() => {
    let result = attempts
    if (wasTimedFilter === 'timed') {
      result = result.filter((a) => a.wasTimed)
    } else if (wasTimedFilter === 'untimed') {
      result = result.filter((a) => !a.wasTimed)
    }
    return result
  }, [attempts, wasTimedFilter])

  const { graphData, dateRangeLabel } = useMemo(() => {
    const days = parseInt(dateRangeDays, 10) || 30
    const endDate = new Date()
    endDate.setHours(23, 59, 59, 999)
    const startDate = subDays(endDate, days - 1)
    startDate.setHours(0, 0, 0, 0)

    const filtered = filteredAttempts.filter((a) => {
      const d = new Date(a.attemptedAt)
      return d >= startDate && d <= endDate
    })

    const byDate = new Map<string, number[]>()
    for (const a of filtered) {
      const dateStr = format(new Date(a.attemptedAt), 'yyyy-MM-dd')

      let value: number
      const maxPerQuestion = a.questionType === 'syllogism' ? 2 : 1
      if (graphDataType === 'attempt_count') {
        value = 1
      } else if (graphDataType === 'percentage') {
        value = maxPerQuestion > 0 ? ((a.score ?? 0) / maxPerQuestion) * 100 : 0
      } else if (graphDataType === 'time_taken') {
        value = Math.round(a.timeSpentSeconds ?? 0)
      } else if (graphDataType === 'question_speed') {
        value = (a.studentQuestionSpeed ?? 0) * 100
      } else {
        value = 0
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
      let value: number | null
      if (values.length === 0) {
        value = null
      } else if (graphDataType === 'attempt_count') {
        value = values.length
      } else {
        value = values.reduce((s, v) => s + v, 0) / values.length
      }
      return { date, value }
    })

    return {
      graphData,
      dateRangeLabel: `Last ${days} days`,
    }
  }, [filteredAttempts, dateRangeDays, graphDataType])

  return (
    <Card className="rounded-xl border-border">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle>Question attempts</CardTitle>
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
      <CardContent>
        <ProgressGraph
          data={graphData}
          type={graphType}
          dataType={graphDataType}
          dateRangeLabel={dateRangeLabel}
        />
      </CardContent>
    </Card>
  )
}
