import assert from 'node:assert/strict';
import test from 'node:test';

import { adelaideDateKey, selectTimetableSessions, startOfAdelaideDay } from '../features/dashboard/timetable';
import { sessionDisplayTitle, sessionTypeLabel } from '../features/sessions/session-display';

test('Adelaide day starts at local midnight, including daylight saving', () => {
  assert.equal(startOfAdelaideDay(new Date('2026-09-28T02:00:00.000Z')).toISOString(), '2026-09-27T14:30:00.000Z');
  assert.equal(adelaideDateKey(new Date('2026-09-27T14:30:00.000Z')), '2026-09-28');
  assert.equal(adelaideDateKey(new Date('2026-09-27T14:29:00.000Z')), '2026-09-27');
  assert.equal(startOfAdelaideDay(new Date('2026-01-15T02:00:00.000Z')).toISOString(), '2026-01-14T13:30:00.000Z');
});

test('timetable prefers every session today, otherwise the next one', () => {
  const now = new Date('2026-09-28T01:00:00.000Z');
  const earlierToday = { id: 'earlier', start_at: '2026-09-27T23:00:00.000Z' };
  const laterToday = { id: 'later', start_at: '2026-09-28T06:00:00.000Z' };
  const tomorrow = { id: 'tomorrow', start_at: '2026-09-28T23:30:00.000Z' };

  assert.deepEqual(
    selectTimetableSessions([earlierToday, laterToday, tomorrow], now).sessions.map((session) => session.id),
    ['earlier', 'later'],
  );
  assert.equal(selectTimetableSessions([tomorrow], now).heading, 'Next session');
  assert.deepEqual(selectTimetableSessions([tomorrow], now).sessions, [tomorrow]);
  assert.deepEqual(selectTimetableSessions([], now).sessions, []);
});

test('homework help replaces the tutoring session title', () => {
  assert.equal(sessionDisplayTitle({ session_type: 'HOMEWORK_HELP', subject_name: 'Maths' }), 'Homework help');
  assert.equal(sessionDisplayTitle({ subject_year_level: 10, subject_name: 'Maths' }), 'Year 10 Maths');
  assert.equal(sessionTypeLabel('HOMEWORK_HELP'), 'Homework help');
});
