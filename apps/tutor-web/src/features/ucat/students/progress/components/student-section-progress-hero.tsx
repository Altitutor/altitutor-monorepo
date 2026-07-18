'use client'

import { useMemo, useState } from 'react'
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  SegmentedControl,
} from '@altitutor/ui'
import { Sparkles } from 'lucide-react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { format } from 'date-fns'
import type { SectionCategoryProgress, SetAttemptRow } from '@altitutor/shared'

const VIEW_OPTIONS = [
  { value: 'score' as const, label: 'Score' },
  { value: 'timing' as const, label: 'Timing' },
]

type ChartPoint = {
  date: string
  value: number
  accuracy: number | null
}

function formatDate(value: string): string {
  return format(new Date(value), 'd MMM')
}

function buildScorePoints(attempts: SetAttemptRow[]): ChartPoint[] {
  return attempts
    .filter(
      (attempt) =>
        !attempt.studentUcatMockAttemptId &&
        attempt.wasTimed &&
        attempt.scaledScore != null
    )
    .sort((a, b) =>
      (a.completedAt ?? a.attemptedAt).localeCompare(
        b.completedAt ?? b.attemptedAt
      )
    )
    .map((attempt) => ({
      date: attempt.completedAt ?? attempt.attemptedAt,
      value: attempt.scaledScore!,
      accuracy:
        (attempt.totalPoints ?? 0) > 0
          ? ((attempt.scorePoints ?? 0) / attempt.totalPoints!) * 100
          : null,
    }))
}

function buildTimingPoints(attempts: SetAttemptRow[]): ChartPoint[] {
  return attempts
    .filter(
      (attempt) =>
        !attempt.studentUcatMockAttemptId &&
        attempt.wasTimed &&
        attempt.studentExamSpeed != null
    )
    .sort((a, b) =>
      (a.completedAt ?? a.attemptedAt).localeCompare(
        b.completedAt ?? b.attemptedAt
      )
    )
    .map((attempt) => ({
      date: attempt.completedAt ?? attempt.attemptedAt,
      value: attempt.studentExamSpeed! * 100,
      accuracy:
        (attempt.totalPoints ?? 0) > 0
          ? ((attempt.scorePoints ?? 0) / attempt.totalPoints!) * 100
          : null,
    }))
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border/50 py-2 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium tabular-nums">{value}</span>
    </div>
  )
}

