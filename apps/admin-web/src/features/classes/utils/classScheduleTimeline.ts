import type { StoredClassSchedule } from '../types/schedule';

export function partitionClassScheduleTimeline(
  timeline: StoredClassSchedule[] | undefined,
  date: string
): {
  current: StoredClassSchedule | undefined;
  upcoming: StoredClassSchedule[];
} {
  return {
    current: timeline?.find((revision) =>
      revision.effectiveFrom <= date && revision.effectiveTo >= date
    ),
    upcoming: timeline?.filter((revision) => revision.effectiveFrom > date) ?? [],
  };
}

/**
 * Keep every revision that is still in force. When the class has finished,
 * keep its latest timetable so it can be viewed and extended.
 */
export function retainSchedulesForEditing<T extends { effectiveFrom: string; effectiveTo: string }>(
  revisions: T[],
  today: string
): T[] {
  const inForce = revisions.filter((revision) => revision.effectiveTo >= today);
  if (inForce.length > 0) return inForce;

  const latestEnded = revisions
    .filter((revision) => revision.effectiveTo < today)
    .sort((left, right) =>
      right.effectiveTo.localeCompare(left.effectiveTo)
      || right.effectiveFrom.localeCompare(left.effectiveFrom)
    )[0];
  return latestEnded ? [latestEnded] : [];
}
