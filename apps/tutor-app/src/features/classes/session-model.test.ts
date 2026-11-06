import assert from 'node:assert/strict';
import test from 'node:test';

import { adelaideDayRange, mayLogSession } from './session-model';

test('tutor dashboard uses the Adelaide day across the end of daylight saving', () => {
  const day = adelaideDayRange(new Date('2026-04-05T04:00:00Z'));

  assert.deepEqual(day, {
    from: '2026-04-04T13:30:00.000Z',
    to: '2026-04-05T14:30:00.000Z',
  });
});

test('only a conducting tutor can log an active, started Check-in with no retained log', () => {
  const session = {
    start_at: '2026-11-06T00:00:00Z',
    session_type: 'CHECK_IN',
    session_status: 'ACTIVE',
    calendar_tombstone_until: null,
  };
  const now = new Date('2026-11-06T00:00:00Z');

  assert.equal(mayLogSession(session, 'CHECK_IN_HOST', null, now), true);
  assert.equal(mayLogSession(session, 'MAIN_TUTOR', null, now), false);
  assert.equal(mayLogSession(session, 'CHECK_IN_RECEIVER', null, now), false);
  assert.equal(mayLogSession(session, 'CHECK_IN_HOST', { deleted_at: '2026-11-06' }, now), false);
  assert.equal(mayLogSession({ ...session, calendar_tombstone_until: '2026-11-07' }, 'CHECK_IN_HOST', null, now), false);
  assert.equal(mayLogSession({ ...session, start_at: '2026-11-06T00:01:00Z' }, 'CHECK_IN_HOST', null, now), false);
});
