import type { AdminShiftScheduleProposal, StoredAdminShiftSchedule } from '../types/schedule';

const ADELAIDE_TIME_ZONE = 'Australia/Adelaide';

export function adelaideCalendarDate(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: ADELAIDE_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

export function clockTime(value: string): string {
  return value.slice(0, 5);
}

export function partitionAdminShiftScheduleTimeline(
  timeline: StoredAdminShiftSchedule[] | undefined,
  date: string
): {
  current: StoredAdminShiftSchedule | undefined;
  upcoming: StoredAdminShiftSchedule[];
} {
  return {
    current: timeline?.find((revision) =>
      revision.effectiveFrom <= date && revision.effectiveTo >= date
    ),
    upcoming: timeline?.filter((revision) => revision.effectiveFrom > date) ?? [],
  };
}

export function resolveAdminShiftBounds(
  shift: {
    session_start_date: string | null;
    session_end_date: string | null;
    created_at: string;
  },
  today = adelaideCalendarDate()
): { startDate: string; endDate: string } {
  const createdDate = adelaideCalendarDate(new Date(shift.created_at));
  const startDate = shift.session_start_date ?? createdDate;
  const endYear = (shift.session_start_date ?? createdDate).slice(0, 4);
  const endDate = shift.session_end_date ?? `${endYear}-12-31`;
  return {
    startDate: startDate > endDate ? today : startDate,
    endDate,
  };
}

/**
 * A stored revision that has not started can be edited in place.
 * Otherwise the next change begins today, or on the shift start when that is later.
 */
export function resolveAdminShiftEffectiveFrom(
  startDate: string,
  latestEffectiveFrom: string | undefined,
  today = adelaideCalendarDate()
): string {
  if (latestEffectiveFrom && latestEffectiveFrom >= today) return latestEffectiveFrom;
  return startDate > today ? startDate : today;
}

export function validateAdminShiftSchedule(input: {
  startTime: string;
  endTime: string;
  startDate: string;
  endDate: string;
  effectiveFrom: string;
  today?: string;
}): string | null {
  const today = input.today ?? adelaideCalendarDate();
  if (!input.startTime || !input.endTime || input.endTime <= input.startTime) {
    return 'Duration must finish after the start time.';
  }
  if (!input.startDate || !input.endDate || input.endDate < input.startDate) {
    return 'The shift end date must be on or after its start date.';
  }
  if (input.effectiveFrom < today || input.effectiveFrom < input.startDate || input.effectiveFrom > input.endDate) {
    return 'The effective date must be today or later and inside the shift dates.';
  }
  return null;
}

export function buildAdminShiftScheduleProposal(input: {
  adminShiftId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  status: 'ACTIVE' | 'INACTIVE';
  startDate: string;
  endDate: string;
  effectiveFrom: string;
}): AdminShiftScheduleProposal {
  return {
    admin_shift_id: input.adminShiftId,
    day_of_week: input.dayOfWeek,
    start_time: clockTime(input.startTime),
    end_time: clockTime(input.endTime),
    status: input.status,
    start_date: input.startDate,
    end_date: input.endDate,
    effective_from: input.effectiveFrom,
    timezone: 'Australia/Adelaide',
  };
}