export function StudentSectionProgressHero({
  sectionName,
  score,
  confidence,
  projectionHistory,
  percentage,
  attempts,
  categories,
}: {
  sectionName: string
  score: number | null
  confidence: 'low' | 'medium' | 'high' | null
  projectionHistory: Array<{ date: string; value: number }>
  percentage: number
  attempts: SetAttemptRow[]
  categories: SectionCategoryProgress[]
}) {
  const [view, setView] = useState<'score' | 'timing'>('score')
  const scorePoints = useMemo(
    () =>
      projectionHistory.length
        ? projectionHistory.map((point) => ({ ...point, accuracy: null }))
        : buildScorePoints(attempts),
    [attempts, projectionHistory]
  )
  const timingPoints = useMemo(() => buildTimingPoints(attempts), [attempts])
  const points = view === 'score' ? scorePoints : timingPoints
  const weakestCategory = categories
    .filter((category) => category.maxScore > 0)
    .sort((a, b) => a.percentage - b.percentage)[0]
  const recentTiming = timingPoints.slice(-5)
  const recentPace = recentTiming.length
    ? recentTiming.reduce((sum, point) => sum + point.value, 0) /
      recentTiming.length
    : null
  const statusLabel =
    view === 'timing'
      ? recentPace == null
        ? 'Building baseline'
        : recentPace < 90
          ? 'Below exam pace'
          : recentPace > 110
            ? 'Fast pace'
            : 'Balanced pace'
      : score == null
        ? 'Building baseline'
        : confidence === 'high'
          ? 'Strong evidence'
          : confidence === 'medium'
            ? 'Estimate forming'
            : 'Early estimate'
  const insightTitle =
    view === 'timing'
      ? recentPace == null
        ? 'Build a timed baseline for this section'
        : recentPace < 90
          ? 'Timing pressure is the clearest constraint'
          : recentPace > 110 && percentage < 70
            ? 'The current pace may be costing accuracy'
            : 'Protect the balance between pace and accuracy'
      : weakestCategory
        ? `${weakestCategory.categoryName} is the clearest opportunity`
        : score == null
          ? 'Build a timed baseline for this section'
          : 'Keep the evidence representative'
  const insightBody =
    view === 'timing'
      ? recentPace == null
        ? 'Complete a timed set in this section to establish the student’s pace relative to exam conditions.'
        : `Recent pace is ${(recentPace / 100).toFixed(2)}x exam speed with ${Math.round(percentage)}% overall accuracy. Use both signals together when deciding whether to prioritise speed or conversion.`
      : weakestCategory
        ? `${Math.round(weakestCategory.percentage)}% accuracy makes this the weakest attempted category. Review its reasoning patterns before adding more speed pressure.`
        : 'Timed sets and mock sections will reveal which category and timing pattern is holding the estimate back.'

  return (
    <section className="relative isolate overflow-hidden border-b border-border/50 bg-gradient-to-b from-background via-muted/15 to-background">
      <div className="relative min-h-[580px] sm:min-h-[650px] lg:min-h-[620px]">
        <div className="absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-4 px-5 py-6 sm:px-8 lg:px-10">
          <div>
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
              {sectionName} {view === 'score' ? 'progress' : 'timing'}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {view === 'score'
                ? `Current estimate ${score == null ? '—' : Math.round(score)}`
                : 'Pace relative to exam conditions, interpreted with accuracy.'}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <SegmentedControl
              value={view}
              onValueChange={setView}
              options={VIEW_OPTIONS}
              aria-label="Section progress view"
              fullWidth={false}
            />
            <Badge variant="secondary">{statusLabel}</Badge>
          </div>
        </div>

        <div
          className="absolute inset-x-0 top-20 h-[400px] sm:h-[480px] lg:h-[520px]"
          role="img"
          aria-label={`${sectionName} ${view} history`}
        >
          {points.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={points}
                margin={{ top: 34, right: 24, bottom: 28, left: 6 }}
              >
                <CartesianGrid
                  vertical={false}
                  strokeDasharray="3 6"
                  className="stroke-border/60"
                />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatDate}
                  tick={{ fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  minTickGap={32}
                />
                <YAxis
                  domain={view === 'score' ? [300, 900] : [40, 180]}
                  tickFormatter={(value) =>
                    view === 'timing'
                      ? `${(Number(value) / 100).toFixed(1)}x`
                      : String(value)
                  }
                  tick={{ fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={44}
                />
                {view === 'timing' ? (
                  <>
                    <ReferenceArea
                      y1={90}
                      y2={110}
                      fill="hsl(var(--primary))"
                      fillOpacity={0.09}
                    />
                    <ReferenceLine
                      y={100}
                      stroke="hsl(var(--primary))"
                      strokeDasharray="6 6"
                    />
                  </>
                ) : null}
                <Tooltip
                  labelFormatter={(value) =>
                    format(new Date(value), 'd MMM yyyy')
                  }
                  formatter={(value, _name, item) => {
                    const point = item.payload as ChartPoint
                    return [
                      view === 'timing'
                        ? `${(Number(value) / 100).toFixed(2)}x${point.accuracy == null ? '' : ` · ${Math.round(point.accuracy)}% accuracy`}`
                        : String(Math.round(Number(value))),
                      view === 'timing' ? 'Exam pace' : 'Scaled score',
                    ]
                  }}
                  contentStyle={{
                    background: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: 12,
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="hsl(var(--primary))"
                  strokeWidth={3}
                  dot={{ r: 3, fill: 'hsl(var(--primary))' }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center px-6 text-center">
              <div>
                <p className="font-medium">
                  The {view} pattern will appear here
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Complete timed sets in this section to establish a baseline.
                </p>
              </div>
            </div>
          )}
        </div>

        <Card className="absolute right-6 top-24 z-20 hidden w-[min(390px,calc(100%-3rem))] border-border/70 bg-card/90 shadow-xl backdrop-blur-xl lg:block">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              <Sparkles className="size-3.5" aria-hidden />
              {view === 'timing' ? 'Timing insight' : 'Insight'}
            </div>
            <CardTitle className="pt-2 text-lg">{insightTitle}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {insightBody}
            </p>
            <div className="mt-5 border-t border-border/60 pt-3">
              <MetricRow
                label="Current estimate"
                value={score == null ? '—' : String(Math.round(score))}
              />
              <MetricRow
                label="Accuracy"
                value={`${Math.round(percentage)}%`}
              />
              <MetricRow
                label="Recent pace"
                value={
                  recentPace == null ? '—' : `${(recentPace / 100).toFixed(2)}x`
                }
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="relative z-20 mx-4 -mt-20 mb-5 border-border/70 bg-card/95 shadow-xl backdrop-blur-xl lg:hidden">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            <Sparkles className="size-3.5" aria-hidden /> Insight
          </div>
          <CardTitle className="pt-1 text-lg">{insightTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{insightBody}</p>
        </CardContent>
      </Card>
    </section>
  )
}
