import assert from 'node:assert/strict';
import { test } from 'node:test';

import { notificationFromPush, sessionFromInboxAction } from './notification-routing';

const id = 'a7ad5b8d-dde3-4809-90bc-14c0fd12360e';

test('a Tutor push opens only a well-formed inbox item', () => {
  assert.equal(notificationFromPush({ destination: 'inbox', notificationId: id }), id);
  assert.equal(notificationFromPush({ destination: 'classes', notificationId: id }), null);
  assert.equal(notificationFromPush({ destination: 'inbox', notificationId: '/settings' }), null);
});

test('maps an internal session action and rejects foreign or unrelated paths', () => {
  assert.equal(sessionFromInboxAction('/classes?session=' + id), id);
  assert.equal(sessionFromInboxAction('//example.org/classes?session=' + id), null);
  assert.equal(sessionFromInboxAction('/ucat/questions/' + id), null);
});
