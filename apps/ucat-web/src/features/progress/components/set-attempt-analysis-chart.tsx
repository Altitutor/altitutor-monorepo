'use client'

import {
  Bar,
  BarChart,
  Cell,
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

type SetAttemptAnalysisChartProps = {
  data: QuestionAttemptForChart[]
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

export function SetAttemptAnalysisChart({
  data,
  className,
}: SetAttemptAnalysisChartProps) {
  const chartData = data.map((d) => ({
    name: String(d.questionNumber),
    value: d.timeSpentSeconds ?? 0,
    result: d.result,
  }))

  const maxTime = Math.max(...chartData.map((d) => d.value), 1)

  return (
    <div className={cn('relative flex flex-col gap-2', className)}>
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
      <div className="h-[280px] w-full pt-6">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            margin={{ top: 5, right: 5, left: 5, bottom: 5 }}
            barCategoryGap={0}
            barGap={0}
          >
            <XAxis
              dataKey="name"
              tick={{ fontSize: 11 }}
              stroke="currentColor"
              className="text-muted-foreground"
              interval={0}
              tickFormatter={(v) => {
                const n = parseInt(v, 10)
                return n % 5 === 1 || n === chartData.length ? v : ''
              }}
            />
            <YAxis
              domain={[0, maxTime * 1.1]}
              tick={{ fontSize: 12 }}
              stroke="currentColor"
              className="text-muted-foreground"
              tickFormatter={(v) => formatTimeSeconds(v)}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
              }}
              formatter={(value: number | undefined, _name, props) => {
                const payload = props.payload as { name: string; result: 'correct' | 'partial' | 'incorrect' | 'not_attempted' }
                return [
                  `${formatTimeSeconds(value ?? 0)} · ${RESULT_LABELS[payload.result]}`,
                  `Q${payload.name}`,
                ]
              }}
              labelFormatter={(l) => `Question ${l}`}
            />
            <Bar
              dataKey="value"
              radius={[4, 4, 0, 0]}
              isAnimationActive
              animationDuration={600}
              animationEasing="ease-out"
            >
              {chartData.map((entry, index) => (
                <Cell
                  key={index}
                  fill={RESULT_COLORS[entry.result]}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
