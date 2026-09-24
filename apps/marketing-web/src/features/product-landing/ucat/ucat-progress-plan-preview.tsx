"use client";

import { motion, useReducedMotion } from "motion/react";
import { Flame, Sparkles } from "lucide-react";
import {
  DemoStage,
  DEMO_EASE,
  demoContainerVariants,
  demoItemVariants,
} from "./demo-stage";

const CURRENT_ESTIMATE = 1_755;
const TARGET_SCORE = 2_250;
const PROJECTED_GAIN = 145;

/** Match study-plan / shared UCAT activity scale. */
const INTENSITY_FILL: Record<0 | 1 | 2 | 3 | 4, string> = {
  0: "bg-black/[0.04]",
  1: "bg-[#c5dce5]",
  2: "bg-[#92b9c6]",
  3: "bg-[#355d72]",
  4: "bg-[#0a2941]",
};

const JULY_ACTIVITY: Partial<Record<number, 1 | 2 | 3 | 4>> = {
  2: 1,
  4: 2,
  6: 1,
  8: 3,
  9: 2,
  11: 1,
  13: 3,
  14: 2,
  16: 1,
  18: 3,
  19: 2,
  21: 4,
  23: 3,
  24: 4,
  25: 4,
  26: 4,
};

const STREAK_DAYS = new Set([22, 23, 24, 25, 26]);

const SECTION_SCORES = [
  { name: "Verbal Reasoning", estimate: 565, target: 720 },
  { name: "Decision Making", estimate: 655, target: 780 },
  { name: "Quantitative Reasoning", estimate: 495, target: 750 },
  { name: "Situational Judgement", estimate: 540, target: 700 },
] as const;

/** Early student ~45th percentile — low question volume. */
const SECTION_QUESTIONS = [
  { name: "Verbal Reasoning", completed: 213, total: 4383 },
  { name: "Decision Making", completed: 161, total: 3082 },
  { name: "Quantitative Reasoning", completed: 254, total: 4218 },
  { name: "Situational Judgement", completed: 57, total: 1372 },
] as const;

const TOTAL_COMPLETED = SECTION_QUESTIONS.reduce(
  (sum, section) => sum + section.completed,
  0,
);
const TOTAL_AVAILABLE = SECTION_QUESTIONS.reduce(
  (sum, section) => sum + section.total,
  0,
);
const COMPLETION_PERCENT = Math.round(
  (TOTAL_COMPLETED / TOTAL_AVAILABLE) * 100,
);

const FLOATING_CARD =
  "rounded-2xl border border-black/10 bg-white/[0.97] text-[#1a1a1a] shadow-[0_18px_48px_rgba(15,23,42,0.14)] ring-1 ring-black/[0.07] backdrop-blur-xl";

const CARD_CHROME =
  "rounded-[1.25rem] bg-white shadow-sm ring-1 ring-black/[0.055]";

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function scorePosition(score: number, minimum = 300, maximum = 900): number {
  return clampPercent(((score - minimum) / (maximum - minimum)) * 100);
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-black/[0.08] py-2 last:border-0">
      <span className="text-sm text-muted-foreground text-black/50">{label}</span>
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
}: {
  value: number;
  leftPercent: number;
  tone: "estimate" | "target";
  overlapOffset: "none" | "above" | "below";
  animate: boolean;
  delay: number;
}) {
  const clampedLeft = Math.max(3, Math.min(97, leftPercent));

  return (
    <div
      className={[
        "absolute z-[2]",
        overlapOffset === "none" &&
          "top-1/2 -translate-x-1/2 -translate-y-1/2",
        overlapOffset === "above" && "top-0 -translate-x-1/2",
        overlapOffset === "below" && "bottom-0 -translate-x-1/2",
      ]
        .filter(Boolean)
        .join(" ")}
      style={{ left: `${clampedLeft}%` }}
    >
      <motion.div
        className="origin-center"
        initial={animate ? { opacity: 0, scale: 0.65 } : false}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 320, damping: 30, delay }}
      >
        <span
          className={[
            "inline-block rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums shadow-sm ring-1",
            tone === "estimate"
              ? "border border-[#0a2941]/20 bg-[#0a2941] text-white ring-white"
              : "border border-amber-950/15 bg-amber-400 text-slate-950 ring-white/60",
          ].join(" ")}
        >
          {value}
        </span>
      </motion.div>
    </div>
  );
}

