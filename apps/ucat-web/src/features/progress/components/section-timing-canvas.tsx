"use client";

import {
  CartesianGrid,
  Cell,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import { useOnceChartAnimation } from "@/shared/hooks/use-once-chart-animation";
import { Sparkles } from "lucide-react";
import type { DailyProgressSeriesPoint } from "@/app/api/ucat/progress/series/route";
import { UCAT_FLOATING_GRAPH_CARD } from "@/lib/ucat-surface-motion";
import { cn } from "@/lib/utils";
import { formatSpeedPercentAsMultiplier } from "../lib/format-speed-multiplier";
import { ContentRatingControls } from "@/features/content-ratings/components/content-rating-controls";
import { contentSnapshotVersion } from "@/features/content-ratings/lib";

const RECENT_POINT_COUNT = 5;
const EXAM_PACE_GUIDE_MIN = 90;
const EXAM_PACE_GUIDE_MAX = 110;

type TimingScatterPoint = {
  date: string;
  pace: number;
  accuracy: number;
};

type SectionTimingCanvasProps = {
  sectionName: string;
  points: DailyProgressSeriesPoint[];
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
      title: "Practice a clean timing routine first",
      body: "Choose a short timed set. Make a deliberate solve, flag, or skip decision whenever you get stuck, then review whether each miss came from the method or from rushing.",
    };
  }
  if (pace > 110 && (accuracy == null || accuracy < 70)) {
    return {
      title: "You may be moving faster than your accuracy can support",
      body: `Your recent pace is ${formatSpeedPercentAsMultiplier(pace)}${accuracy == null ? "" : ` with ${Math.round(accuracy)}% accuracy`}. Points in the top-left of this chart (fast + inaccurate) usually mean slowing down on convertible questions will help more than banking time.`,
    };
  }
  if (pace > 110) {
    return {
      title: "Your pace is fast—protect the accuracy behind it",
      body: `You’re working at ${formatSpeedPercentAsMultiplier(pace)} exam speed. That is useful only while accuracy stays representative, so use the category breakdown to check where speed is creating avoidable misses.`,
    };
  }
  if (pace < 90) {
    return {
      title: "Timing pressure is the clearest constraint",
      body: `You’re working at ${formatSpeedPercentAsMultiplier(pace)} exam speed. Practice making an earlier decision on difficult questions so you preserve enough time for the questions you are more likely to answer correctly.`,
    };
  }
  if (accuracy != null && accuracy < 70) {
    return {
      title: "Your pace is balanced; accuracy is the next lever",
      body: `Your recent pace is ${formatSpeedPercentAsMultiplier(pace)}, inside the guide band, while accuracy is ${Math.round(accuracy)}%. Keep the pace steady and focus review on the reasoning patterns behind your misses.`,
    };
  }
  return {
    title: "Your pace and accuracy are working together",
    body: `Your recent pace is ${formatSpeedPercentAsMultiplier(pace)}${accuracy == null ? "" : ` with ${Math.round(accuracy)}% accuracy`}. Keep testing this balance in representative timed sets rather than chasing speed by itself.`,
  };
}

function buildScatterPoints(
  points: DailyProgressSeriesPoint[],
): TimingScatterPoint[] {
  return points.flatMap((point) => {
    if (point.examSpeedCount <= 0 || point.totalPointsSum <= 0) return [];
    return [
      {
        date: point.date,
        pace: point.examSpeedPercentSum / point.examSpeedCount,
        accuracy: (point.scorePointsSum / point.totalPointsSum) * 100,
      },
    ];
  });
}

