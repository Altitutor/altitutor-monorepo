"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import clsx from "clsx";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmbeddedCalculator,
  Switch,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  UcatFloatingPanel,
} from "@altitutor/ui";
import {
  calculatePercentileFromBins,
  formatPercentile,
  type CohortPercentileResult,
  type ScoreBin,
} from "@altitutor/ucat-percentiles";
import {
  BookOpen,
  Calculator,
  Check,
  Clock3,
  Flame,
  Gavel,
  Move,
  Sparkles,
  TimerOff,
  Trophy,
} from "lucide-react";
import { DEMO_EASE } from "./demo-stage";
import { UcatSyllogismSimulatorPreview } from "./ucat-syllogism-simulator-preview";

const FLOATING_INSIGHT_CARD =
  "rounded-2xl border border-black/10 bg-white/[0.97] text-[#1a1a1a] shadow-[0_18px_48px_rgba(15,23,42,0.14)] ring-1 ring-black/[0.07] backdrop-blur-xl";

const CARD_CHROME =
  "rounded-[1.25rem] bg-white shadow-sm ring-1 ring-black/[0.055]";

const CLICKABLE_CARD_BASE =
  "rounded-2xl border bg-white p-6 text-left shadow-sm ring-1 ring-black/[0.06] transition-colors";

const PACING_STEPS = [25, 50, 75, 100, 125, 150, 175, 200] as const;

const SECTION_META = [
  { key: "vr", label: "Verbal Reasoning", icon: BookOpen },
  { key: "dm", label: "Decision Making", icon: Move },
  { key: "qr", label: "Quantitative Reasoning", icon: Calculator },
  { key: "sj", label: "Situational Judgement", icon: Gavel },
] as const;

const TIMING_BAR_COLORS = {
  correct: "hsl(142 76% 36%)",
  partial: "hsl(32 95% 44%)",
  incorrect: "hsl(0 84% 60%)",
  not_attempted: "hsl(0 0% 45% / 0.3)",
} as const;

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function scorePosition(score: number, minimum = 300, maximum = 900): number {
  return clampPercent(((score - minimum) / (maximum - minimum)) * 100);
}

function formatSpeedPercentAsMultiplier(speedPercent: number): string {
  const ratio = Math.round((speedPercent / 100) * 100) / 100;
  return `${ratio}x`;
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-black/[0.08] py-2 last:border-0">
      <span className="text-sm text-black/50">{label}</span>
      <span className="text-sm font-medium tabular-nums">{value}</span>
    </div>
  );
}

function ScalePill({
  value,
  leftPercent,
  tone,
  overlapOffset,
  animate,
  delay,
  interactive = false,
  tooltipTitle,
  tooltipBody,
  tooltipDetail,
  ariaLabel,
}: {
  value: number;
  leftPercent: number;
  tone: "estimate" | "target";
  overlapOffset: "none" | "above" | "below";
  animate: boolean;
  delay: number;
  interactive?: boolean;
  tooltipTitle?: string;
  tooltipBody?: string;
  tooltipDetail?: string | null;
  ariaLabel?: string;
}) {
  const clampedLeft = Math.max(3, Math.min(97, leftPercent));

  const pillClass = clsx(
    "inline-block rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums shadow-sm ring-1",
    interactive && "transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a2941]/30",
    tone === "estimate"
      ? "border border-[#0a2941]/20 bg-[#0a2941] text-white ring-white"
      : "border border-amber-950/15 bg-amber-400 text-slate-950 ring-white/60",
  );

  const pillInner = interactive ? (
    <button type="button" className={pillClass} aria-label={ariaLabel}>
      {value}
    </button>
  ) : (
    <span className={pillClass}>{value}</span>
  );

  const motionPill = (
    <motion.div
      className="origin-center"
      initial={animate ? { opacity: 0, scale: 0.65 } : false}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: "spring", stiffness: 320, damping: 30, delay }}
    >
      {interactive && tooltipTitle && tooltipBody ? (
        <Tooltip>
          <TooltipTrigger asChild>{pillInner}</TooltipTrigger>
          <TooltipContent
            side="top"
            className="max-w-56 border border-black/10 bg-white px-3 py-2 text-left text-[#1a1a1a] shadow-lg"
          >
            <p className="font-medium text-[#1a1a1a]">{tooltipTitle}</p>
            <p className="mt-1 text-black/55">{tooltipBody}</p>
            {tooltipDetail ? (
              <p className="mt-1.5 font-medium tabular-nums text-[#1a1a1a]">
                {tooltipDetail}
              </p>
            ) : null}
          </TooltipContent>
        </Tooltip>
      ) : (
        pillInner
      )}
    </motion.div>
  );

  return (
    <div
      className={clsx(
        "absolute z-[2]",
        overlapOffset === "none" && "top-1/2 -translate-x-1/2 -translate-y-1/2",
        overlapOffset === "above" && "top-0 -translate-x-1/2",
        overlapOffset === "below" && "bottom-0 -translate-x-1/2",
      )}
      style={{ left: `${clampedLeft}%` }}
    >
      {motionPill}
    </div>
  );
}

