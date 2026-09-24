"use client";

import Link from "next/link";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  type TooltipContentProps,
  XAxis,
  YAxis,
} from "recharts";
import {
  DASHBOARD_FORECAST_WINDOW_DAYS,
  DASHBOARD_HISTORY_WINDOW_DAYS,
  type DashboardTrajectoryChartPoint,
} from "@/features/dashboard/lib/dashboard-trajectory";
import {
  addDays,
  daysBetween,
  parseIsoDate,
} from "@/features/study-plan/lib/dates";
import { useOnceChartAnimation } from "@/shared/hooks/use-once-chart-animation";
import { cn } from "@/lib/utils";

export type DashboardMockAnnotation = {
  date: string;
  label: string;
  title: string;
  completed: boolean;
};

export type DashboardTargetBreakdown = {
  sectionName: string;
  target: number | null;
  currentEstimate: number | null;
};

type DashboardTrajectoryChartProps = {
  mode: "preview" | "baseline" | "forecast";
  data?: DashboardTrajectoryChartPoint[];
  targetScore: number | null;
  currentEstimate?: number | null;
  today: string;
  testDate: string | null;
  showTestMarker?: boolean;
  mocks?: DashboardMockAnnotation[];
  targetBreakdown?: DashboardTargetBreakdown[];
  scoreMinimum?: number;
  scoreMaximum?: number;
  className?: string;
};

function chartDateLabel(dateKey: string): string {
  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(parseIsoDate(dateKey));
}

function scoreDomain(
  data: DashboardTrajectoryChartPoint[],
  targetScore: number | null,
  scoreMinimum: number,
  scoreMaximum: number,
): [number, number] {
  const values = data.flatMap((point) =>
    [
      point.actual,
      point.pessimistic,
      point.realistic,
      point.optimistic,
    ].flatMap((value) => (value == null ? [] : [value])),
  );
  if (targetScore != null) values.push(targetScore);
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  const padding = Math.max(80, Math.round((maximum - minimum) * 0.2));
  return [
    Math.max(scoreMinimum, Math.floor((minimum - padding) / 100) * 100),
    Math.min(scoreMaximum, Math.ceil((maximum + padding) / 100) * 100),
  ];
}

const TEST_MARKER_DISPLAY_DAY = 52;

function displayDay(day: number, testDay: number | null): number {
  if (
    testDay == null ||
    testDay <= 0 ||
    testDay > DASHBOARD_FORECAST_WINDOW_DAYS ||
    day <= 0
  ) {
    return day;
  }
  if (day <= testDay) return (day / testDay) * TEST_MARKER_DISPLAY_DAY;
  return (
    TEST_MARKER_DISPLAY_DAY +
    ((day - testDay) / (DASHBOARD_FORECAST_WINDOW_DAYS - testDay || 1)) *
      (DASHBOARD_FORECAST_WINDOW_DAYS - TEST_MARKER_DISPLAY_DAY)
  );
}

function chartXPercent(day: number, domainStart: number): number {
  return (
    ((day - domainStart) / (DASHBOARD_FORECAST_WINDOW_DAYS - domainStart)) * 100
  );
}

