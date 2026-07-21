"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  Skeleton,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@altitutor/ui";
import { UcatHoverChevron } from "@/lib/ucat-hover-chevron";
import {
  UCAT_PRESSABLE_LIFT_HOVER,
  UCAT_SURFACE_MOTION,
} from "@/lib/ucat-surface-motion";
import { cn } from "@/lib/utils";
import { PracticeStreakWeek } from "@/features/streaks/components/practice-streak-week";
import { buildPracticeStreak } from "@/features/streaks/lib/practice-streak";
import {
  UcatActivityIntensityLegend,
  UcatMonthCalendar,
} from "@/shared/components/ucat-month-calendar";
import {
  ACTIVITY_INTENSITY_CLASS,
  relativeActivityIntensityLevel,
  buildUcatCalendarMonths,
  formatUcatCalendarDate,
  localDateKey,
  type ActivityIntensityLevel,
  type UcatCalendarDay,
} from "@/shared/lib/ucat-month-calendar";
import { useUcatActivity } from "../hooks/use-ucat-activity";
import type { UcatActivityResponse } from "@/app/api/ucat/activity/route";

type ReviewActivityCalendarCardProps = {
  className?: string;
  /** When true (e.g. on the dashboard), link to full progress. Omit on the progress page itself. */
  showViewAllProgressLink?: boolean;
  previewData?: UcatActivityResponse;
};

type DayActivity = {
  questionAttempts: number;
  setAttempts: number;
};

function placeholderActivity(dayNumber: number): DayActivity | undefined {
  if (dayNumber % 6 === 0) return { questionAttempts: 18, setAttempts: 1 };
  if (dayNumber % 4 === 0) return { questionAttempts: 9, setAttempts: 0 };
  if (dayNumber % 3 === 0) return { questionAttempts: 4, setAttempts: 0 };
  return undefined;
}

