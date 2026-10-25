import { interviewRoundFromRow, interviewRoundDurationMinutes } from '../interviewRoundEvents';

test('a scheduled round becomes a calendar event at least 30 minutes long', () => {
  expect(interviewRoundDurationMinutes(60, 60)).toBe(30);
  const event = interviewRoundFromRow({
    id: 'round-1',
    data: {
      name: 'MMI practice',
      scheduledAt: '2026-10-23T00:30:00.000Z',
      startedAt: null,
      phase: 'waiting',
      delivery: 'online',
      mode: 'exam',
      recordingEnabled: true,
      readingTimeSeconds: 120,
      questionTimeSeconds: 480,
      students: [{ id: 'student-1', name: 'Ada Lovelace' }],
      tutors: [{ id: 'tutor-1', name: 'Grace Hopper' }],
    },
  });
  expect(event).toMatchObject({
    id: 'round-1',
    name: 'MMI practice',
    delivery: 'online',
    recordingEnabled: true,
    students: [{ id: 'student-1', name: 'Ada Lovelace' }],
  });
  expect(event && Date.parse(event.endAt) - Date.parse(event.scheduledAt)).toBe(30 * 60_000);
});

test('rounds without a schedule stay off the calendar', () => {
  expect(interviewRoundFromRow({ id: 'round-2', data: { name: 'Now', scheduledAt: null } })).toBeNull();
});

test('calendar duration includes every station rotation', () => {
  const event = interviewRoundFromRow({
    id: 'six-stations',
    data: {
      scheduledAt: '2026-10-25T00:00:00Z',
      readingTimeSeconds: 120,
      questionTimeSeconds: 360,
      stations: Array.from({ length: 6 }, (_, index) => ({ id: String(index) })),
    },
  });
  expect(event && Date.parse(event.endAt) - Date.parse(event.scheduledAt)).toBe(48 * 60_000);
  expect(interviewRoundDurationMinutes(120, 360, 6)).toBe(48);
});
