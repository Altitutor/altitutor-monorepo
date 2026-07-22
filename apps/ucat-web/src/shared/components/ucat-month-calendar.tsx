"use client";

import { useState, type ReactNode } from "react";
import { Card, CardContent, CardHeader } from "@altitutor/ui";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ACTIVITY_INTENSITY_CLASS,
  type UcatCalendarDay,
  type UcatCalendarMonth,
} from "@/shared/lib/ucat-month-calendar";
import { UCAT_CARD_CHROME } from "@/lib/ucat-surface-motion";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export type UcatMonthCalendarProps = {
  months: UcatCalendarMonth[];
  /** YYYY-MM — defaults to first month */
  initialMonthKey?: string;
  ariaLabel: string;
  className?: string;
  /** Optional section title above the month navigator */
  title?: ReactNode;
  description?: ReactNode;
  headerAction?: ReactNode;
  /** Shown under the month title (e.g. intensity legend) */
  legend?: ReactNode;
  /**
   * How many months to show at once. Dual-month view still advances one month
   * at a time so the overlapping month stays in frame.
   */
  monthsVisible?: 1 | 2;
  /** Tighter day cells and padding for denser layouts */
  density?: "default" | "compact";
  renderDay: (day: UcatCalendarDay) => ReactNode;
};

function MonthGrid({
  month,
  density,
  renderDay,
}: {
  month: UcatCalendarMonth;
  density: "default" | "compact";
  renderDay: (day: UcatCalendarDay) => ReactNode;
}) {
  const isCompact = density === "compact";

  return (
    <div className="min-w-0">
      <h3
        className={cn(
          "font-semibold",
          isCompact ? "mb-2 text-sm" : "mb-3 text-base",
        )}
      >
        {month.label}
      </h3>
      <div className={cn("grid grid-cols-7", isCompact ? "gap-1" : "gap-1.5")}>
        {WEEKDAYS.map((weekday) => (
          <div
            key={`${month.key}-${weekday}`}
            className={cn(
              "pb-0.5 text-center font-medium uppercase tracking-[0.1em] text-muted-foreground",
              isCompact ? "text-[9px]" : "text-[10px]",
            )}
          >
            {weekday}
          </div>
        ))}

        {month.days.map((day, index) => {
          if (!day) {
            return <span key={`${month.key}-blank-${index}`} aria-hidden />;
          }
          return <div key={day.dateKey}>{renderDay(day)}</div>;
        })}
      </div>
    </div>
  );
}

export function UcatMonthCalendar({
  months,
  initialMonthKey,
  ariaLabel,
  className,
  title,
  description,
  headerAction,
  legend,
  monthsVisible = 1,
  density = "default",
  renderDay,
}: UcatMonthCalendarProps) {
  const resolvedInitialIndex = initialMonthKey
    ? months.findIndex((month) => month.key === initialMonthKey)
    : 0;
  const maxStartIndex = Math.max(0, months.length - monthsVisible);
  const clampedInitial = Math.min(
    Math.max(resolvedInitialIndex >= 0 ? resolvedInitialIndex : 0, 0),
    maxStartIndex,
  );
  // Prefer showing the previous month alongside the initial month in dual view.
  const [visibleStartIndex, setVisibleStartIndex] = useState(() => {
    if (monthsVisible === 2 && clampedInitial > 0) {
      return Math.min(clampedInitial - 1, maxStartIndex);
    }
    return clampedInitial;
  });

  const visibleMonths = months.slice(
    visibleStartIndex,
    visibleStartIndex + monthsVisible,
  );

  function showMonth(index: number) {
    if (index < 0 || index > maxStartIndex) return;
    setVisibleStartIndex(index);
  }

  if (visibleMonths.length === 0) return null;

  const isCompact = density === "compact";
  const canGoPrev = visibleStartIndex > 0;
  const canGoNext = visibleStartIndex < maxStartIndex;

  return (
    <Card
      className={cn(UCAT_CARD_CHROME, "overflow-hidden", className)}
      role="region"
      aria-label={ariaLabel}
      data-visible-month={visibleMonths[0]?.key}
    >
      <CardHeader
        className={cn("space-y-3", isCompact ? "p-4 pb-2" : "p-5 pb-3")}
      >
        {title ? (
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <h2 className="text-base font-medium">{title}</h2>
              {description ? (
                <p className="text-muted-foreground text-sm font-normal">
                  {description}
                </p>
              ) : null}
            </div>
            {headerAction}
          </div>
        ) : null}

        {monthsVisible === 1 ? (
          <div className="flex items-center justify-between gap-3">
            <h3
              className={cn(
                "font-semibold",
                title ? "text-base" : "text-lg",
              )}
            >
              {visibleMonths[0]?.label}
            </h3>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="icon"
                variant="outline"
                className={isCompact ? "size-8" : "size-9"}
                disabled={!canGoPrev}
                onClick={() => showMonth(visibleStartIndex - 1)}
                aria-label="Previous month"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="outline"
                className={isCompact ? "size-8" : "size-9"}
                disabled={!canGoNext}
                onClick={() => showMonth(visibleStartIndex + 1)}
                aria-label="Next month"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
            {legend ? (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] text-muted-foreground">
                {legend}
              </div>
            ) : (
              <span className="sr-only">
                Showing{" "}
                {visibleMonths.map((month) => month.label).join(" and ")}
              </span>
            )}
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="icon"
                variant="outline"
                className={isCompact ? "size-8" : "size-9"}
                disabled={!canGoPrev}
                onClick={() => showMonth(visibleStartIndex - 1)}
                aria-label="Previous month"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="outline"
                className={isCompact ? "size-8" : "size-9"}
                disabled={!canGoNext}
                onClick={() => showMonth(visibleStartIndex + 1)}
                aria-label="Next month"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {monthsVisible === 1 && legend ? (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] text-muted-foreground">
            {legend}
          </div>
        ) : null}
      </CardHeader>

      <CardContent className={cn(isCompact ? "p-4 pt-0" : "p-5 pt-0")}>
        {monthsVisible === 1 ? (
          <div
            className={cn("grid grid-cols-7", isCompact ? "gap-1" : "gap-1.5")}
          >
            {WEEKDAYS.map((weekday) => (
              <div
                key={weekday}
                className={cn(
                  "pb-0.5 text-center font-medium uppercase tracking-[0.1em] text-muted-foreground",
                  isCompact ? "text-[9px]" : "text-[10px]",
                )}
              >
                {weekday}
              </div>
            ))}

            {(visibleMonths[0]?.days ?? []).map((day, index) => {
              if (!day) {
                return <span key={`blank-${index}`} aria-hidden />;
              }
              return <div key={day.dateKey}>{renderDay(day)}</div>;
            })}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {visibleMonths.map((month) => (
              <MonthGrid
                key={month.key}
                month={month}
                density={density}
                renderDay={renderDay}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function UcatActivityIntensityLegend() {
  return (
    <span className="flex items-center gap-2">
      <span>Less practice</span>
      <span
        className="flex gap-1"
        aria-label="Less practice to more practice"
      >
        {([0, 1, 2, 3, 4] as const).map((level) => (
          <span
            key={level}
            className={cn(
              "h-2.5 w-2.5 rounded-[3px]",
              ACTIVITY_INTENSITY_CLASS[level],
            )}
            aria-hidden
          />
        ))}
      </span>
      <span>More practice</span>
    </span>
  );
}
