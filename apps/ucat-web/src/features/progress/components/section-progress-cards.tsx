"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@altitutor/ui";
import { motion, useReducedMotion } from "motion/react";
import { UCAT_CARD_CHROME } from "@/lib/ucat-surface-motion";
import { cn } from "@/lib/utils";
import type { SectionProgress } from "@altitutor/shared";
import type { ProgressMode } from "../lib/progress-mode";
import type { SectionScoreProjection } from "@/features/score-projection/types/score-projection";
import { UcatTableRowActionLink } from "./ucat-table-row-action-link";

type SectionProgressCardsProps = {
  sections: SectionProgress[];
  linkToSection?: boolean;
  sectionHrefPrefix?: string;
  mode: ProgressMode;
  timeFrameDays: string;
  scoreProjections?: SectionScoreProjection[];
  sectionTargets?: Record<string, number>;
  mockRecentWeightedAverage?: number | null;
  mockTargetScore?: number | null;
};

const SPRING = { type: "spring" as const, stiffness: 320, damping: 30 };
const EASE_OUT = [0.32, 0.72, 0, 1] as const;

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function ScalePill({
  value,
  leftPercent,
  tone,
  overlapOffset,
  ariaLabel,
  tooltipTitle,
  tooltipBody,
  tooltipDetail,
  animate,
  delay = 0,
}: {
  value: number;
  leftPercent: number;
  tone: "estimate" | "target";
  overlapOffset: "none" | "above" | "below";
  ariaLabel: string;
  tooltipTitle: string;
  tooltipBody: string;
  tooltipDetail?: string | null;
  animate: boolean;
  delay?: number;
}) {
  // Keep pills on-scale; only nudge enough to avoid clipping at the edges.
  const clampedLeft = Math.max(3, Math.min(97, leftPercent));

  return (
    <div
      className={cn(
        "absolute z-[2]",
        // Positioning transforms live on this wrapper so Motion scale/opacity
        // on the child cannot wipe -translate-* and drop pills below the track.
        overlapOffset === "none" &&
          "top-1/2 -translate-x-1/2 -translate-y-1/2",
        overlapOffset === "above" && "top-0 -translate-x-1/2",
        overlapOffset === "below" && "bottom-0 -translate-x-1/2",
      )}
      style={{ left: `${clampedLeft}%` }}
    >
      <motion.div
        className="origin-center"
        initial={animate ? { opacity: 0, scale: 0.65 } : false}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ ...SPRING, delay }}
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className={cn(
                "rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums shadow-sm ring-1 transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                tone === "estimate" &&
                  "border border-primary/20 bg-primary text-primary-foreground ring-background",
                tone === "target" &&
                  "border border-amber-950/15 bg-amber-400 text-slate-950 ring-white/60 dark:border-amber-200/20 dark:bg-amber-300 dark:ring-black/20",
              )}
              aria-label={ariaLabel}
            >
              {Math.round(value)}
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-56 px-3 py-2 text-left">
            <p className="font-medium">{tooltipTitle}</p>
            <p className="mt-1 text-muted-foreground">{tooltipBody}</p>
            {tooltipDetail ? (
              <p className="mt-1.5 font-medium tabular-nums text-foreground">
                {tooltipDetail}
              </p>
            ) : null}
          </TooltipContent>
        </Tooltip>
      </motion.div>
    </div>
  );
}