export function MarketingScoreScale({
  estimate,
  target,
  animate,
  delay = 0,
  className,
  interactive = false,
  estimateLabel = "Estimate",
}: {
  estimate: number;
  target: number;
  animate: boolean;
  delay?: number;
  className?: string;
  interactive?: boolean;
  estimateLabel?: string;
}) {
  const estimatePos = scorePosition(estimate);
  const targetPos = scorePosition(target);
  const pillsOverlap = Math.abs(estimatePos - targetPos) < 18;
  const gapLeft = Math.min(estimatePos, targetPos);
  const gapWidth = Math.abs(estimatePos - targetPos);
  const gap = target - estimate;
  const gapDetail =
    gap === 0 ? null : gap > 0 ? `Gap +${gap}` : `Gap ${gap}`;

  return (
    <div className={clsx(pillsOverlap ? "relative h-12" : "relative h-8", className)}>
      <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2">
        <motion.div
          className="h-full origin-left rounded-full bg-black/[0.12]"
          initial={animate ? { scaleX: 0 } : false}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.45, delay, ease: DEMO_EASE }}
        />
      </div>
      <div
        className="absolute top-1/2 h-1 -translate-y-1/2 overflow-hidden rounded-full"
        style={{ left: `${gapLeft}%`, width: `${gapWidth}%` }}
      >
        <motion.div
          className="h-full origin-left rounded-full bg-[#0a2941]/35"
          initial={animate ? { scaleX: 0 } : false}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.5, delay: delay + 0.12, ease: DEMO_EASE }}
        />
      </div>
      <ScalePill
        value={estimate}
        leftPercent={estimatePos}
        tone="estimate"
        overlapOffset={pillsOverlap ? "below" : "none"}
        animate={animate}
        delay={delay + 0.18}
        interactive={interactive}
        ariaLabel={`${estimateLabel} ${estimate}`}
        tooltipTitle={`${estimateLabel} ${estimate}`}
        tooltipBody="Your current section estimate from recent timed evidence."
        tooltipDetail={gapDetail}
      />
      <ScalePill
        value={target}
        leftPercent={targetPos}
        tone="target"
        overlapOffset={pillsOverlap ? "above" : "none"}
        animate={animate}
        delay={delay + 0.28}
        interactive={interactive}
        ariaLabel={`Target ${target}`}
        tooltipTitle={`Target ${target}`}
        tooltipBody="The section score your study plan is aiming for."
        tooltipDetail={gapDetail}
      />
    </div>
  );
}

function bellCurveY(position: number): number {
  const sigma = 0.17;
  const baseline = 124;
  const top = 12;
  const normalised = (position - 0.5) / sigma;
  const height = Math.exp(-0.5 * normalised * normalised);
  return baseline - height * (baseline - top);
}

export function MarketingPercentileCurve({
  score,
  percentile,
  animate,
  className,
}: {
  score: number;
  percentile: number;
  animate: boolean;
  className?: string;
}) {
  const width = 600;
  const baseline = 124;
  const points = useMemo(
    () =>
      Array.from({ length: 121 }, (_, index) => {
        const ratio = index / 120;
        return { x: ratio * width, y: bellCurveY(ratio) };
      }),
    [],
  );
  const linePath = points
    .map((point, index) =>
      `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`,
    )
    .join(" ");
  const areaPath = `M 0 ${baseline} ${linePath.replace(/^M/, "L")} L ${width} ${baseline} Z`;
  const markerX = clampPercent(percentile) * (width / 100);

  return (
    <div className={clsx("relative", className)}>
      <svg viewBox={`0 0 ${width} 150`} className="w-full" aria-hidden>
        <path d={areaPath} fill="hsl(142 76% 36% / 0.18)" />
        <motion.path
          d={linePath}
          fill="none"
          stroke="hsl(142 76% 36%)"
          strokeWidth="2"
          initial={animate ? { pathLength: 0 } : false}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.7, ease: DEMO_EASE }}
        />
        <motion.line
          x1={markerX}
          y1="12"
          x2={markerX}
          y2={baseline}
          stroke="#0a2941"
          strokeWidth="2"
          initial={animate ? { opacity: 0 } : false}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.45 }}
        />
        <motion.polygon
          points={`${markerX},18 ${markerX - 6},28 ${markerX + 6},28`}
          fill="#0a2941"
          initial={animate ? { opacity: 0, y: 4 } : false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, type: "spring", stiffness: 320, damping: 24 }}
        />
      </svg>
      <p className="mt-1 text-[10px] font-semibold tabular-nums text-[#1d6b4f]">
        {score} · {percentile}th percentile
      </p>
    </div>
  );
}

export function MarketingScoreInsightCard({
  animate,
  className,
  projectedGain = 145,
  currentEstimate = 1755,
  percentileLabel = "45th percentile",
}: {
  animate: boolean;
  className?: string;
  projectedGain?: number;
  currentEstimate?: number;
  percentileLabel?: string;
}) {
  return (
    <motion.aside
      className={clsx(FLOATING_INSIGHT_CARD, "p-5 sm:p-6", className)}
      initial={animate ? { opacity: 0, y: 12 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.35, ease: DEMO_EASE }}
    >
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-black/45">
        <Sparkles className="size-3.5" aria-hidden />
        Score insight
      </div>
      <h2 className="mt-3 text-lg font-semibold tracking-tight">
        Your score is predicted to improve by about {projectedGain} points over
        the next 90 days
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-black/55">
        Your {currentEstimate.toLocaleString()} estimate is around the{" "}
        {percentileLabel} against the published UCAT ANZ benchmark.
      </p>
      <div className="mt-5 border-t border-black/[0.08] pt-4">
        <MetricRow label="Current estimate" value={String(currentEstimate)} />
        <MetricRow label="UCAT ANZ benchmark" value={percentileLabel} />
        <MetricRow label="90-day change" value={`+${projectedGain}`} />
      </div>
    </motion.aside>
  );
}

