'use client'

import {
  Bar,
  BarChart,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { formatTimeSeconds } from '../lib/format-time'
import { cn } from '@/lib/utils'

export type QuestionAttemptForChart = {
  questionNumber: number
  timeSpentSeconds: number | null
  result: 'correct' | 'partial' | 'incorrect' | 'not_attempted'
}

export type SetInfoForChart = {
  questionSetName: string | null
}

type MockAttemptAnalysisChartProps = {
  data: QuestionAttemptForChart[]
  /** 0-based indices after which to draw set divider (last question index of each set except final) */
  setBoundaryIndices: number[]
  /** Set names for section labels (one per set, in order) */
  sets: SetInfoForChart[]
  className?: string
}

const RESULT_COLORS: Record<
  'correct' | 'partial' | 'incorrect' | 'not_attempted',
  string
> = {
  correct: 'hsl(142 76% 36%)',
  partial: 'hsl(48 96% 53%)',
  incorrect: 'hsl(0 84% 60%)',
  not_attempted: 'hsl(var(--muted-foreground) / 0.3)',
}

const RESULT_LABELS: Record<
  'correct' | 'partial' | 'incorrect' | 'not_attempted',
  string
> = {
  correct: 'Correct',
  partial: 'Partial',
  incorrect: 'Incorrect',
  not_attempted: 'Not attempted',
}

function getSetIndexForQuestion(
  questionIndex: number,
  setBoundaryIndices: number[]
): number {
  for (let i = 0; i < setBoundaryIndices.length; i++) {
    if (questionIndex <= setBoundaryIndices[i]) return i
  }
  return setBoundaryIndices.length
}

function getLocalQuestionNumber(
  questionIndex: number,
  setBoundaryIndices: number[]
): number {
  const setIndex = getSetIndexForQuestion(questionIndex, setBoundaryIndices)
  const startOfSet = setIndex === 0 ? 0 : setBoundaryIndices[setIndex - 1] + 1
  return questionIndex - startOfSet + 1
}

function isFirstQuestionOfSet(
  questionIndex: number,
  setBoundaryIndices: number[]
): boolean {
  if (questionIndex === 0) return true
  return setBoundaryIndices.includes(questionIndex - 1)
}

export function MockAttemptAnalysisChart({
  data,
  setBoundaryIndices,
  sets,
  className,
}: MockAttemptAnalysisChartProps) {
  const chartData = data.map((d, i) => {
    const setIndex = getSetIndexForQuestion(i, setBoundaryIndices)
    const sectionName =
      sets[setIndex]?.questionSetName ?? `Set ${setIndex + 1}`
    return {
      index: i,
      name: String(i),
      value: d.timeSpentSeconds ?? 0,
      result: d.result,
      localQuestionNumber: getLocalQuestionNumber(i, setBoundaryIndices),
      sectionName,
      isFirstOfSet: isFirstQuestionOfSet(i, setBoundaryIndices),
    }
  })

  const maxTime = Math.max(...chartData.map((d) => d.value), 1)
  const chartWidth = Math.max(600, chartData.length * 24)
  const yAxisWidth = 52

  const yAxisTicks = [0, 0.25, 0.5, 0.75, 1].map((t) =>
    Math.round(t * maxTime * 1.1)
  )

  const renderXAxisTick = (props: {
    x?: string | number
    y?: string | number
    payload?: { value: string }
  }) => {
    const { x = 0, y = 0, payload: p } = props
    if (!p) return null
    const idx = parseInt(p.value, 10)
    const entry = chartData[idx]
    if (!entry) return null
    const showTick =
      entry.localQuestionNumber % 5 === 1 ||
      entry.isFirstOfSet ||
      (entry.localQuestionNumber % 5 === 0 && entry.localQuestionNumber > 0)
    if (!showTick) return null
    const xNum = typeof x === 'number' ? x : parseFloat(String(x))
    const yNum = typeof y === 'number' ? y : parseFloat(String(y))
    return (
      <g transform={`translate(${xNum},${yNum})`}>
        <text
          x={0}
          y={0}
          dy={8}
          textAnchor="middle"
          fill="hsl(var(--muted-foreground))"
          fontSize={11}
        >
          {entry.localQuestionNumber}
        </text>
        {entry.isFirstOfSet && (
          <text
            x={0}
            y={0}
            dy={22}
            textAnchor="middle"
            fill="hsl(var(--muted-foreground))"
            fontSize={14}
            fontWeight={500}
          >
            {entry.sectionName}
          </text>
        )}
      </g>
    )
  }

  return (
    <div className={cn('relative flex min-w-0 flex-col gap-2', className)}>
      <div className="text-sm text-muted-foreground">
        Time taken per question
      </div>
      <div className="absolute right-0 top-0 flex flex-wrap justify-end gap-x-4 gap-y-1 text-xs">
        {(['correct', 'partial', 'incorrect', 'not_attempted'] as const).map(
          (r) => (
            <span key={r} className="flex items-center gap-1.5">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-sm"
                style={{ backgroundColor: RESULT_COLORS[r] }}
              />
              {RESULT_LABELS[r]}
            </span>
          )
        )}
      </div>
      <div className="flex h-[320px] min-h-0 pt-6">
        <div
          className="flex shrink-0 flex-col justify-between border-r border-border bg-card pr-2 pt-1 pb-8 text-right text-xs text-muted-foreground"
          style={{ width: yAxisWidth }}
        >
          {yAxisTicks.map((t) => (
            <span key={t} className="tabular-nums">
              {formatTimeSeconds(t)}
            </span>
          ))}
        </div>
        <div className="min-h-0 min-w-0 flex-1 overflow-x-auto overflow-y-hidden">
          <div
            style={{ width: chartWidth, minWidth: chartWidth }}
            className="h-full"
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{ top: 5, right: 5, left: 5, bottom: 5 }}
                barCategoryGap={0}
                barGap={0}
              >
                <XAxis
                  dataKey="name"
                  stroke="currentColor"
                  className="text-muted-foreground"
                  interval={0}
                  // Custom tick render for section labels; Recharts tick prop types are strict
                  tick={renderXAxisTick as never}
                />
                <YAxis
                  domain={[0, maxTime * 1.1]}
                  width={0}
                  tick={false}
                  axisLine={false}
                />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                }}
                formatter={(value: number | undefined, _name, props) => {
                  const payload = props.payload as {
                    localQuestionNumber: number
                    sectionName: string
                    result: 'correct' | 'partial' | 'incorrect' | 'not_attempted'
                  }
                  return [
                    `${formatTimeSeconds(value ?? 0)} · ${RESULT_LABELS[payload.result]}`,
                    `${payload.sectionName} Q${payload.localQuestionNumber}`,
                  ]
                }}
                labelFormatter={() => ''}
              />
              {setBoundaryIndices.map((idx) => (
                <ReferenceLine
                  key={idx}
                  x={idx + 0.5}
                  stroke="hsl(var(--border))"
                  strokeWidth={2}
                  strokeDasharray="4 2"
                />
              ))}
              <Bar
                dataKey="value"
                radius={[4, 4, 0, 0]}
                isAnimationActive
                animationDuration={600}
                animationEasing="ease-out"
              >
                {chartData.map((entry, index) => (
                  <Cell key={index} fill={RESULT_COLORS[entry.result]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
    </div>
  )
}
