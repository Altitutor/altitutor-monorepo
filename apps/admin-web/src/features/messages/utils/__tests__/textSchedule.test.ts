import { quietHoursSendTime } from '../textSchedule';

describe('quiet-hours text scheduling in Adelaide', () => {
  it.each([
    ['2026-11-27T11:29:59Z', undefined],
    ['2026-11-27T11:30:00Z', '2026-11-27T21:30:00.000Z'],
    ['2026-11-27T21:29:59Z', '2026-11-27T21:30:00.000Z'],
    ['2026-11-27T21:30:00Z', undefined],
    ['2026-04-04T12:00:00Z', '2026-04-04T22:30:00.000Z'],
    ['2026-10-03T12:30:00Z', '2026-10-03T21:30:00.000Z'],
  ])('schedules %s for %s', (now, expected) => {
    expect(quietHoursSendTime(new Date(now))).toBe(expected);
  });
});