function ScoreScale({
  score,
  target,
  scoreLabel,
  minimum = 300,
  maximum = 900,
  estimateTooltip,
  targetTooltip,
  animate,
  delay = 0,
}: {
  score: number | null;
  target: number | null;
  scoreLabel: string;
  minimum?: number;
  maximum?: number;
  estimateTooltip: { title: string; body: string };
  targetTooltip: { title: string; body: string };
  animate: boolean;
  delay?: number;
}) {
  const range = maximum - minimum;
  const scorePosition =
    score == null ? null : clampPercent(((score - minimum) / range) * 100);
  const targetPosition =
    target == null ? null : clampPercent(((target - minimum) / range) * 100);
  const pillsOverlap =
    scorePosition != null &&
    targetPosition != null &&
    Math.abs(scorePosition - targetPosition) < 18;

  if (score == null) {
    const examplePosition =
      targetPosition == null ? 58 : Math.max(18, targetPosition - 22);
    const pendingLabel = `${scoreLabel} pending${
      target == null ? "" : " · target set"
    }`;

    return (
      <div className="relative min-w-0" aria-label={pendingLabel}>
        <div className="relative h-8 overflow-hidden" aria-hidden>
          <div className="absolute inset-0 blur-[1.5px] opacity-45">
            <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-muted-foreground/35" />
            <span
              className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-primary/20 bg-primary px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-primary-foreground"
              style={{ left: `${examplePosition}%` }}
            >
              —
            </span>
            {target != null && targetPosition != null ? (
              <span
                className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-amber-950/15 bg-amber-400 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-slate-950"
                style={{ left: `${targetPosition}%` }}
              >
                {target}
              </span>
            ) : null}
          </div>
          <div className="absolute inset-0 z-10 flex items-center justify-center px-1">
            <motion.p
              className="rounded-full border border-border/70 bg-background/90 px-2.5 py-0.5 text-[10px] font-medium leading-4 text-muted-foreground shadow-sm backdrop-blur-sm"
              initial={animate ? { opacity: 0, y: 4 } : false}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: delay + 0.08, ease: EASE_OUT }}
            >
              {pendingLabel}
            </motion.p>
          </div>
        </div>
      </div>
    );
  }

  const gapDetail =
    target == null
      ? null
      : target <= score
        ? `${Math.round(score - target)} points ahead of target`
        : `${Math.round(target - score)} points to target`;
  const gapLeft =
    scorePosition != null && targetPosition != null
      ? Math.min(scorePosition, targetPosition)
      : 0;
  const gapWidth =
    scorePosition != null && targetPosition != null
      ? Math.abs(targetPosition - scorePosition)
      : 0;

  return (
    <div
      className="min-w-0"
      aria-label={`${scoreLabel} ${Math.round(score)}${target == null ? "" : `, target ${target}`}`}
    >
      <div className={cn("relative", pillsOverlap ? "h-12" : "h-8")}>
        <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2">
          <motion.div
            className="h-full origin-left rounded-full bg-muted"
            initial={animate ? { scaleX: 0, opacity: 0.4 } : false}
            animate={{ scaleX: 1, opacity: 1 }}
            transition={{ duration: 0.45, delay, ease: EASE_OUT }}
          />
        </div>
        {scorePosition != null && targetPosition != null ? (
          <div
            className="absolute top-1/2 h-1 -translate-y-1/2 overflow-hidden rounded-full"
            style={{
              left: `${gapLeft}%`,
              width: `${gapWidth}%`,
            }}
          >
            <motion.div
              className="h-full origin-left rounded-full bg-primary/35"
              initial={animate ? { scaleX: 0, opacity: 0 } : false}
              animate={{ scaleX: 1, opacity: 1 }}
              transition={{
                duration: 0.5,
                delay: delay + 0.12,
                ease: EASE_OUT,
              }}
            />
          </div>
        ) : null}
        <ScalePill
          value={score}
          leftPercent={scorePosition ?? 0}
          tone="estimate"
          overlapOffset={pillsOverlap ? "below" : "none"}
          ariaLabel={`${scoreLabel} ${Math.round(score)}. Show details.`}
          tooltipTitle={estimateTooltip.title}
          tooltipBody={estimateTooltip.body}
          tooltipDetail={gapDetail}
          animate={animate}
          delay={delay + 0.18}
        />
        {target != null && targetPosition != null ? (
          <ScalePill
            value={target}
            leftPercent={targetPosition}
            tone="target"
            overlapOffset={pillsOverlap ? "above" : "none"}
            ariaLabel={`Target ${target}. Show details.`}
            tooltipTitle={targetTooltip.title}
            tooltipBody={targetTooltip.body}
            tooltipDetail={gapDetail}
            animate={animate}
            delay={delay + 0.28}
          />
        ) : null}
      </div>
    </div>
  );
}

