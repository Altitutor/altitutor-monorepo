import assert from 'node:assert/strict';
import test from 'node:test';

import { adelaideDateKey } from '@/features/dashboard/timetable';

import {
  addAdelaideDays,
  adelaideWeek,
  layoutDayEvents,
  sessionIsCancelled,
  visibleCalendarDays,
} from './calendar-model';

test('a cancelled session is one the student will miss or missed', () => {
  assert.equal(sessionIsCancelled({ planned_absence: true, tutor_log_marked_absent: null }), true);
  assert.equal(sessionIsCancelled({ planned_absence: false, tutor_log_marked_absent: true }), true);
  assert.equal(sessionIsCancelled({ planned_absence: false, tutor_log_marked_absent: false }), false);
  assert.equal(sessionIsCancelled({ planned_absence: null, tutor_log_marked_absent: null }), false);
});

test('weeks start on Monday and day spans stay in Adelaide dates', () => {
  const monday = new Date('2026-09-27T14:30:00.000Z');
  assert.equal(adelaideDateKey(monday), '2026-09-28');
  assert.deepEqual(adelaideWeek(monday).map(adelaideDateKey), [
    '2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04',
  ]);
  assert.equal(adelaideDateKey(addAdelaideDays(monday, 1)), '2026-09-29');
  assert.deepEqual(visibleCalendarDays(addAdelaideDays(monday, 2), 3).map(adelaideDateKey), [
    '2026-09-30', '2026-10-01', '2026-10-02',
  ]);
});

test('overlapping sessions share the hour side by side', () => {
  const placed = layoutDayEvents([
    { id: 'a', startMin: 600, endMin: 660 },
    { id: 'b', startMin: 630, endMin: 690 },
    { id: 'c', startMin: 720, endMin: 780 },
  ]);
  const byId = new Map(placed.map((item) => [item.id, item]));
  assert.equal(byId.get('a')?.columns, 2);
  assert.equal(byId.get('b')?.columns, 2);
  assert.notEqual(byId.get('a')?.column, byId.get('b')?.column);
  assert.equal(byId.get('c')?.columns, 1);
});
