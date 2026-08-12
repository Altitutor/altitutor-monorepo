import {
  buildUcatCalendarMonths,
  dateKeyToLocalDate,
  formatUcatCalendarDate,
  localDateKey,
  relativeActivityIntensityLevel,
  type ActivityIntensityLevel,
  type UcatCalendarDay,
  type UcatCalendarMonth,
} from "@/shared/lib/ucat-month-calendar";
import type { StudyPlanTask } from "@/features/study-plan/model/types";

export type StudyPlanCalendarDay = UcatCalendarDay;
export type StudyPlanCalendarMonth = UcatCalendarMonth;

export {
  dateKeyToLocalDate,
  localDateKey,
  buildUcatCalendarMonths as buildStudyPlanCalendarMonths,
};

export function formatStudyPlanDate(
  dateKey: string,
  options: Intl.DateTimeFormatOptions,
): string {
  return formatUcatCalendarDate(dateKey, options);
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function daysBetweenDateKeys(fromDateKey: string, toDateKey: string) {
  const from = dateKeyToLocalDate(fromDateKey);
  const to = dateKeyToLocalDate(toDateKey);
  if (!from || !to) return null;
  const fromUtc = Date.UTC(
    from.getFullYear(),
    from.getMonth(),
    from.getDate(),
  );
  const toUtc = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((toUtc - fromUtc) / DAY_MS);
}

export function studyPlanPlannedMinutes(tasks: StudyPlanTask[]): number {
  return tasks.reduce((sum, task) => sum + task.estimatedMinutes, 0);
}

/**
 * Maps a day's planned minutes against the busiest day in the
 * currently visible calendar window.
 */
export function studyPlanCalendarIntensityLevel(
  scheduledMinutes: number,
  visibleMaxMinutes: number,
): ActivityIntensityLevel {
  return relativeActivityIntensityLevel(
    Math.max(0, scheduledMinutes),
    Math.max(0, visibleMaxMinutes),
  );
}