export function MarketingInteractivePercentileCard({
  score = 640,
  animate,
}: {
  score?: number;
  animate: boolean;
}) {
  const clipId = "marketing-percentile-clip";
  const range = { min: 300, max: 900, step: 5 };
  const bins = useMemo(() => buildMockSetPercentileBins(), []);
  const percentileResult: CohortPercentileResult = useMemo(
    () => ({
      status: "available",
      percentile: calculatePercentileFromBins(score, bins) ?? 72,
      cohortSize: bins.reduce((total, bin) => total + bin.count, 0),
      minimumCohortSize: 20,
      targetScore: score,
      bins,
    }),
    [bins, score],
  );

  const baselinePercentile =
    percentileResult.status === "available" ? percentileResult.percentile : 72;

  const [exploredScore, setExploredScore] = useState<number | null>(null);
  const displayScore = exploredScore ?? score;
  const displayPercentile =
    exploredScore == null
      ? baselinePercentile
      : calculatePercentileFromBins(displayScore, bins);

  const chartWidth = 600;
  const chartHeight = 150;
  const chartBaseline = 124;

  const bellCurve = useMemo(() => {
    const points = Array.from({ length: 121 }, (_, index) => {
      const ratio = index / 120;
      return { x: ratio * chartWidth, y: bellCurveY(ratio) };
    });
    const linePath = points
      .map((point, index) =>
        `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`,
      )
      .join(" ");
    return {
      linePath,
      areaPath: `M 0 ${chartBaseline} ${linePath.replace(/^M/, "L")} L ${chartWidth} ${chartBaseline} Z`,
    };
  }, []);

  const markerX =
    ((Math.min(range.max, Math.max(range.min, displayScore)) - range.min) /
      (range.max - range.min)) *
    chartWidth;
  const markerY = bellCurveY(markerX / chartWidth);

  const exploreAtPosition = (relativePosition: number) => {
    const rawScore = range.min + relativePosition * (range.max - range.min);
    setExploredScore(Math.round(rawScore / range.step) * range.step);
  };

  return (
    <div>
      <div className="text-center">
        <p className="text-sm font-medium text-black/50">Percentile</p>
        <motion.p
          className="mt-1 text-3xl font-bold tabular-nums"
          initial={animate ? { opacity: 0, y: 6 } : false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: DEMO_EASE }}
        >
          {formatPercentile(baselinePercentile)}
        </motion.p>
      </div>

      <div className="mt-3 min-w-0">
        <div className="flex items-baseline justify-between gap-3 text-xs">
          <span className="font-medium text-black/45">
            {exploredScore == null ? "Your position" : "Exploring"}
          </span>
          <span className="font-semibold tabular-nums">
            Score {displayScore} ·{" "}
            {displayPercentile == null
              ? "—"
              : formatPercentile(displayPercentile)}
          </span>
        </div>

        <svg
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          role="img"
          tabIndex={0}
          aria-label={`Bell curve. Your score is ${score}. Hover to explore other scores.`}
          onMouseMove={(event) => {
            const bounds = event.currentTarget.getBoundingClientRect();
            exploreAtPosition(
              Math.min(
                1,
                Math.max(0, (event.clientX - bounds.left) / bounds.width),
              ),
            );
          }}
          onMouseLeave={() => setExploredScore(null)}
          onKeyDown={(event) => {
            if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
            event.preventDefault();
            const current = exploredScore ?? score;
            const direction = event.key === "ArrowRight" ? 1 : -1;
            setExploredScore(
              Math.min(
                range.max,
                Math.max(range.min, current + direction * range.step),
              ),
            );
          }}
          onBlur={() => setExploredScore(null)}
          className="mt-2 aspect-[4/1] h-auto w-full cursor-crosshair overflow-visible rounded-md outline-none focus-visible:ring-2 focus-visible:ring-[#0a2941]/25 focus-visible:ring-offset-2"
        >
          <defs>
            <clipPath id={clipId}>
              <rect x="0" y="0" width={markerX} height={chartHeight} />
            </clipPath>
          </defs>
          <path d={bellCurve.areaPath} className="fill-black/[0.08]" />
          <path
            d={bellCurve.areaPath}
            className="fill-[#0a2941]/20"
            clipPath={`url(#${clipId})`}
          />
          <path
            d={bellCurve.linePath}
            fill="none"
            vectorEffect="non-scaling-stroke"
            className="stroke-[#0a2941]/70"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <line
            x1="0"
            x2={chartWidth}
            y1={chartBaseline}
            y2={chartBaseline}
            vectorEffect="non-scaling-stroke"
            className="stroke-black/15"
            strokeWidth="1"
          />
          <line
            x1={markerX}
            x2={markerX}
            y1={markerY}
            y2={chartBaseline}
            vectorEffect="non-scaling-stroke"
            className="stroke-[#1a1a1a]"
            strokeWidth="1.5"
            strokeDasharray="4 4"
          />
          <circle
            cx={markerX}
            cy={markerY}
            r="5"
            className="fill-[#1a1a1a] stroke-white"
            strokeWidth="2"
          />
        </svg>
        <div className="flex justify-between text-[11px] font-medium text-black/40">
          <span>{range.min}</span>
          <span>{range.max}</span>
        </div>
      </div>
    </div>
  );
}

