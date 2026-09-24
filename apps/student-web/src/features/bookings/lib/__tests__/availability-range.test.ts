import {
  MAX_AVAILABILITY_RANGE_DAYS,
  availabilityRangeDays,
  isValidAvailabilityDateRange,
  splitDateRangeIntoWindows,
} from '../availability-range';

describe('availability date ranges', () => {
  it('accepts a 31-day span as a single request', () => {
    expect(availabilityRangeDays('2026-09-08', '2026-10-09')).toBe(31);
    expect(isValidAvailabilityDateRange('2026-09-08', '2026-10-09')).toBe(true);
  });

  it('rejects the 12-week trial picker lookahead as a single request', () => {
    expect(availabilityRangeDays('2026-09-08', '2026-12-01')).toBe(84);
    expect(isValidAvailabilityDateRange('2026-09-08', '2026-12-01')).toBe(false);
  });

  it('splits an 84-day lookahead into adjacent windows of at most 31 days', () => {
    const windows = splitDateRangeIntoWindows('2026-09-08', '2026-12-01');

    expect(windows).toEqual([
      { start_date: '2026-09-08', end_date: '2026-10-09' },
      { start_date: '2026-10-10', end_date: '2026-11-10' },
      { start_date: '2026-11-11', end_date: '2026-12-01' },
    ]);
    expect(
      windows.every(
        (window) =>
          availabilityRangeDays(window.start_date, window.end_date) <=
          MAX_AVAILABILITY_RANGE_DAYS,
      ),
    ).toBe(true);
  });
});
