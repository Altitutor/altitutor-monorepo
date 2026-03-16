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
import { ProgressGraph, type GraphDataType } from './progress-graph'
import { aggregateForGraph } from '../lib/progress-data-utils'
import type { QuestionAttemptRow } from '@/app/api/ucat/progress/route'
import type { ProgressMode, TimeFrameDays } from '../lib/progress-mode'

type QuestionAttemptsCardProps = {
  attempts: QuestionAttemptRow[]
  mode: ProgressMode
  timeFrameDays: TimeFrameDays
}

const GRAPH_DATA_TYPES: { value: GraphDataType; label: string }[] = [
  { value: 'attempt_count', label: 'Number of attempts' },
  { value: 'percentage', label: 'Percentage correct' },
  { value: 'time_taken', label: 'Time taken' },
  { value: 'question_speed', label: 'Question speed' },
]

function getDateRangeLabel(mode: ProgressMode, timeFrameDays: TimeFrameDays): string {
  if (mode === 'time_frame') {
    return `Last ${timeFrameDays} days`
  }
  return mode === 'weighted' ? 'Weighted average (all time)' : 'All time'
}

export function QuestionAttemptsCard({
  attempts,
  mode,
  timeFrameDays,
}: QuestionAttemptsCardProps) {
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
    const isCountMetric = graphDataType === 'attempt_count'
    const graphData = aggregateForGraph(
      filteredAttempts,
      (a) => a.attemptedAt,
      (a) => {
        const maxPerQuestion = a.questionType === 'syllogism' ? 2 : 1
        if (graphDataType === 'attempt_count') return 1
        if (graphDataType === 'percentage') {
          return maxPerQuestion > 0 ? ((a.score ?? 0) / maxPerQuestion) * 100 : 0
        }
        if (graphDataType === 'time_taken') return Math.round(a.timeSpentSeconds ?? 0)
        if (graphDataType === 'question_speed') return (a.studentQuestionSpeed ?? 0) * 100
        return 0
      },
      mode,
      timeFrameDays,
      isCountMetric
    )
    return {
      graphData,
      dateRangeLabel: getDateRangeLabel(mode, timeFrameDays),
    }
  }, [filteredAttempts, graphDataType, mode, timeFrameDays])

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
