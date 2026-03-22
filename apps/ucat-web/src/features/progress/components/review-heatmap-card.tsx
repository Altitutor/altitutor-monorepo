"use client";

import { useMemo } from "react";
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
import { cn } from "@/lib/utils";
import type { ProgressResponse } from "@/app/api/ucat/progress/route";
import {
  buildReviewHeatmapWeeks,
  formatHeatmapDayLabel,
  reviewHeatmapIntensityLevel,
  type HeatmapDay,
} from "../lib/review-heatmap";

const INTENSITY_CLASS: Record<0 | 1 | 2 | 3 | 4, string> = {
  0: "bg-muted/35 dark:bg-muted/25",
  1: "bg-primary/25",
  2: "bg-primary/45",
  3: "bg-primary/65",
  4: "bg-primary/85",
};

const FUTURE_CLASS = "bg-muted/20 dark:bg-muted/15";

type ReviewHeatmapCardProps = {
  data: Pick<ProgressResponse, "questionAttempts" | "setAttempts">;
  className?: string;
};

function DayCell({ day }: { day: HeatmapDay }) {
  const total = day.questionAttempts + day.setAttempts;
  const level = day.isFuture ? 0 : reviewHeatmapIntensityLevel(total);
  const label = formatHeatmapDayLabel(day.dateKey);
  const aria = day.isFuture
    ? `${label} (upcoming)`
    : `${label}: ${day.questionAttempts} question attempts, ${day.setAttempts} set attempts`;

  const square = (
    <div
      className={cn(
        "h-2.5 w-2.5 shrink-0 rounded-[2px] sm:h-3 sm:w-3",
        day.isFuture ? FUTURE_CLASS : INTENSITY_CLASS[level],
      )}
      aria-hidden
    />
  );

  if (day.isFuture) {
    return (
      <div className="flex items-center justify-center" aria-label={aria}>
        {square}
      </div>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex items-center justify-center rounded-sm p-0.5",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
          )}
          aria-label={aria}
        >
          {square}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs text-left">
        <p className="font-medium">{label}</p>
        <p className="text-muted-foreground text-xs">
          {day.questionAttempts} question attempt
          {day.questionAttempts === 1 ? "" : "s"}
        </p>
        <p className="text-muted-foreground text-xs">
          {day.setAttempts} set attempt{day.setAttempts === 1 ? "" : "s"}
        </p>
      </TooltipContent>
    </Tooltip>
  );
}

export function ReviewHeatmapCard({ data, className }: ReviewHeatmapCardProps) {
  const weeks = useMemo(
    () =>
      buildReviewHeatmapWeeks(new Date(), {
        questionAttempts: data.questionAttempts,
        setAttempts: data.setAttempts,
      }),
    [data.questionAttempts, data.setAttempts],
  );

  const dowLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <Card className={cn("border-border", className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium">Review heatmap</CardTitle>
        <p className="text-muted-foreground text-sm font-normal">
          Daily question and set attempts (last ~53 weeks). Darker means more
          activity that day.
        </p>
      </CardHeader>
      <CardContent className="min-w-0 space-y-3">
        <TooltipProvider delayDuration={200}>
          <div className="flex gap-2 overflow-x-auto pb-1">
            <div
              className="flex shrink-0 flex-col gap-[3px] pt-5 text-[10px] text-muted-foreground"
              aria-hidden
            >
              {dowLabels.map((label, i) => (
                <div
                  key={label}
                  className="flex h-2.5 items-center sm:h-3"
                >
                  {i % 2 === 1 ? label : ""}
                </div>
              ))}
            </div>
            <div className="flex min-w-0 flex-1 gap-[3px]">
              {weeks.map((column, colIdx) => (
                <div
                  key={colIdx}
                  className="flex flex-col gap-[3px]"
                  role="presentation"
                >
                  {column.map((day) => (
                    <DayCell key={day.dateKey} day={day} />
                  ))}
                </div>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>Less</span>
            <div className="flex gap-1">
              {([0, 1, 2, 3, 4] as const).map((lvl) => (
                <div
                  key={lvl}
                  className={cn(
                    "h-2.5 w-2.5 rounded-[2px] sm:h-3 sm:w-3",
                    INTENSITY_CLASS[lvl],
                  )}
                />
              ))}
            </div>
            <span>More</span>
          </div>
        </TooltipProvider>
      </CardContent>
    </Card>
  );
}