function buildMockSetPercentileBins(): ScoreBin[] {
  const bins: ScoreBin[] = [];
  for (let score = 300; score <= 900; score += 5) {
    const z = (score - 600) / 85;
    const count = Math.max(1, Math.round(18 * Math.exp(-0.5 * z * z)));
    bins.push({ score, count });
  }
  return bins;
}

export function MarketingTrajectoryChart({
  animate,
  heightClass = "h-44 sm:h-52",
  currentEstimate = 1755,
  targetScore = 2250,
  flush = false,
  className,
}: {
  animate: boolean;
  heightClass?: string;
  currentEstimate?: number;
  targetScore?: number;
  flush?: boolean;
  className?: string;
}) {
  return (
    <div className={clsx("relative", className)}>
      <div
        className={clsx(
          "relative overflow-hidden bg-gradient-to-b from-[#f6f7f9] via-[#eef0f3] to-[#f6f7f9]",
          heightClass,
          flush ? "rounded-none" : "rounded-2xl",
        )}
      >
        <div
          className="absolute inset-x-0 top-[22%] border-t border-dashed border-[#0a2941]/35"
          aria-hidden
        />
        <span className="absolute left-3 top-[calc(22%-1.35rem)] rounded-full border border-amber-950/15 bg-amber-400 px-2.5 py-1 text-[10px] font-semibold text-slate-950 shadow-[0_6px_18px_rgba(245,158,11,0.28)] ring-1 ring-white/60">
          Target {targetScore.toLocaleString()}
        </span>
        {[40, 64, 88].map((top) => (
          <span
            key={top}
            className="absolute inset-x-4 border-t border-dashed border-black/10"
            style={{ top: `${top}%` }}
            aria-hidden
          />
        ))}
        <svg
          viewBox="0 0 800 260"
          className="absolute inset-0 size-full"
          preserveAspectRatio="xMidYMid meet"
          aria-hidden
        >
          <motion.path
            d="M48 198 C120 192 170 176 230 168 S350 138 410 128"
            fill="none"
            stroke="#0a2941"
            strokeWidth="4"
            strokeLinecap="round"
            initial={animate ? { pathLength: 0 } : false}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.9, ease: DEMO_EASE }}
          />
          <motion.path
            d="M410 128 C510 108 620 68 760 42"
            fill="none"
            stroke="#92b9c6"
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray="10 8"
            initial={animate ? { pathLength: 0 } : false}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1.1, delay: 0.22, ease: DEMO_EASE }}
          />
          <motion.path
            d="M410 128 C500 112 620 58 760 22 L760 92 C620 108 500 136 410 128 Z"
            fill="#92b9c6"
            initial={animate ? { opacity: 0 } : false}
            animate={{ opacity: 0.22 }}
            transition={{ duration: 0.9, delay: 0.12 }}
          />
          <motion.circle
            cx="410"
            cy="128"
            r="6"
            fill="#0a2941"
            stroke="white"
            strokeWidth="2.5"
            initial={animate ? { scale: 0, opacity: 0 } : false}
            animate={{ scale: 1, opacity: 1 }}
            transition={{
              delay: 0.85,
              type: "spring",
              stiffness: 320,
              damping: 24,
            }}
          />
        </svg>
        <p className="absolute bottom-2 left-4 text-[10px] text-black/38">
          Estimate {currentEstimate.toLocaleString()}
        </p>
        <p className="absolute bottom-2 right-4 text-[10px] text-black/38">
          Projected to test day
        </p>
      </div>
    </div>
  );
}

function clickableCardClass(selected: boolean) {
  return clsx(
    CLICKABLE_CARD_BASE,
    selected && "border-[#0a2941]/30 bg-[#0a2941]/[0.04] ring-[#0a2941]/15",
  );
}

export function MarketingPracticeSectionCard({
  animate,
  compact = false,
}: {
  animate: boolean;
  compact?: boolean;
}) {
  const visibleSections = compact ? SECTION_META.slice(0, 2) : SECTION_META;
  const [selectedSection, setSelectedSection] = useState(0);

  useEffect(() => {
    if (!animate) return;
    const id = window.setInterval(() => {
      setSelectedSection((value) => (value + 1) % visibleSections.length);
    }, 2800);
    return () => window.clearInterval(id);
  }, [animate, visibleSections.length]);

  const section = visibleSections[selectedSection];
  const Icon = section.icon;
  const categories = ["Reading Comprehension", "True / false / can't tell"];

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {visibleSections.map((item, index) => {
        const ItemIcon = item.icon;
        const selected = index === selectedSection;
        return (
          <motion.div
            key={item.key}
            className={clickableCardClass(selected)}
            initial={animate ? { opacity: 0, y: 8 } : false}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.06, duration: 0.35, ease: DEMO_EASE }}
          >
            <ItemIcon className="size-5 text-black/45" aria-hidden />
            <h3 className="mt-4 font-semibold">{item.label}</h3>
            {selected ? (
              <motion.div
                className="mt-4 w-full"
                initial={animate ? { opacity: 0, height: 0 } : false}
                animate={{ opacity: 1, height: "auto" }}
                transition={{ duration: 0.24, ease: DEMO_EASE }}
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-black/40">
                  Categories
                </p>
                <div className="mt-3 space-y-3">
                  {categories.map((name) => (
                    <label
                      key={name}
                      className="flex items-center justify-between gap-3 text-xs"
                    >
                      <span>{name}</span>
                      <Switch checked disabled className="pointer-events-none" />
                    </label>
                  ))}
                </div>
              </motion.div>
            ) : (
              <p className="mt-1 text-sm text-black/45">Tap to configure categories</p>
            )}
          </motion.div>
        );
      })}
      <div className="sr-only">Selected: {section.label}</div>
      <Icon className="hidden" aria-hidden />
    </div>
  );
}