export function SectionTimingCanvas({
  sectionName,
  points,
}: SectionTimingCanvasProps) {
  const scatterPoints = buildScatterPoints(points);
  const chartAnimates = useOnceChartAnimation(scatterPoints.length > 0);
  const recent = scatterPoints.slice(-RECENT_POINT_COUNT);
  const recentPace =
    recent.length > 0
      ? recent.reduce((sum, point) => sum + point.pace, 0) / recent.length
      : null;
  const recentAccuracy =
    recent.length > 0
      ? recent.reduce((sum, point) => sum + point.accuracy, 0) / recent.length
      : null;
  const insight = timingInsight(recentPace, recentAccuracy);
  const displayedInsight = { title: insight.title, body: insight.body };

  const observedPaces = scatterPoints.map((point) => point.pace);
  const xMinimum =
    observedPaces.length === 0
      ? 60
      : Math.max(
          40,
          Math.floor(
            (Math.min(EXAM_PACE_GUIDE_MIN, ...observedPaces) - 10) / 10,
          ) * 10,
        );
  const xMaximum =
    observedPaces.length === 0
      ? 140
      : Math.min(
          180,
          Math.ceil(
            (Math.max(EXAM_PACE_GUIDE_MAX, ...observedPaces) + 10) / 10,
          ) * 10,
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
      <ContentRatingControls
        className="mt-3"
        descriptor={{
          targetType: "progress_insight",
          targetKey: "section-timing",
          targetVersion: contentSnapshotVersion(displayedInsight),
          contextKey: `progress:section-timing:${sectionName}`,
          surface: "progress",
          displayedContent: displayedInsight,
        }}
      />
      <div className="mt-5 space-y-2 border-t border-border/60 pt-4 text-sm">
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Recent pace</span>
          <span className="font-medium tabular-nums">
            {formatSpeedPercentAsMultiplier(recentPace)}
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Recent accuracy</span>
          <span className="font-medium tabular-nums">
            {recentAccuracy == null ? "—" : `${Math.round(recentAccuracy)}%`}
          </span>
        </div>
        <p className="pt-2 text-xs leading-relaxed text-muted-foreground">
          Each point is a timed day. Horizontal is pace (1x = exam), vertical is
          accuracy. The shaded band is the 0.9x–1.1x coaching guide.
        </p>
      </div>
    </>
  );

  return (
    <section className="relative isolate overflow-hidden border-b border-border/50 bg-gradient-to-b from-background via-muted/15 to-background">
      <div className="mx-auto grid w-full max-w-[1400px] gap-5 px-5 py-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,22rem)] lg:items-start lg:gap-6 lg:px-8 xl:px-10">
        <div className="min-w-0 space-y-3">
          <div
            className="h-[430px] w-full sm:h-[500px]"
            role="img"
            aria-label={`${sectionName} pace versus accuracy. Horizontal axis is exam pace, vertical axis is accuracy.`}
          >
            {scatterPoints.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 28, right: 16, bottom: 36, left: 6 }}>
                  <CartesianGrid
                    stroke="hsl(var(--border))"
                    strokeOpacity={0.42}
                    strokeDasharray="3 7"
                  />
                  <XAxis
                    type="number"
                    dataKey="pace"
                    name="Pace"
                    domain={[xMinimum, xMaximum]}
                    tickFormatter={(value) =>
                      formatSpeedPercentAsMultiplier(Number(value))
                    }
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    label={{
                      value: "Exam pace →",
                      position: "insideBottomRight",
                      offset: -4,
                      fill: "hsl(var(--muted-foreground))",
                      fontSize: 11,
                    }}
                  />
                  <YAxis
                    type="number"
                    dataKey="accuracy"
                    name="Accuracy"
                    domain={[0, 100]}
                    width={44}
                    tickFormatter={(value) => `${Math.round(Number(value))}%`}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    label={{
                      value: "Accuracy",
                      angle: -90,
                      position: "insideLeft",
                      offset: 12,
                      fill: "hsl(var(--muted-foreground))",
                      fontSize: 11,
                    }}
                  />
                  <ZAxis range={[80, 80]} />
                  <ReferenceArea
                    x1={EXAM_PACE_GUIDE_MIN}
                    x2={EXAM_PACE_GUIDE_MAX}
                    fill="hsl(var(--primary))"
                    fillOpacity={0.09}
                    strokeOpacity={0}
                    ifOverflow="extendDomain"
                  />
                  <ReferenceLine
                    x={100}
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
                      strokeDasharray: "3 5",
                      stroke: "hsl(var(--border))",
                    }}
                    content={({ active, payload }) => {
                      const point = payload?.[0]?.payload as
                        | TimingScatterPoint
                        | undefined;
                      if (!active || !point) return null;
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
                              {Math.round(point.accuracy)}%
                            </span>
                          </p>
                        </div>
                      );
                    }}
                  />
                  <Scatter
                    data={scatterPoints}
                    isAnimationActive={chartAnimates}
                    animationDuration={700}
                    animationEasing="ease-out"
                  >
                    {scatterPoints.map((point) => (
                      <Cell
                        key={point.date}
                        fill="hsl(var(--primary))"
                        stroke="hsl(var(--background))"
                        strokeWidth={2}
                      />
                    ))}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center px-6 text-center">
                <div>
                  <p className="font-medium">
                    Your timing pattern will appear here
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Complete a timed set in this section to plot pace against
                    accuracy.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        <aside
          className={cn(UCAT_FLOATING_GRAPH_CARD, "hidden p-6 lg:block")}
        >
          {insightCard}
        </aside>
      </div>

      <aside
        className={cn(
          UCAT_FLOATING_GRAPH_CARD,
          "relative z-20 mx-4 mb-5 p-5 lg:hidden",
        )}
      >
        {insightCard}
      </aside>
    </section>
  );
}
