import {
  finalClassDateIsAfterEnrolment,
  firstNewClassWarnings,
  selectableLastOldClassDates,
} from '../changeClassDates';

const timezone = 'Australia/Adelaide';

it('rejects a final old-class date whose following midnight is not after the enrolment start', () => {
  expect(finalClassDateIsAfterEnrolment('2026-09-25', '2026-09-26T00:30:00+09:30', timezone)).toBe(false);
  expect(finalClassDateIsAfterEnrolment('2026-09-26', '2026-09-26T00:30:00+09:30', timezone)).toBe(true);
  expect(finalClassDateIsAfterEnrolment('2026-10-04', '2026-10-05T00:00:00+10:30', timezone)).toBe(false);
  expect(finalClassDateIsAfterEnrolment('2026-10-05', '2026-10-05T00:00:00+10:30', timezone)).toBe(true);
});

it('hides last-old dates before a later logged or attended lesson, and before the enrolment start', () => {
  const dates = selectableLastOldClassDates({
    sessions: [
      { calendarDate: '2026-09-02', logged: false, studentAttended: false },
      { calendarDate: '2026-09-09', logged: true, studentAttended: false },
      { calendarDate: '2026-09-16', logged: false, studentAttended: true },
      { calendarDate: '2026-09-23', logged: false, studentAttended: false },
      { calendarDate: '2026-09-30', logged: false, studentAttended: false },
    ],
    enrolledAt: '2026-09-01T00:00:00+09:30',
    timezone,
  });

  expect(dates).toEqual(['2026-09-16', '2026-09-23', '2026-09-30']);
});

it('warns when the first new lesson is in the past or shares a week with a kept old lesson', () => {
  const past = firstNewClassWarnings({
    firstNewDate: '2026-09-19',
    today: '2026-09-26',
    keptOldDates: ['2026-09-09'],
    newClassDates: ['2026-09-19', '2026-09-26'],
  });
  expect(past.past).toBe(true);
  expect(past.sameWeek).toBe(false);

  const overlap = firstNewClassWarnings({
    firstNewDate: '2026-09-12',
    today: '2026-09-01',
    keptOldDates: ['2026-09-09', '2026-09-16'],
    newClassDates: ['2026-09-12', '2026-09-19'],
  });
  expect(overlap.past).toBe(false);
  expect(overlap.sameWeek).toBe(true);
});
