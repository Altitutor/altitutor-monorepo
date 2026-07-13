import { isWithinMinAdvanceThreshold } from '../public-booking-threshold';

describe('isWithinMinAdvanceThreshold', () => {
  it('blocks sessions before the min advance date in Adelaide', () => {
    // Wednesday 2026-07-15 00:00 Adelaide = Tuesday evening UTC
    const now = new Date('2026-07-14T14:30:00.000Z');
    // Session on Wednesday Adelaide (same day as "today") with minAdvanceDays=1 → blocked
    const sameDaySession = '2026-07-14T23:30:00.000Z'; // Wed 09:00 Adelaide
    expect(isWithinMinAdvanceThreshold(sameDaySession, 1, now)).toBe(true);

    // Session on Thursday Adelaide with minAdvanceDays=1 → allowed
    const nextDaySession = '2026-07-15T23:30:00.000Z'; // Thu 09:00 Adelaide
    expect(isWithinMinAdvanceThreshold(nextDaySession, 1, now)).toBe(false);
  });

  it('allows zero min advance for same-day sessions', () => {
    const now = new Date('2026-07-14T14:30:00.000Z');
    const sameDaySession = '2026-07-14T23:30:00.000Z';
    expect(isWithinMinAdvanceThreshold(sameDaySession, 0, now)).toBe(false);
  });
});
