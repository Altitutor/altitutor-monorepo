export interface ClassDayFilterSource {
  day_of_week?: number | null;
  schedule_weekdays?: number[] | null;
}

export function classWeekdays(cls: ClassDayFilterSource): number[] {
  if (cls.schedule_weekdays && cls.schedule_weekdays.length > 0) {
    return cls.schedule_weekdays;
  }
  if (cls.day_of_week == null) {
    return [];
  }
  return [cls.day_of_week];
}

export function classMatchesSelectedDays(
  cls: ClassDayFilterSource,
  selectedDays: number[]
): boolean {
  if (selectedDays.length === 0) return true;
  return classWeekdays(cls).some((day) => selectedDays.includes(day));
}
