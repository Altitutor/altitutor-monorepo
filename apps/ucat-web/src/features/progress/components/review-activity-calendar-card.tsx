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
import { motion, useReducedMotion } from "motion/react";
import { Flame } from "lucide-react";
import { UcatHoverChevron } from "@/lib/ucat-hover-chevron";
import {
  UCAT_PRESSABLE_LIFT_HOVER,
  UCAT_SURFACE_MOTION,
} from "@/lib/ucat-surface-motion";
import { cn } from "@/lib/utils";
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

const EASE_OUT = [0.32, 0.72, 0, 1] as const;

function ReviewDayCell({
  day,
  activity,
  intensity,
  isToday,
  isFuture,
  inStreak,
}: {
  day: UcatCalendarDay;
  activity: DayActivity | undefined;
  intensity: 0 | 1 | 2 | 3 | 4;
  isToday: boolean;
  isFuture: boolean;
  inStreak: boolean;
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
    : `${label}: ${questionAttempts} question attempts, ${setAttempts} set attempts${
        inStreak ? ", part of current streak" : ""
      }`;

  const cell = (
    <span
      className={cn(
        "group relative flex size-full items-center justify-center overflow-hidden rounded-[22%] text-left",
        UCAT_SURFACE_MOTION,
        !isFuture && "hover:shadow-sm hover:ring-1 hover:ring-foreground/20",
        isToday && !inStreak && "ring-1 ring-primary/50",
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
      {inStreak ? (
        <Flame
          className="relative z-[1] size-[45%] max-h-3.5 max-w-3.5 fill-amber-400 text-amber-500 drop-shadow-sm"
          aria-hidden
        />
      ) : null}
    </span>
  );

  if (isFuture) {
    return (
      <div aria-label={aria} className="size-full">
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
            "size-full rounded-[22%]",
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
        {inStreak ? (
          <p className="text-xs text-amber-700 dark:text-amber-300">
            Current streak
          </p>
        ) : null}
      </TooltipContent>
    </Tooltip>
  );
}

function CompactStreakBadge({
  current,
  practicedToday,
}: {
  current: number;
  practicedToday: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const hint =
    current === 0
      ? "Answer 1 question to begin"
      : practicedToday
        ? "Extended today"
        : "Answer 1 question today";

  return (
    <motion.div
      className="flex shrink-0 items-center gap-1.5 rounded-full border border-amber-400/40 bg-amber-400/10 px-2.5 py-1"
      title={hint}
      initial={reduceMotion ? false : { opacity: 0, scale: 0.86, y: -4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 340, damping: 24, delay: 0.08 }}
    >
      <motion.span
        className="inline-flex"
        animate={
          reduceMotion || current === 0
            ? undefined
            : {
                scale: [1, 1.12, 1],
              }
        }
        transition={
          reduceMotion || current === 0
            ? undefined
            : {
                duration: 1.8,
                repeat: Infinity,
                repeatDelay: 2.4,
                ease: EASE_OUT,
              }
        }
      >
        <Flame
          className="h-3.5 w-3.5 fill-amber-400 text-amber-500"
          aria-hidden
        />
      </motion.span>
      <span className="text-xs font-semibold tabular-nums tracking-tight">
        {current} day{current === 1 ? "" : "s"}
      </span>
      <span className="sr-only">{hint}</span>
    </motion.div>
  );
}

export function ReviewActivityCalendarCard({
  className,
  showViewAllProgressLink = false,
  previewData,
}: ReviewActivityCalendarCardProps) {
  const reduceMotion = useReducedMotion();
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
  const streakDateKeySet = useMemo(
    () => new Set(streak.streakDateKeys),
    [streak.streakDateKeys],
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
  ): ActivityIntensityLevel {
    if (isFuture) return 0;
    const total =
      (activity?.questionAttempts ?? 0) + (activity?.setAttempts ?? 0);
    const monthMax = monthMaxByKey.get(day.dateKey.slice(0, 7)) ?? 0;
    return relativeActivityIntensityLevel(total, monthMax);
  }

  if (previewData == null && activityQuery.isLoading) {
    return <Skeleton className={cn("h-[320px] rounded-lg", className)} />;
  }

  if ((previewData == null && activityQuery.error) || !data) {
    return null;
  }

  return (
    <TooltipProvider delayDuration={200}>
      <motion.div
        className={cn("relative", className)}
        initial={reduceMotion ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: EASE_OUT }}
      >
        <UcatMonthCalendar
          className="h-full"
          months={months}
          initialMonthKey={todayKey.slice(0, 7)}
          monthsVisible={2}
          density="compact"
          ariaLabel="Review activity calendar"
          title="Review activity"
          headerAction={
            <div className="flex items-center gap-2">
              <CompactStreakBadge
                current={streak.current}
                practicedToday={streak.practicedToday}
              />
              {showViewAllProgressLink ? (
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
              ) : null}
            </div>
          }
          legend={<UcatActivityIntensityLegend />}
          renderDay={(day) => {
            const activity = activityByDate.get(day.dateKey);
            const isFuture = day.dateKey > todayKey;
            return (
              <ReviewDayCell
                day={day}
                activity={activity}
                intensity={intensityForDay(day, activity, isFuture)}
                isToday={day.dateKey === todayKey}
                isFuture={isFuture}
                inStreak={streakDateKeySet.has(day.dateKey)}
              />
            );
          }}
        />
      </motion.div>
    </TooltipProvider>
  );
}