function ReviewDayCell({
  day,
  activity,
  intensity,
  isToday,
  isFuture,
}: {
  day: UcatCalendarDay;
  activity: DayActivity | undefined;
  intensity: 0 | 1 | 2 | 3 | 4;
  isToday: boolean;
  isFuture: boolean;
}) {
  const [open, setOpen] = useState(false);
  const questionAttempts = activity?.questionAttempts ?? 0;
  const setAttempts = activity?.setAttempts ?? 0;
  const label = formatUcatCalendarDate(day.dateKey, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const aria = isFuture
    ? `${label} (upcoming)`
    : `${label}: ${questionAttempts} question attempts, ${setAttempts} set attempts`;

  const cell = (
    <span
      className={cn(
        "group relative flex h-11 w-full overflow-hidden rounded-lg text-left sm:h-12",
        UCAT_SURFACE_MOTION,
        !isFuture && "hover:shadow-sm hover:ring-1 hover:ring-foreground/20",
        isToday && "ring-1 ring-primary/50",
        isFuture && "opacity-45",
      )}
    >
      <span
        className={cn(
          "absolute inset-0",
          isFuture
            ? "bg-[hsl(var(--foreground)_/_0.08)] dark:bg-[hsl(var(--foreground)_/_0.14)]"
            : ACTIVITY_INTENSITY_CLASS[intensity],
        )}
        aria-hidden
      />
    </span>
  );

  if (isFuture) {
    return (
      <div aria-label={aria} className="w-full">
        {cell}
      </div>
    );
  }

  return (
    <Tooltip open={open} onOpenChange={setOpen}>
      <TooltipTrigger asChild>
        <button
          type="button"
          className={cn(
            "w-full rounded-lg",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          )}
          aria-label={aria}
          onClick={() => setOpen(true)}
        >
          {cell}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs text-left">
        <p className="font-medium">{label}</p>
        <p className="text-muted-foreground text-xs">
          {questionAttempts} question attempt
          {questionAttempts === 1 ? "" : "s"}
        </p>
        <p className="text-muted-foreground text-xs">
          {setAttempts} set attempt{setAttempts === 1 ? "" : "s"}
        </p>
      </TooltipContent>
    </Tooltip>
  );
}

export function ReviewActivityCalendarCard({
  className,
  showViewAllProgressLink = false,
  previewData,
}: ReviewActivityCalendarCardProps) {
  const activityQuery = useUcatActivity(previewData == null);
  const data = previewData ?? activityQuery.data;
  const todayKey = localDateKey(new Date());
  const streak = useMemo(
    () =>
      buildPracticeStreak(
        data?.days ?? [],
        data?.timezone ?? "Australia/Adelaide",
      ),
    [data?.days, data?.timezone],
  );

  const activityByDate = useMemo(() => {
    const map = new Map<string, DayActivity>();
    for (const day of data?.days ?? []) {
      map.set(day.dateKey, {
        questionAttempts: day.questionAttempts,
        setAttempts: day.setAttempts,
      });
    }
    return map;
  }, [data?.days]);

  const monthMaxByKey = useMemo(() => {
    const maxima = new Map<string, number>();
    for (const [dateKey, activity] of activityByDate) {
      const total = activity.questionAttempts + activity.setAttempts;
      if (total <= 0) continue;
      const monthKey = dateKey.slice(0, 7);
      maxima.set(monthKey, Math.max(maxima.get(monthKey) ?? 0, total));
    }
    return maxima;
  }, [activityByDate]);

  const placeholderMonthMax = useMemo(() => {
    let max = 0;
    for (let dayNumber = 1; dayNumber <= 31; dayNumber += 1) {
      const activity = placeholderActivity(dayNumber);
      if (!activity) continue;
      max = Math.max(max, activity.questionAttempts + activity.setAttempts);
    }
    return max;
  }, []);

  const startDateKey = useMemo(() => {
    const keys = [
      ...(data?.days ?? []).map((day) => day.dateKey),
      data?.startedAt ? localDateKey(new Date(data.startedAt)) : null,
    ].filter((key): key is string => Boolean(key));
    keys.sort();
    return keys[0] ?? todayKey;
  }, [data?.days, data?.startedAt, todayKey]);

  const months = useMemo(
    () => buildUcatCalendarMonths(startDateKey, todayKey),
    [startDateKey, todayKey],
  );

  function intensityForDay(
    day: UcatCalendarDay,
    activity: DayActivity | undefined,
    isFuture: boolean,
    usePlaceholder: boolean,
  ): ActivityIntensityLevel {
    if (isFuture) return 0;
    const total =
      (activity?.questionAttempts ?? 0) + (activity?.setAttempts ?? 0);
    const monthMax = usePlaceholder
      ? placeholderMonthMax
      : (monthMaxByKey.get(day.dateKey.slice(0, 7)) ?? 0);
    return relativeActivityIntensityLevel(total, monthMax);
  }

  if (previewData == null && activityQuery.isLoading) {
    return <Skeleton className={cn("h-[280px] rounded-lg", className)} />;
  }

  if ((previewData == null && activityQuery.error) || !data) {
    return null;
  }

  const isEmpty = !data.startedAt && data.days.length === 0;

  return (
    <TooltipProvider delayDuration={200}>
      <div className={cn("relative", className)}>
        <div
          className={cn(
            "flex h-full flex-col",
            isEmpty && "pointer-events-none opacity-45 blur-[1px]",
          )}
          aria-hidden={isEmpty || undefined}
        >
          <div className="border-b border-border/60 px-4 pb-4 pt-4">
            <PracticeStreakWeek streak={streak} compact />
          </div>
          <UcatMonthCalendar
            className="min-h-0 flex-1"
            months={months}
            initialMonthKey={todayKey.slice(0, 7)}
            ariaLabel="Review activity calendar"
            title="Review activity"
            headerAction={
              showViewAllProgressLink ? (
                <Link
                  href="/progress"
                  className={cn(
                    "group -m-1 shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/25 focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:focus-visible:ring-white/35",
                    UCAT_SURFACE_MOTION,
                    UCAT_PRESSABLE_LIFT_HOVER,
                  )}
                  aria-label="View all progress"
                >
                  <UcatHoverChevron className="h-5 w-5" />
                </Link>
              ) : null
            }
            legend={<UcatActivityIntensityLegend />}
            renderDay={(day) => {
              const activity = isEmpty
                ? placeholderActivity(day.dayNumber)
                : activityByDate.get(day.dateKey);
              const isFuture = day.dateKey > todayKey;
              return (
                <ReviewDayCell
                  day={day}
                  activity={activity}
                  intensity={intensityForDay(day, activity, isFuture, isEmpty)}
                  isToday={day.dateKey === todayKey}
                  isFuture={isFuture}
                />
              );
            }}
          />
        </div>
        {isEmpty ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-5 flex justify-center px-4">
            <p className="rounded-full border border-border/70 bg-background/85 px-3 py-1.5 text-xs font-medium shadow-sm backdrop-blur">
              Practice activity will appear here
            </p>
          </div>
        ) : null}
      </div>
    </TooltipProvider>
  );
}
