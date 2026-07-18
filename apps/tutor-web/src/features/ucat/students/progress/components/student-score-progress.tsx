'use client'

import { useMemo } from 'react'
import { Badge, Card, CardContent, CardHeader, CardTitle } from '@altitutor/ui'
import { Sparkles } from 'lucide-react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { format } from 'date-fns'
import type { ProgressResponse, SectionProgress } from '@altitutor/shared'
import { cn } from '@/shared/utils'

type TrajectoryPoint = {
  date: string
  value: number
}

function buildTrajectory(data: ProgressResponse): TrajectoryPoint[] {
  const cognitiveSections = new Map(
    data.sectionProgress
      .filter((section) => section.sectionNumber <= 3)
      .map((section) => [section.sectionId, section.sectionNumber]),
  )
  const attempts = data.setAttempts
    .filter(
      (attempt) =>
        !attempt.studentUcatMockAttemptId &&
        attempt.wasTimed &&
        attempt.scaledScore != null &&
        attempt.sectionId != null &&
        cognitiveSections.has(attempt.sectionId),
    )
    .sort((a, b) =>
      (a.completedAt ?? a.attemptedAt).localeCompare(
        b.completedAt ?? b.attemptedAt,
      ),
    )

  const scoresBySection = new Map<string, number[]>()
  const points: TrajectoryPoint[] = []
  for (const attempt of attempts) {
    const scores = scoresBySection.get(attempt.sectionId!) ?? []
    scores.push(attempt.scaledScore!)
    scoresBySection.set(attempt.sectionId!, scores)
    if (
      scoresBySection.size < cognitiveSections.size ||
      cognitiveSections.size === 0
    )
      continue

    const total = [...scoresBySection.values()].reduce((sum, values) => {
      const recent = values.slice(-5)
      return (
        sum + recent.reduce((value, score) => value + score, 0) / recent.length
      )
    }, 0)
    points.push({
      date: attempt.completedAt ?? attempt.attemptedAt,
      value: Math.round(total),
    })
  }

  return points
}

function currentSectionEstimate(section: SectionProgress): number | null {
  return (
    section.weightedAverageScaledScore ?? section.averageScaledScore ?? null
  )
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border/50 py-2 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium tabular-nums">{value}</span>
    </div>
  )
}

export function StudentScoreProgress({
  data,
  studentName,
}: {
  data: ProgressResponse
  studentName?: string
}) {
  const trajectory = useMemo(() => buildTrajectory(data), [data])
  const cognitiveSections = data.sectionProgress.filter(
    (section) => section.sectionNumber <= 3,
  )
  const estimates = cognitiveSections
    .map(currentSectionEstimate)
    .filter((score): score is number => score != null)
  const currentEstimate =
    estimates.length === cognitiveSections.length &&
    cognitiveSections.length > 0
      ? Math.round(estimates.reduce((sum, score) => sum + score, 0))
      : (trajectory.at(-1)?.value ?? null)
  const earliest = trajectory.length > 1 ? trajectory[0].value : null
  const improvement =
    currentEstimate != null && earliest != null
      ? currentEstimate - earliest
      : null
  const statusLabel =
    currentEstimate == null
      ? 'Building baseline'
      : trajectory.length >= 8
        ? 'Strong evidence'
        : trajectory.length >= 3
          ? 'Estimate forming'
          : 'Early estimate'
  const insightTitle =
    improvement != null && improvement >= 20
      ? `${studentName ?? 'This student'} has improved by ${improvement} points`
      : currentEstimate == null
        ? 'More timed evidence is needed'
        : 'This estimate is a starting point—not a verdict'
  const insightBody =
    currentEstimate == null
      ? 'A total score trajectory appears after timed work has been completed across all three cognitive sections.'
      : 'The trajectory is based on the student’s recent timed set performance. More representative work across sections makes the estimate more useful.'

  return (
    <section className="relative isolate overflow-hidden border-b border-border/50 bg-gradient-to-b from-background via-muted/15 to-background">
      <div className="relative min-h-[540px] sm:min-h-[610px] lg:min-h-[580px]">
        <div className="absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-4 px-5 py-6 sm:px-8 lg:px-10">
          <div>
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
              Score progress
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Current estimate {currentEstimate ?? '—'}
              {studentName ? ` · ${studentName}` : ''}
            </p>
          </div>
          <Badge variant="secondary">{statusLabel}</Badge>
        </div>

        <div className="absolute inset-x-0 top-24 h-[390px] px-4 sm:h-[450px] sm:px-7 lg:h-[470px] lg:pr-[430px]">
          {trajectory.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={trajectory}
                margin={{ top: 12, right: 20, bottom: 12, left: 4 }}
              >
                <CartesianGrid
                  vertical={false}
                  strokeDasharray="3 3"
                  className="stroke-border/60"
                />
                <XAxis
                  dataKey="date"
                  tickFormatter={(value) => format(new Date(value), 'd MMM')}
                  tick={{ fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  minTickGap={28}
                />
                <YAxis
                  domain={[900, 2700]}
                  tick={{ fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={42}
                />
                <Tooltip
                  labelFormatter={(value) =>
                    format(new Date(value), 'd MMM yyyy')
                  }
                  formatter={(value) => [String(value), 'Estimated score']}
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
            <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-border/70 bg-card/40 px-6 text-center text-sm text-muted-foreground">
              Complete timed sets across all three cognitive sections to
              establish a score trajectory.
            </div>
          )}
        </div>

        <Card className="absolute right-6 top-24 z-20 hidden w-[370px] border-border/70 bg-card/90 shadow-xl backdrop-blur-xl lg:block">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              <Sparkles className="size-3.5" aria-hidden />
              Insight
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
                value={currentEstimate == null ? '—' : String(currentEstimate)}
              />
              <MetricRow
                label="Change"
                value={
                  improvement == null
                    ? '—'
                    : `${improvement >= 0 ? '+' : ''}${improvement}`
                }
              />
              <MetricRow
                label="Timed evidence"
                value={`${trajectory.length} points`}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card
        className={cn(
          'relative z-20 mx-4 -mt-14 mb-5 border-border/70 bg-card/95 shadow-xl backdrop-blur-xl lg:hidden',
        )}
      >
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
