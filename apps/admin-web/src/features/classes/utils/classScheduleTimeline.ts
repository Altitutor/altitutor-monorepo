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