function ScoreScale({
  estimate,
  target,
  animate,
  delay,
}: {
  estimate: number;
  target: number;
  animate: boolean;
  delay: number;
}) {
  const estimatePos = scorePosition(estimate);
  const targetPos = scorePosition(target);
  const pillsOverlap = Math.abs(estimatePos - targetPos) < 18;
  const gapLeft = Math.min(estimatePos, targetPos);
  const gapWidth = Math.abs(estimatePos - targetPos);

  return (
    <div className={pillsOverlap ? "relative h-12" : "relative h-8"}>
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
      />
      <ScalePill
        value={target}
        leftPercent={targetPos}
        tone="target"
        overlapOffset={pillsOverlap ? "above" : "none"}
        animate={animate}
        delay={delay + 0.28}
      />
    </div>
  );
}

function CircularProgress({
  percentage,
  animate,
  size = 48,
}: {
  percentage: number;
  animate: boolean;
  size?: number;
}) {
  const strokeWidth = 4;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const capped = Math.min(100, Math.max(0, percentage));
  const offset = circumference - (capped / 100) * circumference;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-black/[0.1]"
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeLinecap="round"
          className="text-[#0a2941]"
          initial={animate ? { strokeDashoffset: circumference } : false}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.85, ease: DEMO_EASE, delay: 0.2 }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-xs font-semibold tabular-nums">{capped}%</span>
      </div>
    </div>
  );
}

function ScoreInsightCard({
  className,
  animate,
}: {
  className?: string;
  animate: boolean;
}) {
  return (
    <motion.aside
      className={`${FLOATING_CARD} p-5 sm:p-6 ${className ?? ""}`}
      initial={animate ? { opacity: 0, y: 12 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.35, ease: DEMO_EASE }}
    >
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-black/45">
        <Sparkles className="size-3.5" aria-hidden />
        Score insight
      </div>
      <h2 className="mt-3 text-lg font-semibold tracking-tight">
        Your score is predicted to improve by about {PROJECTED_GAIN} points over
        the next 90 days
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-black/55">
        Your {CURRENT_ESTIMATE.toLocaleString()} estimate is around the 45th
        percentile against the published UCAT ANZ benchmark.
      </p>
      <div className="mt-5 border-t border-black/[0.08] pt-4">
        <MetricRow label="Current estimate" value={String(CURRENT_ESTIMATE)} />
        <MetricRow label="UCAT ANZ benchmark" value="45th percentile" />
        <MetricRow label="90-day change" value={`+${PROJECTED_GAIN}`} />
      </div>
    </motion.aside>
  );
}

