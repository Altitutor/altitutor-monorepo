import {
  activityIntensityLevel,
  buildUcatCalendarMonths,
  dateKeyToLocalDate,
  formatUcatCalendarDate,
  localDateKey,
  type UcatCalendarDay,
  type UcatCalendarMonth,
} from "@/shared/lib/ucat-month-calendar";

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

export function studyPlanCalendarIntensityLevel(
  scheduledMinutes: number,
  recordedActivity: number,
): 0 | 1 | 2 | 3 | 4 {
  const scheduledUnits = Math.ceil(Math.max(0, scheduledMinutes) / 15);
  return activityIntensityLevel(
    Math.max(scheduledUnits, Math.max(0, recordedActivity)),
  );
}
