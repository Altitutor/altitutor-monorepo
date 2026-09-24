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

export const ORDINARY_STUDY_DAY_MINUTES = 60;

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

type StudyPlanDayTask = Pick<
  StudyPlanTask,
  "estimatedMinutes" | "launchConfig"
> &
  Partial<Pick<StudyPlanTask, "status">>;

export function studyPlanActiveMinutes(tasks: StudyPlanDayTask[]): number {
  return tasks.reduce(
    (sum, task) =>
      task.status === "skipped" ? sum : sum + task.estimatedMinutes,
    0,
  );
}

export function exceedsOrdinaryStudyDayMinutes(
  tasks: StudyPlanDayTask[],
): boolean {
  return studyPlanActiveMinutes(tasks) > ORDINARY_STUDY_DAY_MINUTES;
}

export function isIntensiveStudyPlanDay(tasks: StudyPlanDayTask[]): boolean {
  const hasPreparationPressure = tasks.some(
    (task) =>
      task.launchConfig.intensiveStudyDay === true ||
      (typeof task.launchConfig.preparationWarning === "string" &&
        task.launchConfig.preparationWarning.trim().length > 0),
  );

  return hasPreparationPressure && exceedsOrdinaryStudyDayMinutes(tasks);
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
