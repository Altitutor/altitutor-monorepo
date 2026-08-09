"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  Badge,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@altitutor/ui";
import { Info, Target } from "lucide-react";
import { StudyPlanTaskList } from "@/features/study-plan/components/study-plan-task-list";
import { StudyPlanExtraStudy } from "@/features/study-plan/components/study-plan-extra-study";
import {
  buildStudyPlanCalendarMonths,
  formatStudyPlanDate,
  studyPlanCalendarIntensityLevel,
  studyPlanPracticeMinutes,
} from "@/features/study-plan/lib/calendar";
import {
  isCarryOverStudyPlanTask,
  selectCurrentStudyPlanTasks,
} from "@/features/study-plan/lib/companion";
import type {
  StudyPlanResponse,
  StudyPlanTask,
} from "@/features/study-plan/model/types";
import {
  UcatActivityIntensityLegend,
  UcatMonthCalendar,
  type UcatMonthCalendarDayContext,
} from "@/shared/components/ucat-month-calendar";
import {
  ACTIVITY_INTENSITY_CLASS,
  type UcatCalendarDay,
  type UcatCalendarMonth,
} from "@/shared/lib/ucat-month-calendar";
import { UCAT_SURFACE_MOTION } from "@/lib/ucat-surface-motion";
import { cn } from "@/lib/utils";

type StudyPlanCalendarProps = {
  plan: StudyPlanResponse;
  summaryCards: ReactNode;
  previewMode?: boolean;
};

function taskMinutes(tasks: StudyPlanTask[]) {
  return tasks.reduce((sum, task) => sum + task.estimatedMinutes, 0);
}

function maxPracticeMinutesInMonths(
  months: UcatCalendarMonth[],
  visibleMonthKeys: readonly string[],
  practiceMinutesByDate: Map<string, number>,
): number {
  const visible = new Set(visibleMonthKeys);
  let max = 0;
  for (const month of months) {
    if (!visible.has(month.key)) continue;
    for (const day of month.days) {
      if (!day) continue;
      max = Math.max(max, practiceMinutesByDate.get(day.dateKey) ?? 0);
    }
  }
  return max;
}

function dayAriaLabel({
  dateKey,
  isTestDate,
  isToday,
  practiceMinutes,
  tasks,
}: {
  dateKey: string;
  isTestDate: boolean;
  isToday: boolean;
  practiceMinutes: number;
  tasks: StudyPlanTask[];
}) {
  const details = [
    formatStudyPlanDate(dateKey, {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }),
  ];
  if (isToday) details.push("today");
  if (isTestDate) details.push("UCAT test date");
  if (tasks.length) {
    details.push(
      `${tasks.length} planned task${tasks.length === 1 ? "" : "s"}, ${practiceMinutes} minutes of practice`,
    );
  } else {
    details.push("no planned tasks");
  }
  return details.join(", ");
}