export function SectionProgressCards({
  sections,
  linkToSection = false,
  sectionHrefPrefix = "/progress/sections",
  mode: _mode,
  timeFrameDays: _timeFrameDays,
  scoreProjections,
  sectionTargets = {},
  mockRecentWeightedAverage = null,
  mockTargetScore = null,
}: SectionProgressCardsProps) {
  const reduceMotion = useReducedMotion();
  const animate = !reduceMotion;
  const scoreBySectionNumber = new Map(
    (scoreProjections ?? []).map((projection) => [
      projection.sectionNumber,
      projection,
    ]),
  );

  return (
    <Card className={cn(UCAT_CARD_CHROME, "h-full overflow-hidden")}>
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-base font-medium text-muted-foreground">
          Score by section
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <TooltipProvider delayDuration={200}>
          <div className="divide-y divide-border/60">
            {sections.map((section, index) => {
              const score =
                scoreBySectionNumber.get(section.sectionNumber)
                  ?.currentEstimate ?? null;
              const href = `${sectionHrefPrefix}/${section.sectionNumber}`;
              const sectionTarget = sectionTargets[section.sectionId] ?? null;
              const rowDelay = animate ? index * 0.05 : 0;
              return (
                <motion.div
                  key={section.sectionId}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-2.5"
                  initial={animate ? { opacity: 0, y: 8 } : false}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.28,
                    delay: rowDelay,
                    ease: EASE_OUT,
                  }}
                >
                  <div className="min-w-0">
                    <h3 className="min-w-0 text-sm font-semibold">
                      {section.sectionName}
                    </h3>
                    <div className="mt-1.5">
                      <ScoreScale
                        score={score}
                        target={sectionTarget}
                        scoreLabel="Estimate"
                        animate={animate}
                        delay={rowDelay + 0.04}
                        estimateTooltip={{
                          title:
                            score == null
                              ? "Estimate pending"
                              : `Estimate ${Math.round(score)}`,
                          body: "Your current section estimate from recent timed evidence.",
                        }}
                        targetTooltip={{
                          title:
                            sectionTarget == null
                              ? "Target"
                              : `Target ${sectionTarget}`,
                          body: "The section score your study plan is aiming for.",
                        }}
                      />
                    </div>
                  </div>
                  {linkToSection ? (
                    <UcatTableRowActionLink
                      href={href}
                      label="View"
                      ariaLabel={`View ${section.sectionName} progress`}
                    />
                  ) : null}
                </motion.div>
              );
            })}
            {linkToSection ? (
              <motion.div
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 bg-muted/10 px-4 py-2.5"
                initial={animate ? { opacity: 0, y: 8 } : false}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.28,
                  delay: animate ? sections.length * 0.05 : 0,
                  ease: EASE_OUT,
                }}
              >
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold">Mocks</h3>
                  <div className="mt-1.5">
                    <ScoreScale
                      score={mockRecentWeightedAverage}
                      target={mockTargetScore}
                      scoreLabel="Weighted average"
                      minimum={900}
                      maximum={2700}
                      animate={animate}
                      delay={animate ? sections.length * 0.05 + 0.04 : 0}
                      estimateTooltip={{
                        title:
                          mockRecentWeightedAverage == null
                            ? "Weighted average pending"
                            : `Weighted average ${Math.round(mockRecentWeightedAverage)}`,
                        body: "A recency-weighted average of your completed mock totals.",
                      }}
                      targetTooltip={{
                        title:
                          mockTargetScore == null
                            ? "Target"
                            : `Target ${mockTargetScore}`,
                        body: "Your overall UCAT goal used as the mock score target.",
                      }}
                    />
                  </div>
                </div>
                <UcatTableRowActionLink
                  href="/progress/mocks"
                  label="View"
                  ariaLabel="View mock progress"
                />
              </motion.div>
            ) : null}
          </div>
        </TooltipProvider>
      </CardContent>
    </Card>
  );
}
