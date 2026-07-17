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
  renderDay: (day: UcatCalendarDay) => ReactNode;
};

export function UcatMonthCalendar({
  months,
  initialMonthKey,
  ariaLabel,
  className,
  title,
  description,
  headerAction,
  legend,
  renderDay,
}: UcatMonthCalendarProps) {
  const resolvedInitialIndex = initialMonthKey
    ? months.findIndex((month) => month.key === initialMonthKey)
    : 0;
  const [visibleMonthIndex, setVisibleMonthIndex] = useState(
    resolvedInitialIndex >= 0 ? resolvedInitialIndex : 0,
  );
  const visibleMonth = months[visibleMonthIndex] ?? months[0];

  function showMonth(index: number) {
    if (!months[index]) return;
    setVisibleMonthIndex(index);
  }

  if (!visibleMonth) return null;

  return (
    <Card
      className={cn(UCAT_CARD_CHROME, "overflow-hidden", className)}
      role="region"
      aria-label={ariaLabel}
      data-visible-month={visibleMonth.key}
    >
      <CardHeader className="space-y-3 p-5 pb-3">
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

        <div className="flex items-center justify-between gap-3">
          <h3 className={cn(title ? "text-base font-semibold" : "text-lg font-semibold")}>
            {visibleMonth.label}
          </h3>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="icon"
              variant="outline"
              className="size-9"
              disabled={visibleMonthIndex === 0}
              onClick={() => showMonth(visibleMonthIndex - 1)}
              aria-label="Previous month"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="outline"
              className="size-9"
              disabled={visibleMonthIndex === months.length - 1}
              onClick={() => showMonth(visibleMonthIndex + 1)}
              aria-label="Next month"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {legend ? (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] text-muted-foreground">
            {legend}
          </div>
        ) : null}
      </CardHeader>

      <CardContent className="p-5 pt-0">
        <div className="grid grid-cols-7 gap-1.5">
          {WEEKDAYS.map((weekday) => (
            <div
              key={weekday}
              className="pb-0.5 text-center text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground"
            >
              {weekday}
            </div>
          ))}

          {visibleMonth.days.map((day, index) => {
            if (!day) {
              return <span key={`blank-${index}`} aria-hidden />;
            }
            return <div key={day.dateKey}>{renderDay(day)}</div>;
          })}
        </div>
      </CardContent>
    </Card>
  );
}

export function UcatActivityIntensityLegend({
  label = "Practice load",
}: {
  label?: string;
}) {
  return (
    <>
      <span>{label}</span>
      <span className="flex gap-1" aria-label={`Less to more ${label.toLowerCase()}`}>
        {([0, 1, 2, 3, 4] as const).map((level) => (
          <span
            key={level}
            className={cn("h-2.5 w-2.5 rounded-[3px]", ACTIVITY_INTENSITY_CLASS[level])}
            aria-hidden
          />
        ))}
      </span>
    </>
  );
}
