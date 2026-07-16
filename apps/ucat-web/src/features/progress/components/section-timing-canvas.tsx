"use client";

import type { ReactNode } from "react";
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
} from "recharts";
import { Badge } from "@altitutor/ui";
import { Sparkles } from "lucide-react";
import type { DailyProgressSeriesPoint } from "@/app/api/ucat/progress/series/route";
import { formatSpeedPercentAsMultiplier } from "../lib/format-speed-multiplier";

type TimingChartPoint = {
  date: string;
  pace: number | null;
  accuracy: number | null;
  isSpacer?: boolean;
};

type SectionTimingCanvasProps = {
  sectionName: string;
  points: DailyProgressSeriesPoint[];
  headerControl: ReactNode;
};

function dateLabel(date: string): string {
  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${date}T12:00:00.000Z`));
}

function timingInsight(pace: number | null, accuracy: number | null) {
  if (pace == null) {
    return {
      title: "Complete a timed set to reveal your pace",
      body: "This view compares your working pace with the real exam pace. It also checks accuracy, because getting faster is only useful when your reasoning holds up.",
      status: "No timed evidence",
    };
  }
  if (pace > 110 && (accuracy == null || accuracy < 70)) {
    return {
      title: "You may be moving faster than your accuracy can support",
      body: `Your recent pace is ${formatSpeedPercentAsMultiplier(pace)}${accuracy == null ? "" : ` with ${Math.round(accuracy)}% accuracy`}. Slow down slightly on the questions you can convert rather than trying to bank more time.`,
      status: "Possible rushing",
    };
  }
  if (pace > 110) {
    return {
      title: "Your pace is fast—protect the accuracy behind it",
      body: `You’re working at ${formatSpeedPercentAsMultiplier(pace)} exam speed. That is useful only while accuracy stays representative, so use the category breakdown to check where speed is creating avoidable misses.`,
      status: "Fast pace",
    };
  }
  if (pace < 90) {
    return {
      title: "Timing pressure is the clearest constraint",
      body: `You’re working at ${formatSpeedPercentAsMultiplier(pace)} exam speed. Practise making an earlier decision on difficult questions so you preserve enough time for the questions you are more likely to answer correctly.`,
      status: "Below exam pace",
    };
  }
  if (accuracy != null && accuracy < 70) {
    return {
      title: "Your pace is balanced; accuracy is the next lever",
      body: `Your recent pace is ${formatSpeedPercentAsMultiplier(pace)}, inside the guide band, while accuracy is ${Math.round(accuracy)}%. Keep the pace steady and focus review on the reasoning patterns behind your misses.`,
      status: "Balanced pace",
    };
  }
  return {
    title: "Your pace and accuracy are working together",
    body: `Your recent pace is ${formatSpeedPercentAsMultiplier(pace)}${accuracy == null ? "" : ` with ${Math.round(accuracy)}% accuracy`}. Keep testing this balance in representative timed sets rather than chasing speed by itself.`,
    status: "Balanced pace",
  };
}

export function SectionTimingCanvas({
  sectionName,
  points,
  headerControl,
}: SectionTimingCanvasProps) {
  const realData: TimingChartPoint[] = points.flatMap((point) =>
    point.examSpeedCount > 0
      ? [
          {
            date: point.date,
            pace: point.examSpeedPercentSum / point.examSpeedCount,
            accuracy:
              point.totalPointsSum > 0
                ? (point.scorePointsSum / point.totalPointsSum) * 100
                : null,
          },
        ]
      : [],
  );
  const recent = points.filter((point) => point.examSpeedCount > 0).slice(-5);
  const recentPaceCount = recent.reduce(
    (sum, point) => sum + point.examSpeedCount,
    0,
  );
  const currentPace =
    recentPaceCount > 0
      ? recent.reduce((sum, point) => sum + point.examSpeedPercentSum, 0) /
        recentPaceCount
      : null;
  const recentAccuracyTotal = recent.reduce(
    (sum, point) => sum + point.totalPointsSum,
    0,
  );
  const currentAccuracy =
    recentAccuracyTotal > 0
      ? (recent.reduce((sum, point) => sum + point.scorePointsSum, 0) /
          recentAccuracyTotal) *
        100
      : null;
  const insight = timingInsight(currentPace, currentAccuracy);
  const spacerCount =
    realData.length > 0
      ? Math.min(12, Math.max(2, Math.ceil(realData.length * 0.75)))
      : 0;
  const chartData: TimingChartPoint[] = [
    ...realData,
    ...Array.from({ length: spacerCount }, (_, index) => ({
      date: `__timing-space-${index}`,
      pace: null,
      accuracy: null,
      isSpacer: true,
    })),
  ];
  const observedPaces = realData.flatMap((point) =>
    point.pace == null ? [] : [point.pace],
  );
  const yMinimum = Math.max(
    40,
    Math.floor((Math.min(90, ...observedPaces) - 10) / 10) * 10,
  );
  const yMaximum = Math.min(
    180,
    Math.ceil((Math.max(110, ...observedPaces) + 10) / 10) * 10,
  );

  const insightCard = (
    <>
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        <Sparkles className="size-3.5" aria-hidden />
        Timing insight
      </div>
      <h2 className="mt-3 text-lg font-semibold tracking-tight">
        {insight.title}
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        {insight.body}
      </p>
      <div className="mt-5 space-y-2 border-t border-border/60 pt-4 text-sm">
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Recent pace</span>
          <span className="font-medium tabular-nums">
            {formatSpeedPercentAsMultiplier(currentPace)}
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Recent accuracy</span>
          <span className="font-medium tabular-nums">
            {currentAccuracy == null ? "—" : `${Math.round(currentAccuracy)}%`}
          </span>
        </div>
        <p className="pt-2 text-xs leading-relaxed text-muted-foreground">
          1x matches exam pace. The shaded 0.9x–1.1x band is a coaching guide,
          not a score.
        </p>
      </div>
    </>
  );

  return (
    <section className="relative isolate overflow-hidden border-b border-border/50 bg-gradient-to-b from-background via-muted/15 to-background">
      <div className="relative min-h-[580px] sm:min-h-[650px] lg:min-h-[620px]">
        <div className="absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-4 px-5 py-6 sm:px-8 lg:px-10">
          <div>
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
              {sectionName} timing
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Pace relative to exam conditions, interpreted with accuracy.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            {headerControl}
            <Badge variant="secondary">{insight.status}</Badge>
          </div>
        </div>

        <div
          className="absolute inset-x-0 top-24 h-[430px] sm:h-[500px]"
          role="img"
          aria-label={`${sectionName} exam pace history. 1x is exam pace.`}
        >
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={chartData}
                margin={{ top: 34, right: 24, bottom: 28, left: 6 }}
              >
                <CartesianGrid
                  vertical={false}
                  stroke="hsl(var(--border))"
                  strokeOpacity={0.42}
                  strokeDasharray="3 7"
                />
                <XAxis
                  dataKey="date"
                  tickFormatter={(value) =>
                    String(value).startsWith("__")
                      ? ""
                      : dateLabel(String(value))
                  }
                  interval="preserveStartEnd"
                  minTickGap={56}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                />
                <YAxis
                  domain={[yMinimum, yMaximum]}
                  width={44}
                  tickFormatter={(value) =>
                    formatSpeedPercentAsMultiplier(Number(value))
                  }
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                />
                <ReferenceArea
                  y1={90}
                  y2={110}
                  fill="hsl(var(--primary))"
                  fillOpacity={0.09}
                  strokeOpacity={0}
                />
                <ReferenceLine
                  y={100}
                  stroke="hsl(var(--primary))"
                  strokeOpacity={0.55}
                  strokeDasharray="6 6"
                  label={{
                    value: "Exam pace",
                    position: "insideTopLeft",
                    fill: "hsl(var(--muted-foreground))",
                    fontSize: 11,
                  }}
                />
                <Tooltip
                  cursor={{
                    stroke: "hsl(var(--border))",
                    strokeDasharray: "3 5",
                  }}
                  content={({ active, payload }) => {
                    const point = payload?.[0]?.payload as
                      | TimingChartPoint
                      | undefined;
                    if (
                      !active ||
                      !point ||
                      point.isSpacer ||
                      point.pace == null
                    )
                      return null;
                    return (
                      <div className="rounded-xl border border-border bg-card px-3 py-2 text-xs shadow-lg">
                        <p className="font-medium">{dateLabel(point.date)}</p>
                        <p className="mt-1 text-muted-foreground">
                          Pace:{" "}
                          <span className="font-medium text-foreground">
                            {formatSpeedPercentAsMultiplier(point.pace)}
                          </span>
                        </p>
                        <p className="text-muted-foreground">
                          Accuracy:{" "}
                          <span className="font-medium text-foreground">
                            {point.accuracy == null
                              ? "—"
                              : `${Math.round(point.accuracy)}%`}
                          </span>
                        </p>
                      </div>
                    );
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="pace"
                  stroke="hsl(var(--primary))"
                  strokeWidth={3}
                  dot={{ r: 3.5, fill: "hsl(var(--primary))" }}
                  activeDot={{ r: 5.5 }}
                  connectNulls={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center px-6 text-center">
              <div>
                <p className="font-medium">
                  Your timing pattern will appear here
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Complete a timed set in this section to establish your pace.
                </p>
              </div>
            </div>
          )}
        </div>

        <aside className="absolute right-6 top-28 z-20 hidden w-[min(390px,calc(100%-3rem))] rounded-2xl border border-border/70 bg-card/88 p-6 shadow-xl backdrop-blur-xl lg:block">
          {insightCard}
        </aside>
      </div>

      <aside className="relative z-20 mx-4 -mt-20 mb-5 rounded-2xl border border-border/70 bg-card/92 p-5 shadow-xl backdrop-blur-xl lg:hidden">
        {insightCard}
      </aside>
    </section>
  );
}