export function MarketingPracticeTimingCards({ animate }: { animate: boolean }) {
  const [isTimed, setIsTimed] = useState(false);

  useEffect(() => {
    if (!animate) {
      setIsTimed(true);
      return;
    }
    const id = window.setInterval(() => setIsTimed((value) => !value), 2600);
    return () => window.clearInterval(id);
  }, [animate]);

  return (
    <div className="grid items-stretch gap-4 sm:grid-cols-2">
      <div className={clickableCardClass(!isTimed)}>
        <TimerOff className="size-5 text-black/45" aria-hidden />
        <h3 className="mt-4 font-semibold">Untimed</h3>
        <p className="mt-1 text-sm text-black/50">Take as long as you need.</p>
      </div>
      <div className={clickableCardClass(isTimed)}>
        <Clock3 className="size-5 text-black/45" aria-hidden />
        <h3 className="mt-4 font-semibold">Timed</h3>
        <p className="mt-1 text-sm text-black/50">
          Set your pace relative to the UCAT exam.
        </p>
        {isTimed ? (
          <motion.p
            className="mt-4 text-sm font-medium text-[#0a2941]"
            initial={animate ? { opacity: 0, y: -4 } : false}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22 }}
          >
            Questions paced at 1x exam speed
          </motion.p>
        ) : null}
      </div>
    </div>
  );
}

export function MarketingPracticePacingPanel({ animate }: { animate: boolean }) {
  const [pacing, setPacing] = useState(50);

  useEffect(() => {
    if (!animate) return;
    const steps = [100, 75, 50, 25, 50, 75];
    let index = 0;
    const id = window.setInterval(() => {
      index = (index + 1) % steps.length;
      setPacing(steps[index]);
    }, 2200);
    return () => window.clearInterval(id);
  }, [animate]);

  return (
    <div className={clickableCardClass(true)}>
      <Clock3 className="size-5 text-black/45" aria-hidden />
      <h3 className="mt-4 font-semibold">Timed practice</h3>
      <p className="mt-1 text-sm text-black/50">
        Slow the pace for access arrangements — 0.50x gives 50% extra time.
      </p>
      <div className="mt-5">
        <input
          type="range"
          min={25}
          max={200}
          step={25}
          value={pacing}
          readOnly
          className="pointer-events-none w-full accent-[#0a2941]"
          aria-hidden
        />
        <div className="mt-2 grid grid-cols-8">
          {PACING_STEPS.map((pace) => (
            <div
              key={pace}
              className={clsx(
                "flex flex-col items-center gap-1 text-[10px] text-black/45",
                pace === pacing && "font-semibold text-[#0a2941]",
              )}
            >
              <span
                className={clsx(
                  "h-2 w-px bg-black/15",
                  pace === pacing && "h-3 bg-[#0a2941]",
                )}
              />
              {formatSpeedPercentAsMultiplier(pace)}
            </div>
          ))}
        </div>
        <p className="mt-4 text-sm">
          Questions will be paced at{" "}
          <span className="font-semibold">
            {formatSpeedPercentAsMultiplier(pacing)}
          </span>{" "}
          exam speed.
        </p>
      </div>
    </div>
  );
}

export function MarketingExamCalculator({ animate }: { animate: boolean }) {
  const [display, setDisplay] = useState("742");

  const onKey = useCallback((label: string) => {
    if (/^[0-9]$/.test(label)) {
      setDisplay((prev) => (prev === "0" ? label : `${prev}${label}`).slice(0, 12));
      return;
    }
    if (label === "ON/C") setDisplay("0");
  }, []);

  useEffect(() => {
    if (!animate) return;
    const sequence = ["742", "742÷", "742÷3", "247"];
    let index = 0;
    const id = window.setInterval(() => {
      index = (index + 1) % sequence.length;
      setDisplay(sequence[index]);
    }, 1800);
    return () => window.clearInterval(id);
  }, [animate]);

  return (
    <div className="flex justify-center py-2">
      <UcatFloatingPanel
        title="Calculator"
        titleIcon={<Calculator className="size-5" />}
        className="w-[min(280px,calc(100vw-2rem))]"
      >
        <EmbeddedCalculator
          display={display}
          onKey={onKey}
          active={false}
          captureKeyboardAlways={false}
        />
      </UcatFloatingPanel>
    </div>
  );
}