function PreviewChart({
  mode,
  targetScore,
}: Pick<DashboardTrajectoryChartProps, "mode" | "targetScore">) {
  const isBlurred = mode === "preview";
  return (
    <div
      className="relative h-full min-h-[250px] overflow-hidden"
      role="img"
      aria-label={
        isBlurred
          ? "Preview of a future score trajectory"
          : targetScore != null
            ? `Score trajectory awaiting a starting estimate toward target ${targetScore}`
            : "Score trajectory awaiting a starting estimate"
      }
    >
      <div
        className={cn(
          "absolute inset-0 transition-[filter,opacity]",
          isBlurred ? "scale-105 opacity-65 blur-[7px]" : "opacity-75",
        )}
        aria-hidden
      >
        <svg
          viewBox="0 0 900 320"
          className="h-full w-full"
          preserveAspectRatio="xMidYMid slice"
        >
          <defs>
            <linearGradient
              id="dashboard-preview-fill"
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <stop
                offset="0%"
                stopColor="hsl(var(--primary))"
                stopOpacity="0.18"
              />
              <stop
                offset="100%"
                stopColor="hsl(var(--primary))"
                stopOpacity="0"
              />
            </linearGradient>
          </defs>
          <line
            x1="0"
            y1="72"
            x2="900"
            y2="72"
            stroke="hsl(var(--muted-foreground))"
            strokeDasharray="5 8"
            strokeOpacity="0.45"
          />
          <path
            d="M0 252 C120 246 178 232 252 222 C356 207 402 211 490 184 C592 154 642 161 714 125 C788 88 832 94 900 72 L900 320 L0 320 Z"
            fill="url(#dashboard-preview-fill)"
          />
          <path
            d="M0 252 C120 246 178 232 252 222 C356 207 402 211 490 184 C592 154 642 161 714 125 C788 88 832 94 900 72"
            fill="none"
            stroke="hsl(var(--primary))"
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={isBlurred ? undefined : "9 8"}
          />
          <line
            x1="300"
            y1="28"
            x2="300"
            y2="292"
            stroke="hsl(var(--border))"
            strokeDasharray="4 7"
          />
        </svg>
      </div>
    </div>
  );
}

