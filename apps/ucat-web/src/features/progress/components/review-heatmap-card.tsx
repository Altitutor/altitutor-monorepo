"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
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
  buildReviewHeatmapModel,
  formatHeatmapDayLabel,
  reviewHeatmapIntensityLevel,
  type HeatmapCell,
  type HeatmapDay,
  type HeatmapMonthGroup,
} from "../lib/review-heatmap";

const INTENSITY_CLASS: Record<0 | 1 | 2 | 3 | 4, string> = {
  /* Zero activity: visible on white; in dark, foreground tint reads above card */
  0: "bg-primary/5",
  1: "bg-primary/25",
  2: "bg-primary/45",
  3: "bg-primary/65",
  4: "bg-primary/85",
};

const FUTURE_CLASS =
  "bg-[hsl(var(--foreground)_/_0.08)] dark:bg-[hsl(var(--foreground)_/_0.14)]";

/** Row height matches dot + focus padding (compact, same as original heatmap) */
const ROW_CLASS = "flex h-[14px] shrink-0 items-center sm:h-4";

const CELL_GAP = "gap-px";

const DOW_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

type ReviewHeatmapCardProps = {
  data: Pick<ProgressResponse, "questionAttempts" | "setAttempts">;
  className?: string;
};

function BlankCell() {
  return (
    <div className={cn(ROW_CLASS, "w-4 justify-center sm:w-4")} aria-hidden>
      <div className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
    </div>
  );
}

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
      <div
        className={cn(ROW_CLASS, "w-4 justify-center sm:w-4")}
        aria-label={aria}
      >
        {square}
      </div>
    );
  }

  return (
    <div className={cn(ROW_CLASS, "w-4 justify-center sm:w-4")}>
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
    </div>
  );
}

function HeatmapCellView({ cell }: { cell: HeatmapCell }) {
  if (cell.kind === "blank") {
    return <BlankCell />;
  }
  return <DayCell day={cell.day} />;
}

function WeekColumnStrip({
  column,
  colKey,
}: {
  column: HeatmapMonthGroup["columns"][number];
  colKey: string;
}) {
  return (
    <div className={cn("flex flex-col", CELL_GAP)} role="presentation">
      {column.cells.map((cell, rowIdx) => (
        <HeatmapCellView
          key={`${colKey}-r${rowIdx}`}
          cell={cell}
        />
      ))}
    </div>
  );
}

export function ReviewHeatmapCard({ data, className }: ReviewHeatmapCardProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const monthGroups = useMemo(
    () =>
      buildReviewHeatmapModel(new Date(), {
        questionAttempts: data.questionAttempts,
        setAttempts: data.setAttempts,
      }),
    [data.questionAttempts, data.setAttempts],
  );

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollLeft = el.scrollWidth - el.clientWidth;
  }, [monthGroups]);

  return (
    <Card className={cn("border-border", className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium">Review heatmap</CardTitle>
        <p className="text-muted-foreground text-sm font-normal">
          Daily question and set attempts.
        </p>
      </CardHeader>
      <CardContent className="min-w-0 space-y-3">
        <TooltipProvider delayDuration={200}>
          <div ref={scrollRef} className="flex gap-1.5 overflow-x-auto pb-1">
            <div
              className="sticky left-0 z-10 flex shrink-0 flex-col gap-0.5 bg-card pr-1.5"
              aria-hidden
            >
              <div className="flex h-4 shrink-0 sm:h-5" />
              <div className={cn("flex flex-col", CELL_GAP)}>
                {DOW_LABELS.map((label) => (
                  <div
                    key={label}
                    className={cn(
                      ROW_CLASS,
                      "justify-end text-[10px] text-muted-foreground tabular-nums",
                    )}
                  >
                    {label}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex min-w-0 items-end gap-0">
              {monthGroups.map((group, gi) => (
                <div
                  key={`${group.monthKey}-${gi}`}
                  className={cn(
                    "flex shrink-0 flex-col gap-0.5",
                    gi > 0 &&
                      "border-l border-dashed border-border pl-1.5 ml-0.5",
                  )}
                >
                  <div className="flex h-4 min-w-0 items-end justify-center px-0.5 sm:h-5">
                    <span className="text-center text-[10px] font-medium leading-none text-muted-foreground whitespace-nowrap">
                      {group.label}
                    </span>
                  </div>
                  <div className={cn("flex", CELL_GAP)}>
                    {group.columns.map((column, ci) => (
                      <WeekColumnStrip
                        key={`${group.monthKey}-${gi}-${ci}`}
                        column={column}
                        colKey={`${group.monthKey}-${gi}-${ci}`}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>Less</span>
            <div className="flex gap-px">
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