export function StudyPlanCalendar({
  plan,
  summaryCards,
  previewMode = false,
}: StudyPlanCalendarProps) {
  const tasksByDate = useMemo(() => {
    const grouped = new Map<string, StudyPlanTask[]>();
    for (const task of plan.tasks) {
      grouped.set(task.scheduledDate, [
        ...(grouped.get(task.scheduledDate) ?? []),
        task,
      ]);
    }
    return grouped;
  }, [plan.tasks]);

  const practiceMinutesByDate = useMemo(() => {
    const map = new Map<string, number>();
    for (const [dateKey, tasks] of tasksByDate) {
      map.set(dateKey, studyPlanPracticeMinutes(tasks));
    }
    return map;
  }, [tasksByDate]);

  const months = useMemo(() => {
    const dateKeys = [
      plan.today,
      plan.generation?.startsOn,
      plan.generation?.endsOn,
      plan.profile?.testDate,
      ...plan.tasks.map((task) => task.scheduledDate),
    ].filter((dateKey): dateKey is string => Boolean(dateKey));
    dateKeys.sort();
    return buildStudyPlanCalendarMonths(
      dateKeys[0] ?? plan.today,
      dateKeys.at(-1) ?? plan.today,
    );
  }, [
    plan.generation?.endsOn,
    plan.generation?.startsOn,
    plan.profile?.testDate,
    plan.tasks,
    plan.today,
  ]);

  const [selectedDate, setSelectedDate] = useState(plan.today);
  const carryOverTasks = plan.tasks.filter((task) =>
    isCarryOverStudyPlanTask(task, plan.today),
  );
  const selectedTasks =
    selectedDate === plan.today
      ? selectCurrentStudyPlanTasks(plan.tasks, plan.today)
      : (tasksByDate.get(selectedDate) ?? []);
  const showExtraStudy =
    selectedDate === plan.today &&
    (plan.todayTasks.length === 0 ||
      plan.todayTasks.every((task) => task.status === "completed"));
  const mayAdapt = Boolean(
    plan.profile?.nextWeeklyReplanOn &&
      selectedDate >= plan.profile.nextWeeklyReplanOn,
  );

  function renderDay(
    day: UcatCalendarDay,
    context: UcatMonthCalendarDayContext,
  ) {
    const tasks = tasksByDate.get(day.dateKey) ?? [];
    const practiceMinutes = practiceMinutesByDate.get(day.dateKey) ?? 0;
    const visibleMax = maxPracticeMinutesInMonths(
      months,
      context.visibleMonthKeys,
      practiceMinutesByDate,
    );
    const intensity = studyPlanCalendarIntensityLevel(
      practiceMinutes,
      visibleMax,
    );
    const isSelected = selectedDate === day.dateKey;
    const isToday = plan.today === day.dateKey;
    const isTestDate = plan.profile?.testDate === day.dateKey;
    const usesLightText = intensity >= 3;

    return (
      <button
        type="button"
        data-study-plan-date={day.dateKey}
        aria-pressed={isSelected}
        aria-label={dayAriaLabel({
          dateKey: day.dateKey,
          isTestDate,
          isToday,
          practiceMinutes,
          tasks,
        })}
        onClick={() => setSelectedDate(day.dateKey)}
        className={cn(
          "group relative flex size-full items-center justify-center overflow-hidden rounded-[22%] text-left",
          UCAT_SURFACE_MOTION,
          "hover:shadow-sm hover:ring-1 hover:ring-foreground/20",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          isSelected &&
            "ring-2 ring-foreground ring-offset-1 ring-offset-background",
          isToday && !isSelected && "ring-1 ring-primary/50",
          usesLightText ? "text-primary-foreground" : "text-foreground",
        )}
      >
        <span
          className={cn(
            "absolute inset-0",
            ACTIVITY_INTENSITY_CLASS[intensity],
          )}
          aria-hidden
        />
        <span className="relative z-[1] flex size-full flex-col p-1">
          <span className="flex items-start justify-between gap-0.5">
            <span className="text-[10px] font-semibold tabular-nums leading-none sm:text-[11px]">
              {day.dayNumber}
            </span>
            {isTestDate ? (
              <span className="rounded-full bg-background/80 p-0.5 text-foreground shadow-sm">
                <Target className="h-2.5 w-2.5" aria-hidden />
              </span>
            ) : null}
          </span>
        </span>
      </button>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid items-stretch gap-4 lg:grid-cols-[minmax(0,1fr)_20rem] xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div id="tour-study-plan-calendar" className="h-full">
          <UcatMonthCalendar
            className="h-full"
            months={months}
            initialMonthKey={plan.today.slice(0, 7)}
            monthsVisible={2}
            density="compact"
            ariaLabel="Study plan calendar"
            title="Study plan"
            legend={
              <>
                <UcatActivityIntensityLegend />
                {plan.profile?.testDate ? (
                  <span className="flex items-center gap-1">
                    <Target className="h-3 w-3" aria-hidden /> Test date
                  </span>
                ) : null}
              </>
            }
            renderDay={renderDay}
          />
        </div>

        {summaryCards}
      </div>

      <section
        id="tour-study-plan-tasks"
        key={selectedDate}
        aria-live="polite"
        className="space-y-4"
      >
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">Selected day</p>
            <div className="mt-0.5 flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-semibold">
                {formatStudyPlanDate(selectedDate, {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                })}
              </h2>
              {mayAdapt ? (
                <TooltipProvider delayDuration={200}>
                  <Tooltip>
                    <Badge variant="secondary" className="gap-1 pr-1.5">
                      May adapt
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          className="inline-flex size-5 items-center justify-center rounded-full text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/25"
                          aria-label="Why these tasks may adapt"
                        >
                          <Info className="h-3.5 w-3.5" aria-hidden />
                        </button>
                      </TooltipTrigger>
                    </Badge>
                    <TooltipContent
                      side="top"
                      className="max-w-[280px] text-sm"
                    >
                      These tasks are beyond your current fixed planning window.
                      They may change at the next weekly replan as your progress
                      is taken into account.
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ) : null}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {selectedDate === plan.today ? <Badge>Today</Badge> : null}
            {selectedDate === plan.profile?.testDate ? (
              <Badge variant="outline">Test day</Badge>
            ) : null}
            {selectedTasks.length ? (
              <span className="text-sm text-muted-foreground">
                {taskMinutes(selectedTasks)} min planned
              </span>
            ) : null}
          </div>
        </div>

        {selectedTasks.length ? (
          <div className="space-y-3">
            {selectedDate === plan.today && carryOverTasks.length ? (
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.06] px-4 py-3">
                <p className="text-sm font-medium">Still to do</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {carryOverTasks.length === 1
                    ? "One task from an earlier study day is waiting. Finish it or skip it, then your plan will move on."
                    : `${carryOverTasks.length} tasks from earlier study days are waiting. Finish or skip them, then your plan will move on.`}
                </p>
              </div>
            ) : null}
            <StudyPlanTaskList
              tasks={selectedTasks}
              today={plan.today}
              afterTasks={
                showExtraStudy ? (
                  <StudyPlanExtraStudy plan={plan} interactive={!previewMode} />
                ) : null
              }
              previewMode={previewMode}
            />
          </div>
        ) : showExtraStudy ? (
          <StudyPlanTaskList
            tasks={[]}
            today={plan.today}
            afterTasks={
              <StudyPlanExtraStudy plan={plan} interactive={!previewMode} />
            }
            previewMode={previewMode}
          />
        ) : (
          <div className="rounded-2xl border border-dashed border-border/70 bg-muted/20 px-6 py-10 text-center">
            <p className="font-medium">No Study plan tasks</p>
            <p className="mt-1 text-sm text-muted-foreground">
              This day is clear. Choose another date to see its planned work.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