export function MarketingReviewScoreBreakdown({ animate }: { animate: boolean }) {
  const rows = [
    { name: "Verbal Reasoning", score: 640, target: 760, percentile: 72 },
    { name: "Decision Making", score: 710, target: 760, percentile: 84 },
    { name: "Quantitative Reasoning", score: 695, target: 780, percentile: 81 },
  ];

  return (
    <div className={clsx(CARD_CHROME, "p-4 sm:p-5")}>
      <p className="text-sm font-medium text-black/50">
        Mock score 2,110 · Band 2 · 2026 UCAT Mock 1
      </p>
      <div className="mt-4 space-y-4">
        {rows.map((row, index) => (
          <motion.div
            key={row.name}
            initial={animate ? { opacity: 0, y: 8 } : false}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1, duration: 0.35, ease: DEMO_EASE }}
          >
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold">{row.name}</p>
              <p className="text-sm font-semibold tabular-nums text-[#0a2941]">
                {row.score}
              </p>
            </div>
            <MarketingScoreScale
              estimate={row.score}
              target={row.target}
              animate={animate}
              delay={index * 0.08}
              className="mt-3"
            />
            <MarketingPercentileCurve
              score={row.score}
              percentile={row.percentile}
              animate={animate}
              className="mt-2"
            />
          </motion.div>
        ))}
      </div>
    </div>
  );
}

