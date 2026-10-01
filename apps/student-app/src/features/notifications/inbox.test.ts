import assert from 'node:assert/strict';
import test from 'node:test';

import { applyNotificationPatch, swipePastDismissThreshold } from './inbox';
import type { StudentNotification } from '@/lib/student-api';

const note = (id: string, read = false): StudentNotification => ({
  id,
  title: id,
  body: null,
  created_at: '2026-01-01T00:00:00.000Z',
  read_at: read ? '2026-01-02T00:00:00.000Z' : null,
  action_url: null,
});

test('a full swipe clears and a short swipe does not', () => {
  assert.equal(swipePastDismissThreshold(-40, 100), false);
  assert.equal(swipePastDismissThreshold(-56, 100), true);
});

test('inbox patches mark read, unread, and clear one notification', () => {
  const notes = [note('a'), note('b', true)];
  assert.equal(applyNotificationPatch(notes, { notificationIds: ['a'] }, 'now')[0]?.read_at, 'now');
  assert.equal(applyNotificationPatch(notes, { notificationIds: ['b'], markUnread: true }, 'now')[1]?.read_at, null);
  assert.deepEqual(
    applyNotificationPatch(notes, { notificationIds: ['a'], dismiss: true }, 'now').map((item) => item.id),
    ['b'],
  );
});