export function DashboardTrajectoryChart({
  mode,
  data = [],
  targetScore,
  currentEstimate = null,
  today,
  testDate,
  showTestMarker = false,
  mocks = [],
  targetBreakdown = [],
  scoreMinimum = 900,
  scoreMaximum = 2700,
  className,
}: DashboardTrajectoryChartProps) {
  const chartAnimates = useOnceChartAnimation(
    mode === "forecast" && data.length > 0,
  );
  if (mode !== "forecast" || data.length === 0) {
    return (
      <div className={className}>
        <PreviewChart mode={mode} targetScore={targetScore} />
      </div>
    );
  }

  const testDay = testDate ? daysBetween(today, testDate) : null;
  const mappedData = data.map((point) => ({
    ...point,
    displayDay: displayDay(point.day, testDay),
  }));
  const firstEstimateDay = mappedData.reduce<number | null>((earliest, point) => {
    if (point.actual == null) return earliest;
    if (earliest == null) return point.displayDay;
    return Math.min(earliest, point.displayDay);
  }, null);
  // Start at the first scored estimate — no empty leading gap before history begins.
  const chartStartDay = Math.max(
    -DASHBOARD_HISTORY_WINDOW_DAYS,
    Math.min(0, firstEstimateDay ?? 0),
  );
  const visibleData = mappedData.filter(
    (point) => point.displayDay >= chartStartDay,
  );
  const xTicks = Array.from({ length: 7 }, (_, index) =>
    Math.round(
      chartStartDay +
        ((DASHBOARD_FORECAST_WINDOW_DAYS - chartStartDay) * index) / 6,
    ),
  );
  const domain = scoreDomain(data, targetScore, scoreMinimum, scoreMaximum);
  const visibleMocks = mocks
    .map((mock) => {
      const day = daysBetween(today, mock.date);
      return { ...mock, day, displayDay: displayDay(day, testDay) };
    })
    .filter(
      (mock) =>
        mock.displayDay >= chartStartDay &&
        mock.day <= DASHBOARD_FORECAST_WINDOW_DAYS,
    );
  const tooltipContent = ({
    active,
    payload,
  }: TooltipContentProps) => {
    if (!active || !payload?.length) return null;
    const point = payload[0]?.payload as { day?: number } | undefined;
    const day = Number(point?.day);
    if (!Number.isFinite(day)) return null;
    const dateKey = addDays(today, day);
    const rows = payload.filter(
      (entry) =>
        entry.dataKey !== "range" &&
        entry.value != null &&
        !Array.isArray(entry.value) &&
        (day !== 0 || entry.dataKey === "actual"),
    );
    if (rows.length === 0) return null;
    return (
      <div className="rounded-xl border border-border bg-card px-3 py-2 text-xs shadow-lg">
        <p className="mb-1.5 font-medium">{chartDateLabel(dateKey)}</p>
        <div className="space-y-1">
          {rows.map((entry) => {
            const key = String(entry.dataKey);
            const rowLabel =
              key === "actual"
                ? "Estimate shown"
                : key === "realistic"
                  ? "Projected path"
                  : key === "pessimistic"
                    ? "Lower range"
                    : "Upper range";
            return (
              <p
                key={key}
                className="flex items-center justify-between gap-5 text-muted-foreground"
              >
                <span className="flex items-center gap-1.5">
                  <span
                    className="size-1.5 rounded-full"
                    style={{ backgroundColor: entry.color }}
                  />
                  {rowLabel}
                </span>
                <span className="font-medium tabular-nums text-foreground">
                  {Math.round(Number(entry.value))}
                </span>
              </p>
            );
          })}
        </div>
      </div>
    );
  };
  const targetRange = domain[1] - domain[0] || 1;
  const scoreTopPercent = (score: number) =>
    Math.min(82, Math.max(12, 9 + ((domain[1] - score) / targetRange) * 72));
  const targetTop =
    targetScore == null ? 20 : scoreTopPercent(targetScore);
  const todayTop =
    currentEstimate == null ? 20 : scoreTopPercent(currentEstimate);
  const nextMock = visibleMocks.find(
    (mock) => mock.day >= 0 && !mock.completed,
  );

  return (
    <div
      className={cn("flex h-[390px] w-full flex-col sm:h-[470px]", className)}
      role="group"
      aria-label={
        targetScore != null
          ? `Score trajectory toward target ${targetScore}`
          : "Score trajectory and projection"
      }
    >
      <div className="relative min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={visibleData}
            margin={{
              top: 46,
              right: 28,
              bottom: 10,
              left: 4,
            }}
          >
            <CartesianGrid
              vertical={false}
              stroke="hsl(var(--border))"
              strokeOpacity={0.42}
              strokeDasharray="3 7"
            />
            <XAxis
              dataKey="displayDay"
              type="number"
              domain={[chartStartDay, DASHBOARD_FORECAST_WINDOW_DAYS]}
              ticks={xTicks}
              tickFormatter={(day) => {
                const displayValue = Number(day);
                const point = visibleData.reduce((nearest, candidate) =>
                  Math.abs(candidate.displayDay - displayValue) <
                  Math.abs(nearest.displayDay - displayValue)
                    ? candidate
                    : nearest,
                );
                return chartDateLabel(point.date);
              }}
              minTickGap={54}
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            />
            <YAxis
              domain={domain}
              width={38}
              tickCount={4}
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            />
            <RechartsTooltip
              content={tooltipContent}
              isAnimationActive={false}
            />
            {targetScore != null ? (
              <ReferenceLine
                y={targetScore}
                stroke="hsl(var(--warning, 38 92% 50%))"
                strokeDasharray="6 6"
                strokeWidth={1.5}
              />
            ) : null}
            <ReferenceLine
              x={0}
              stroke="hsl(var(--muted-foreground))"
              strokeOpacity={0.38}
              strokeDasharray="3 6"
            />
            {showTestMarker && testDay != null ? (
              <ReferenceLine
                x={displayDay(testDay, testDay)}
                stroke="hsl(var(--foreground))"
                strokeOpacity={0.55}
                strokeDasharray="3 6"
              />
            ) : null}
            {visibleMocks.map((mock) => (
              <ReferenceLine
                key={`${mock.label}-${mock.date}`}
                x={mock.displayDay}
                stroke="hsl(var(--muted-foreground))"
                strokeOpacity={mock.completed ? 0.28 : 0.4}
                strokeDasharray="2 7"
              />
            ))}
            <Area
              type="monotone"
              dataKey="range"
              stroke="none"
              fill="hsl(var(--primary))"
              fillOpacity={0.1}
              connectNulls
              isAnimationActive={chartAnimates}
              animationDuration={900}
              animationEasing="ease-out"
              animationBegin={120}
            />
            <Line
              type="monotone"
              dataKey="pessimistic"
              stroke="hsl(var(--muted-foreground))"
              strokeOpacity={0.42}
              strokeWidth={1}
              strokeDasharray="2 5"
              dot={false}
              connectNulls
              isAnimationActive={chartAnimates}
              animationDuration={1000}
              animationEasing="ease-out"
              animationBegin={180}
            />
            <Line
              type="monotone"
              dataKey="optimistic"
              stroke="hsl(var(--muted-foreground))"
              strokeOpacity={0.42}
              strokeWidth={1}
              strokeDasharray="2 5"
              dot={false}
              connectNulls
              isAnimationActive={chartAnimates}
              animationDuration={1000}
              animationEasing="ease-out"
              animationBegin={180}
            />
            <Line
              type="monotone"
              dataKey="realistic"
              stroke="hsl(var(--primary))"
              strokeOpacity={0.72}
              strokeWidth={2}
              strokeDasharray="7 6"
              dot={false}
              connectNulls
              isAnimationActive={chartAnimates}
              animationDuration={1100}
              animationEasing="ease-out"
              animationBegin={220}
            />
            <Line
              type="monotone"
              dataKey="actual"
              stroke="hsl(var(--primary))"
              strokeWidth={3}
              dot={{ r: 3, fill: "hsl(var(--primary))" }}
              activeDot={{ r: 5 }}
              connectNulls
              isAnimationActive={chartAnimates}
              animationDuration={900}
              animationEasing="ease-out"
            />
            {currentEstimate != null ? (
              <ReferenceDot
                x={0}
                y={currentEstimate}
                r={5}
                fill="hsl(var(--primary))"
                stroke="hsl(var(--background))"
                strokeWidth={3}
              />
            ) : null}
          </ComposedChart>
        </ResponsiveContainer>

        {currentEstimate != null ? (
          <div
            className="group absolute z-30 -mt-2 -translate-y-full"
            style={{ left: "max(56px, 9%)", top: `${todayTop}%` }}
          >
            <button
              type="button"
              className="rounded-full border border-primary/25 bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-[0_6px_18px_hsl(var(--primary)_/_0.28)] ring-1 ring-background transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={`Today ${currentEstimate}. Show score breakdown.`}
            >
              Today {currentEstimate}
            </button>
            <div className="invisible absolute left-0 top-full z-50 mt-2 w-72 rounded-xl border border-border bg-popover p-3.5 text-popover-foreground opacity-0 shadow-xl transition-opacity group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
              <p className="font-medium">Today’s estimate: {currentEstimate}</p>
              {targetBreakdown.length > 0 ? (
                <div className="mt-2 space-y-1.5">
                  {targetBreakdown.map((section) => (
                    <div
                      key={section.sectionName}
                      className="flex items-center justify-between gap-4 text-xs"
                    >
                      <span className="truncate text-muted-foreground">
                        {section.sectionName}
                      </span>
                      <span className="shrink-0 tabular-nums">
                        {section.currentEstimate != null
                          ? section.currentEstimate
                          : "—"}
                        {section.target != null ? (
                          <span className="text-muted-foreground">
                            {` · target ${section.target}`}
                          </span>
                        ) : null}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-1 text-xs text-muted-foreground">
                  Section estimates will appear here as you practice.
                </p>
              )}
            </div>
          </div>
        ) : null}

        {targetScore != null ? (
          <div
            className="group absolute z-30 -mt-2 -translate-y-full"
            style={{ left: "max(56px, 9%)", top: `${targetTop}%` }}
          >
            <button
              type="button"
              className="rounded-full border border-amber-950/15 bg-amber-400 px-3 py-1.5 text-xs font-semibold text-slate-950 shadow-[0_6px_18px_rgba(245,158,11,0.28)] ring-1 ring-white/60 transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-amber-200/20 dark:bg-amber-300 dark:shadow-[0_8px_22px_rgba(0,0,0,0.38)] dark:ring-black/20"
              aria-label={`Target ${targetScore}. Show target breakdown.`}
            >
              Target {targetScore}
            </button>
            <div className="invisible absolute left-0 top-full z-50 mt-2 w-72 rounded-xl border border-border bg-popover p-3.5 text-popover-foreground opacity-0 shadow-xl transition-opacity group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
              <p className="font-medium">Your target: {targetScore}</p>
              {targetBreakdown.some((section) => section.target != null) ? (
                <div className="mt-2 space-y-1.5">
                  {targetBreakdown.map((section) => (
                    <div
                      key={section.sectionName}
                      className="flex items-center justify-between gap-4 text-xs"
                    >
                      <span className="truncate text-muted-foreground">
                        {section.sectionName}
                      </span>
                      <span className="shrink-0 tabular-nums">
                        {section.target != null ? section.target : "—"}
                        {section.currentEstimate != null ? (
                          <span className="text-muted-foreground">
                            {` · now ${section.currentEstimate}`}
                          </span>
                        ) : null}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-1 text-xs text-muted-foreground">
                  Set section goals to see how this total is composed.
                </p>
              )}
              <Link
                href="/settings/study-plan"
                className="mt-3 inline-flex text-xs font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Edit target and test date
              </Link>
            </div>
          </div>
        ) : null}

        {visibleMocks.map((mock) => (
          <div
            key={`marker-${mock.label}-${mock.date}`}
            className="group absolute top-9 z-30 -translate-x-1/2"
            style={{
              left: `${Math.min(96, Math.max(5, chartXPercent(mock.displayDay, chartStartDay)))}%`,
            }}
          >
            <button
              type="button"
              className={cn(
                "rounded bg-background/85 px-1.5 py-0.5 text-[10px] font-semibold shadow-sm ring-1 ring-border/70 backdrop-blur focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                mock.completed && "text-muted-foreground",
              )}
              aria-label={`${mock.label}, ${mock.title}, scheduled ${chartDateLabel(mock.date)}`}
            >
              {mock.label}
            </button>
            <div className="invisible absolute left-1/2 top-full z-50 mt-2 w-56 -translate-x-1/2 rounded-lg border border-border bg-popover px-3 py-2 text-xs text-popover-foreground opacity-0 shadow-lg transition-opacity group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
              {mock.completed
                ? `${mock.title} was scheduled on ${chartDateLabel(mock.date)}.`
                : `We’ve scheduled ${mock.title} on ${chartDateLabel(mock.date)}.`}
            </div>
          </div>
        ))}
        {showTestMarker && testDay != null && testDate ? (
          <div
            className="pointer-events-none absolute top-9 z-10 -translate-x-full pr-2 text-[10px] font-medium text-muted-foreground"
            style={{
              left: `${chartXPercent(displayDay(testDay, testDay), chartStartDay)}%`,
            }}
          >
            Test · {chartDateLabel(testDate)}
          </div>
        ) : null}
      </div>
      {nextMock ? (
        <p className="min-h-8 px-11 pb-2 text-[11px] text-muted-foreground">
          Your next mock,{" "}
          <span className="font-medium text-foreground">{nextMock.title}</span>,
          {` is scheduled on ${chartDateLabel(nextMock.date)}.`}
        </p>
      ) : null}
    </div>
  );
}