export function MarketingReviewExplanation({ animate }: { animate: boolean }) {
  return (
    <Card
      className={clsx(
        "overflow-hidden border-[#0a2941]/15 bg-gradient-to-br from-[#0a2941]/[0.06] via-white to-white",
        animate && "animate-in fade-in duration-300",
      )}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-black/45">
          <Sparkles className="size-3.5" aria-hidden />
          Question insight
        </div>
        <CardTitle className="pt-1 text-lg font-semibold tracking-tight">
          Direct evidence spotted
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm italic leading-relaxed text-black/55">
          &ldquo;Borrowers are asked, but not required, to save seeds from plants
          they grow and donate some to the library.&rdquo;
        </p>
        <p className="mt-3 text-sm leading-relaxed text-black/65">
          You used the &ldquo;asked, but not required&rdquo; wording rather than
          inventing a return rule the passage never states.
        </p>
        <div className="mt-4 rounded-xl border border-black/[0.08] bg-[#f6f7f9] p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-black/40">
            Explanation
          </p>
          <p className="mt-2 text-sm leading-relaxed text-black/65">
            Donating seeds is explicitly optional — the passage states borrowers are
            asked but not required to do so.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export function MarketingReviewTimingChart({ animate }: { animate: boolean }) {
  const data = [
    { q: 1, seconds: 38, result: "correct" as const },
    { q: 2, seconds: 61, result: "incorrect" as const },
    { q: 3, seconds: 52, result: "correct" as const },
    { q: 4, seconds: 71, result: "incorrect" as const },
    { q: 5, seconds: 44, result: "correct" as const },
  ];
  const maxSeconds = 80;

  return (
    <div className={clsx(CARD_CHROME, "p-4")}>
      <p className="text-sm font-semibold">Time per question</p>
      <p className="mt-1 text-xs text-black/45">
        Tap a bar to jump to that question in review
      </p>
      <div className="mt-4 flex items-end gap-1.5 h-32">
        {data.map((item, index) => (
          <motion.div
            key={item.q}
            className="flex-1 rounded-t-sm origin-bottom"
            style={{
              backgroundColor: TIMING_BAR_COLORS[item.result],
              height: `${(item.seconds / maxSeconds) * 100}%`,
            }}
            initial={animate ? { scaleY: 0, opacity: 0 } : false}
            animate={{ scaleY: 1, opacity: 1 }}
            transition={{ delay: index * 0.06, duration: 0.35, ease: DEMO_EASE }}
          />
        ))}
      </div>
      <div className="mt-2 flex justify-between text-[10px] text-black/40">
        <span>Q1</span>
        <span>Q5</span>
      </div>
    </div>
  );
}

export function MarketingLearnModuleSidebar({ animate }: { animate: boolean }) {
  const blocks = [
    "What is an inference question?",
    "Use an evidence chain",
    "Check your understanding",
  ] as const;
  const [completedCount, setCompletedCount] = useState(animate ? 0 : 2);
  const [activeIndex, setActiveIndex] = useState(animate ? 0 : 2);

  useEffect(() => {
    if (!animate) {
      setCompletedCount(2);
      setActiveIndex(2);
      return;
    }

    let cancelled = false;
    let timeoutId = 0;
    let step = 0;

    const runStep = () => {
      if (cancelled) return;
      // 0: reset → all numbered, first active
      // 1–3: tick off items 0, 1, 2
      // 4: hold completed state, then loop
      if (step === 0) {
        setCompletedCount(0);
        setActiveIndex(0);
        timeoutId = window.setTimeout(() => {
          step = 1;
          runStep();
        }, 700);
        return;
      }

      if (step >= 1 && step <= 3) {
        setCompletedCount(step);
        setActiveIndex(step < 3 ? step : 2);
        timeoutId = window.setTimeout(() => {
          step += 1;
          runStep();
        }, step === 3 ? 1600 : 900);
        return;
      }

      // Hold, then restart
      timeoutId = window.setTimeout(() => {
        step = 0;
        runStep();
      }, 1200);
    };

    runStep();

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [animate]);

  return (
    <div className={clsx(CARD_CHROME, "p-4")}>
      <p className="text-xs font-semibold uppercase tracking-wide text-black/40">
        Inference questions
      </p>
      <div className="mt-3 space-y-1">
        {blocks.map((label, index) => {
          const done = index < completedCount;
          const active = !done && index === activeIndex;
          return (
            <motion.div
              key={label}
              className={clsx(
                "flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm",
                active
                  ? "bg-[#0a2941]/8 font-semibold text-[#0a2941]"
                  : "text-black/60",
              )}
              layout
            >
              <motion.span
                className={clsx(
                  "flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                  done
                    ? "bg-[#0a2941] text-white"
                    : active
                      ? "bg-[#0a2941]/15 text-[#0a2941]"
                      : "bg-black/[0.06] text-black/35",
                )}
                key={`${label}-${done ? "done" : "todo"}`}
                initial={animate ? { scale: 0.7, opacity: 0.6 } : false}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 420, damping: 22 }}
              >
                {done ? <Check className="size-3" /> : index + 1}
              </motion.span>
              {label}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

export function MarketingLearnConceptBlock({ animate }: { animate: boolean }) {
  return (
    <div className={clsx(CARD_CHROME, "p-4 sm:p-5")}>
      <span className="rounded-full bg-violet-500/12 px-2.5 py-0.5 text-xs font-semibold text-violet-700">
        Concept
      </span>
      <h3 className="mt-3 text-lg font-semibold tracking-tight">
        Build an evidence chain
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-black/60">
        List the exact words from the passage that support your answer before you
        pick an option. If you cannot point to evidence, the inference is too
        strong.
      </p>
      <motion.ol
        className="mt-4 space-y-2"
        initial={animate ? { opacity: 0 } : false}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.15 }}
      >
        {["Passage quote", "What it proves", "Safe conclusion"].map((step, i) => (
          <li
            key={step}
            className="flex items-center gap-2 rounded-lg bg-violet-500/8 px-3 py-2 text-sm font-medium"
          >
            <span className="text-xs font-bold text-violet-600">{i + 1}</span>
            {step}
          </li>
        ))}
      </motion.ol>
    </div>
  );
}

export function MarketingLearnEmbeddedQuestion({ animate }: { animate: boolean }) {
  const options = [
    "The company has concluded remote work failed",
    "The company wants more evidence before a permanent decision",
    "Managers will no longer arrange check-ins",
  ];

  return (
    <div className={clsx(CARD_CHROME, "p-4 sm:p-5")}>
      <p className="text-xs font-semibold uppercase tracking-wide text-black/40">
        Check your understanding
      </p>
      <p className="mt-3 text-sm leading-relaxed text-black/70">
        What can you conclude from the company extending the trial?
      </p>
      <div className="mt-4 space-y-2">
        {options.map((option, index) => (
          <motion.div
            key={option}
            className={clsx(
              "rounded-xl border px-3 py-2.5 text-sm",
              index === 1
                ? "border-[#0a2941]/25 bg-[#0a2941]/5 font-semibold text-[#0a2941]"
                : "border-black/[0.08] text-black/60",
            )}
            initial={animate ? { opacity: 0, y: 6 } : false}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.08, ease: DEMO_EASE }}
          >
            {option}
          </motion.div>
        ))}
      </div>
    </div>
  );
}

export function MarketingSkillTrainerPanel({ animate }: { animate: boolean }) {
  const [remaining, setRemaining] = useState(45);

  useEffect(() => {
    if (!animate) return;
    const id = window.setInterval(() => {
      setRemaining((value) => (value <= 5 ? 45 : value - 7));
    }, 1200);
    return () => window.clearInterval(id);
  }, [animate]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-white px-3 py-1.5 text-sm shadow-sm">
          <Trophy className="size-3.5 text-black/45" aria-hidden />
          <span className="font-bold tabular-nums">12</span>
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-white px-3 py-1.5 text-sm shadow-sm">
          <Flame className="size-3.5 text-orange-500" aria-hidden />
          <span className="font-bold tabular-nums">4</span>
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-white px-3 py-1.5 text-sm shadow-sm">
          <Clock3 className="size-3.5 text-black/45" aria-hidden />
          <span className="font-bold tabular-nums">{remaining}s</span>
        </span>
      </div>
      <div className={clsx(CARD_CHROME, "p-4 sm:p-5")}>
        <p className="text-sm font-semibold">Syllogism speed</p>
        <p className="mt-2 text-sm text-black/60">
          All managers are planners. Some planners are analysts. Can we conclude
          some managers are analysts?
        </p>
        <div className="mt-4 flex gap-2">
          {["Yes", "No", "Can't tell"].map((label, index) => (
            <div
              key={label}
              className={clsx(
                "flex-1 rounded-lg py-2.5 text-center text-sm font-semibold",
                index === 2
                  ? "bg-[#0a2941] text-white"
                  : "bg-black/[0.05] text-black/55",
              )}
            >
              {label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function MarketingProgressEstimatePanel({ animate }: { animate: boolean }) {
  return (
    <div className={clsx(CARD_CHROME, "p-4 sm:p-5")}>
      <p className="text-sm text-black/50">Current estimate</p>
      <motion.p
        className="mt-1 text-4xl font-bold tracking-tight text-[#0a2941] tabular-nums"
        initial={animate ? { opacity: 0, y: 8 } : false}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ease: DEMO_EASE }}
      >
        2,105
      </motion.p>
      <p className="text-sm text-black/45">Plausible range 2,030–2,180</p>
      <div className="mt-5 grid grid-cols-3 gap-2">
        {[
          ["Target", "2,350"],
          ["Gap", "−255"],
          ["Confidence", "Medium"],
        ].map(([label, value], index) => (
          <motion.div
            key={label}
            className="rounded-xl bg-[#f6f7f9] px-2 py-2 text-center"
            initial={animate ? { opacity: 0, y: 6 } : false}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + index * 0.06, ease: DEMO_EASE }}
          >
            <p className="text-[10px] text-black/40">{label}</p>
            <p className="text-sm font-semibold tabular-nums">{value}</p>
          </motion.div>
        ))}
      </div>
      <MarketingScoreScale
        estimate={705}
        target={780}
        animate={animate}
        delay={0.2}
        className="mt-5"
      />
      <div className="mt-5 space-y-3 border-t border-black/[0.08] pt-4">
        {[
          { name: "Verbal Reasoning", estimate: 565, target: 720 },
          { name: "Quantitative Reasoning", estimate: 495, target: 750 },
        ].map((section, index) => (
          <div key={section.name}>
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="font-medium">{section.name}</span>
              <span className="font-semibold tabular-nums text-[#0a2941]">
                {section.estimate}
              </span>
            </div>
            <MarketingScoreScale
              estimate={section.estimate}
              target={section.target}
              animate={animate}
              delay={0.25 + index * 0.08}
              className="mt-2"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export function MarketingStudyPlanTasks({ animate }: { animate: boolean }) {
  const tasks = [
    { title: "Syllogism speed warm-up", minutes: 6, type: "trainer" },
    { title: "Reading Comprehension · 0.75×", minutes: 22, type: "practice" },
    { title: "Review today’s VR attempt", minutes: 7, type: "review" },
  ];

  return (
    <div className={clsx(CARD_CHROME, "p-4")}>
      <p className="text-sm font-semibold">Today · 16 Jul</p>
      <div className="mt-3 space-y-2">
        {tasks.map((task, index) => (
          <motion.div
            key={task.title}
            className="flex items-center gap-3 rounded-xl border border-black/[0.06] bg-[#f6f7f9] px-3 py-2.5"
            initial={animate ? { opacity: 0, x: -8 } : false}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.08, ease: DEMO_EASE }}
          >
            <span
              className={clsx(
                "flex size-8 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold",
                task.type === "trainer"
                  ? "bg-violet-500/15 text-violet-700"
                  : task.type === "review"
                    ? "bg-emerald-500/15 text-emerald-700"
                    : "bg-[#0a2941]/10 text-[#0a2941]",
              )}
            >
              {task.minutes}m
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold">{task.title}</p>
              <p className="text-xs text-black/45">{task.minutes} minutes</p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

export function MarketingPracticeFiltersPanel({ animate }: { animate: boolean }) {
  return (
    <div className={clickableCardClass(true)}>
      <BookOpen className="size-5 text-black/45" aria-hidden />
      <h3 className="mt-4 font-semibold">Verbal Reasoning</h3>
      <motion.div
        className="mt-4 w-full"
        initial={animate ? { opacity: 0 } : false}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
      >
        <p className="text-xs font-semibold uppercase tracking-wide text-black/40">
          Categories
        </p>
        <div className="mt-3 space-y-3">
          {[
            "Reading Comprehension",
            "True / false / can't tell",
            "Author opinion",
          ].map((name) => (
            <label
              key={name}
              className="flex items-center justify-between gap-3 text-xs"
            >
              <span>{name}</span>
              <Switch checked disabled className="pointer-events-none" />
            </label>
          ))}
        </div>
        <div className="mt-5 border-t border-black/[0.08] pt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-black/40">
            Performance
          </p>
          <p className="mt-2 text-sm font-medium">Previously incorrect</p>
        </div>
      </motion.div>
    </div>
  );
}

export function MarketingReviewScoreSnapshot({
  animate,
  interactive = false,
}: {
  animate: boolean;
  interactive?: boolean;
}) {
  const body = (
    <div className={clsx(CARD_CHROME, "p-4")}>
      <p className="text-sm font-medium text-black/50">
        Verbal Reasoning · Set review
      </p>
      {interactive ? (
        <MarketingInteractivePercentileCard score={640} animate={animate} />
      ) : (
        <MarketingPercentileCurve score={640} percentile={72} animate={animate} className="mt-3" />
      )}
      <MarketingScoreScale
        estimate={640}
        target={760}
        animate={animate}
        delay={0.15}
        className="mt-4"
        interactive={interactive}
      />
    </div>
  );

  if (interactive) {
    return <TooltipProvider delayDuration={200}>{body}</TooltipProvider>;
  }

  return body;
}

export function MarketingProgressCardSnapshot({ animate }: { animate: boolean }) {
  return (
    <MarketingTrajectoryChart
      animate={animate}
      heightClass="h-44 sm:h-52"
      flush
    />
  );
}

export function MarketingSimulatorBleedPreview() {
  return (
    <div className="h-[min(420px,56vw)] min-h-[300px] overflow-hidden px-3 pb-3 pt-1 sm:px-4 sm:pb-4">
      <UcatSyllogismSimulatorPreview />
    </div>
  );
}