export function UcatProgressPlanPreview() {
  const reduceMotion = useReducedMotion();
  const animate = !reduceMotion;

  return (
    <DemoStage>
      <motion.div
        className="pb-8"
        variants={demoContainerVariants}
        initial={animate ? "hidden" : false}
        animate="show"
      >
        <motion.section
          variants={demoItemVariants}
          className="relative isolate overflow-hidden border-b border-black/10 bg-gradient-to-b from-[#f6f7f9] via-[#eef0f3] to-[#f6f7f9]"
        >
          {/* Tall enough that the floating insight stays inside this section */}
          <div className="relative pb-8 lg:min-h-[34rem]">
            <div className="flex flex-col items-start justify-between gap-4 px-5 py-6 sm:flex-row sm:px-8 lg:px-10">
              <div>
                <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
                  Score progress
                </h1>
                <p className="mt-1 text-sm text-black/50">
                  Current estimate {CURRENT_ESTIMATE.toLocaleString()} · Target{" "}
                  {TARGET_SCORE.toLocaleString()}
                </p>
              </div>
              <span className="shrink-0 rounded-full bg-[#e8eaed] px-2.5 py-1 text-xs font-semibold text-[#0a2941]">
                Estimate forming
              </span>
            </div>

            {/* Full-bleed chart so projection + target line run behind the insight card */}
            <div className="relative mx-auto aspect-[800/260] max-h-[340px] w-full max-w-[1400px] px-4 sm:max-h-[380px] sm:px-6">
              {[40, 62, 82].map((top) => (
                <span
                  key={top}
                  className="absolute inset-x-4 border-t border-dashed border-black/10"
                  style={{ top: `${top}%` }}
                  aria-hidden
                />
              ))}
              {/* Target line — full width, sits under the insight card */}
              <div
                className="absolute inset-x-4 z-0 border-t-[1.5px] border-dashed border-amber-500/80"
                style={{ top: "12%" }}
                aria-hidden
              />
              <span className="absolute right-6 top-[3%] z-10 rounded-full bg-amber-500 px-2.5 py-1 text-[10px] font-semibold text-slate-950 sm:right-10">
                Target {TARGET_SCORE.toLocaleString()}
              </span>

              <svg
                viewBox="0 0 800 260"
                className="absolute inset-0 z-0 size-full"
                preserveAspectRatio="xMidYMid meet"
                aria-hidden
              >
                {/* Historical — starts at the left edge of the plot */}
                <motion.path
                  d="M16 198 C70 194 120 182 170 170 S280 142 380 124"
                  fill="none"
                  stroke="#0a2941"
                  strokeWidth="4"
                  strokeLinecap="round"
                  initial={animate ? { pathLength: 0 } : false}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.9, ease: DEMO_EASE }}
                />
                {/* Projection center (dashed) — continues under the insight card */}
                <motion.path
                  d="M380 124 C500 98 640 58 792 36"
                  fill="none"
                  stroke="#92b9c6"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeDasharray="10 8"
                  initial={animate ? { pathLength: 0 } : false}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 1.1, delay: 0.22, ease: DEMO_EASE }}
                />
                {/* Uncertainty cone — equal vertical offset above/below center */}
                <motion.path
                  d="M380 124
                     C500 78 640 30 792 8
                     L792 64
                     C640 86 500 118 380 124 Z"
                  fill="#92b9c6"
                  initial={animate ? { opacity: 0 } : false}
                  animate={{ opacity: 0.22 }}
                  transition={{ duration: 0.9, delay: 0.12 }}
                />
                <motion.circle
                  cx="380"
                  cy="124"
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

              <span className="absolute bottom-2 left-6 z-10 text-[10px] text-black/38">
                Historical estimates
              </span>
              <span className="absolute bottom-2 right-6 z-10 text-[10px] text-black/38">
                Projected to test day
              </span>
            </div>

            <ScoreInsightCard
              animate={animate}
              className="absolute right-6 top-24 z-20 hidden w-[min(390px,calc(100%-3rem))] lg:block"
            />
          </div>

          <ScoreInsightCard
            animate={animate}
            className="relative z-20 mx-4 -mt-8 mb-5 lg:hidden"
          />
        </motion.section>

        <motion.div
          variants={demoItemVariants}
          className="mx-auto mt-6 grid w-full max-w-[1400px] grid-cols-1 gap-5 px-5 sm:px-6 lg:grid-cols-3"
        >
          <motion.section
            className={`${CARD_CHROME} flex flex-col p-4 sm:p-5`}
            initial={animate ? { opacity: 0, y: 10 } : false}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.15, ease: DEMO_EASE }}
          >
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-base font-medium text-black/55">
                Review activity
              </h2>
              <motion.div
                className="flex shrink-0 items-center gap-1.5 rounded-full border border-amber-400/40 bg-amber-400/10 px-2.5 py-1"
                initial={animate ? { opacity: 0, scale: 0.8 } : false}
                animate={{ opacity: 1, scale: 1 }}
                transition={{
                  type: "spring",
                  stiffness: 340,
                  damping: 24,
                  delay: 0.25,
                }}
              >
                <Flame
                  className="size-3.5 fill-amber-400 text-amber-500"
                  aria-hidden
                />
                <span className="text-xs font-semibold tabular-nums">
                  5 days
                </span>
              </motion.div>
            </div>
            <div className="mt-4">
              <h3 className="mb-2 text-sm font-semibold">July 2026</h3>
              <div className="grid grid-cols-7 gap-1">
                {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(
                  (weekday) => (
                    <div
                      key={weekday}
                      className="pb-0.5 text-center text-[9px] font-medium uppercase tracking-[0.1em] text-black/42"
                    >
                      {weekday}
                    </div>
                  ),
                )}
                {Array.from({ length: 2 }, (_, index) => (
                  <span key={`blank-${index}`} className="aspect-square" />
                ))}
                {Array.from({ length: 31 }, (_, index) => {
                  const day = index + 1;
                  const intensity = JULY_ACTIVITY[day] ?? 0;
                  const inStreak = STREAK_DAYS.has(day);
                  return (
                    <div key={day} className="relative aspect-square">
                      <span className="relative flex size-full items-center justify-center overflow-hidden rounded-[22%]">
                        <span
                          className={`absolute inset-0 ${INTENSITY_FILL[intensity]}`}
                        />
                        {inStreak ? (
                          <Flame
                            className="relative z-[1] size-[45%] max-h-3.5 max-w-3.5 fill-amber-400 text-amber-500"
                            aria-hidden
                          />
                        ) : null}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.section>

          <section className={`${CARD_CHROME} overflow-hidden`}>
            <div className="p-4 pb-2 sm:p-5 sm:pb-2">
              <h2 className="text-base font-medium text-black/55">
                Score by section
              </h2>
            </div>
            <div className="divide-y divide-black/[0.06]">
              {SECTION_SCORES.map((section, index) => (
                <motion.div
                  key={section.name}
                  className="px-4 py-3 sm:px-5"
                  initial={animate ? { opacity: 0, y: 8 } : false}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.28,
                    delay: 0.2 + index * 0.05,
                    ease: DEMO_EASE,
                  }}
                >
                  <h3 className="text-sm font-semibold">{section.name}</h3>
                  <div className="mt-2">
                    <ScoreScale
                      estimate={section.estimate}
                      target={section.target}
                      animate={animate}
                      delay={0.2 + index * 0.05}
                    />
                  </div>
                </motion.div>
              ))}
            </div>
          </section>

          <section className={`${CARD_CHROME} flex flex-col gap-4 p-5 sm:p-6`}>
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-base font-medium text-black/55">
                  Total questions completed
                </div>
                <span className="text-2xl font-bold tabular-nums">
                  {TOTAL_COMPLETED}
                  <span className="text-black/45"> / {TOTAL_AVAILABLE}</span>
                </span>
              </div>
              <CircularProgress
                percentage={COMPLETION_PERCENT}
                animate={animate}
              />
            </div>
            <div className="border-t border-black/[0.06] pt-3">
              <div className="mb-2 text-xs font-medium text-black/45">
                By section
              </div>
              <ul className="space-y-1.5">
                {SECTION_QUESTIONS.map((section) => (
                  <li
                    key={section.name}
                    className="flex items-baseline justify-between gap-2 text-sm"
                  >
                    <span className="truncate text-black/55">{section.name}</span>
                    <span className="shrink-0 tabular-nums font-medium">
                      {section.completed}
                      <span className="text-black/40">/{section.total}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        </motion.div>
      </motion.div>
    </DemoStage>
  );
}
