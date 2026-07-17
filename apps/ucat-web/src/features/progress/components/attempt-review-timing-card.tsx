"use client";

import { Info } from "lucide-react";
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
import { UCAT_CARD_CHROME } from "@/lib/ucat-surface-motion";
import { cn } from "@/lib/utils";
import { formatTimeSeconds } from "../lib/format-time";
import { formatSpeedMultiplier } from "../lib/format-speed-multiplier";

export type AttemptReviewExamTimingMetrics = {
  timeTakenSeconds: number | null;
  setTimeLimitSeconds: number | null;
  /** Exam-pace time limit. When equal to setTimeLimitSeconds, exam speed is hidden. */
  examTimeLimitSeconds?: number | null;
  studentSetSpeed: number | null;
  studentExamSpeed: number | null;
};

/** @deprecated Prefer AttemptReviewExamTimingMetrics */
export type AttemptReviewTimingMetrics = AttemptReviewExamTimingMetrics;

export type AttemptReviewPracticeTimingMetrics = {
  sessionTimeSeconds: number | null;
  averageTimePerQuestionSeconds: number | null;
};

type ExamTimingCardProps = {
  className?: string;
  scopeLabel?: "set" | "mock";
  timing: AttemptReviewExamTimingMetrics;
};

type PracticeTimingCardProps = {
  className?: string;
  scopeLabel: "practice";
  timing: AttemptReviewPracticeTimingMetrics;
};

export type AttemptReviewTimingCardProps =
  | ExamTimingCardProps
  | PracticeTimingCardProps;

function MetricRow({
  label,
  value,
  tooltip,
}: {
  label: string;
  value: string;
  tooltip: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <span>{label}</span>
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex cursor-help text-muted-foreground/80">
                <Info className="h-3.5 w-3.5" aria-label={`${label} explanation`} />
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[280px]">
              {tooltip}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      <div className="text-xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function isAtExamTiming(
  setTimeLimitSeconds: number | null | undefined,
  examTimeLimitSeconds: number | null | undefined,
): boolean {
  if (
    setTimeLimitSeconds == null ||
    examTimeLimitSeconds == null ||
    setTimeLimitSeconds <= 0 ||
    examTimeLimitSeconds <= 0
  ) {
    return false;
  }
  return setTimeLimitSeconds === examTimeLimitSeconds;
}

function ExamTimingCardContent({
  timing,
  scopeLabel = "set",
}: {
  timing: AttemptReviewExamTimingMetrics;
  scopeLabel?: "set" | "mock";
}) {
  const timeTaken = timing.timeTakenSeconds;
  const timeLimit = timing.setTimeLimitSeconds;
  const timeDisplay =
    timeLimit != null && timeLimit > 0 && timeTaken != null
      ? `${formatTimeSeconds(Math.round(timeTaken))} / ${formatTimeSeconds(Math.round(timeLimit))}`
      : timeTaken != null
        ? formatTimeSeconds(Math.round(timeTaken))
        : "—";

  const showExamSpeed = !isAtExamTiming(
    timing.setTimeLimitSeconds,
    timing.examTimeLimitSeconds,
  );

  const speedLabel = scopeLabel === "mock" ? "Mock speed" : "Set speed";

  return (
    <>
      <MetricRow
        label="Time"
        value={timeDisplay}
        tooltip={
          scopeLabel === "mock"
            ? "Time taken vs time limit for this mock (e.g. 1:45:00 / 2:00:00)."
            : "Time taken vs time limit for this set (e.g. 25:00 / 30:00)."
        }
      />
      <MetricRow
        label={speedLabel}
        value={formatSpeedMultiplier(timing.studentSetSpeed)}
        tooltip={
          scopeLabel === "mock"
            ? "How fast you completed this mock vs its time limit. 1x uses the full limit; above 1x means you finished early."
            : "How fast you completed this set vs its time limit. 1x uses the full limit; above 1x means you finished early."
        }
      />
      {showExamSpeed ? (
        <MetricRow
          label="Exam speed"
          value={formatSpeedMultiplier(timing.studentExamSpeed)}
          tooltip={
            scopeLabel === "mock"
              ? "How fast you completed this mock vs exam pace. 1x matches exam pace; above 1x is faster."
              : "How fast you completed this set vs exam pace. 1x matches exam pace; above 1x is faster."
          }
        />
      ) : null}
    </>
  );
}

function PracticeTimingCardContent({
  timing,
}: {
  timing: AttemptReviewPracticeTimingMetrics;
}) {
  const sessionDisplay =
    timing.sessionTimeSeconds != null
      ? formatTimeSeconds(Math.round(timing.sessionTimeSeconds))
      : "—";
  const averageDisplay =
    timing.averageTimePerQuestionSeconds != null
      ? formatTimeSeconds(Math.round(timing.averageTimePerQuestionSeconds))
      : "—";

  return (
    <>
      <MetricRow
        label="Session time"
        value={sessionDisplay}
        tooltip="Total time spent in this practice session."
      />
      <MetricRow
        label="Avg time / question"
        value={averageDisplay}
        tooltip="Average time spent per question in this practice session."
      />
    </>
  );
}

export function AttemptReviewTimingCard(props: AttemptReviewTimingCardProps) {
  const { className } = props;

  return (
    <Card id="tour-attempt-timing" className={cn(UCAT_CARD_CHROME, "h-full", className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium">Timing</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {props.scopeLabel === "practice" ? (
          <PracticeTimingCardContent timing={props.timing} />
        ) : (
          <ExamTimingCardContent
            timing={props.timing}
            scopeLabel={props.scopeLabel}
          />
        )}
      </CardContent>
    </Card>
  );
}
