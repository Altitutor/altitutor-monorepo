import assert from "node:assert/strict";
import test from "node:test";
import {
  applyInboxCommand,
  inboxRequestBody,
  swipePastDismissThreshold,
} from "../features/notifications/inbox";
import type { UcatNotification, UcatNotificationInbox } from "../features/notifications/types";

const readAt = "2026-09-21T12:00:00.000Z";

function note(
  changes: Partial<UcatNotification> & Pick<UcatNotification, "id">,
): UcatNotification {
  return {
    notification_type: "update",
    title: "Notice",
    body: "Details",
    read_at: null,
    dismissed_at: null,
    action_url: null,
    metadata: {},
    priority: "normal",
    expires_at: null,
    resolved_at: null,
    created_at: "2026-09-20T00:00:00.000Z",
    ...changes,
  };
}

function inbox(notifications: UcatNotification[]): UcatNotificationInbox {
  return {
    notifications,
    unreadCount: notifications.filter((item) => !item.read_at).length,
  };
}

test("read all acknowledges unread items without rewriting already-read ones", () => {
  const alreadyRead = note({ id: "a", read_at: "2026-09-20T08:00:00.000Z" });
  const next = applyInboxCommand(
    inbox([alreadyRead, note({ id: "b" })]),
    { type: "readAll" },
    readAt,
  );
  assert.equal(next.unreadCount, 0);
  assert.equal(next.notifications[0]?.read_at, alreadyRead.read_at);
  assert.equal(next.notifications[1]?.read_at, readAt);
  assert.deepEqual(inboxRequestBody({ type: "readAll" }), { markAllRead: true });
});

test("read and unread toggle a single item and keep the unread count in step", () => {
  const start = inbox([note({ id: "a" }), note({ id: "b", read_at: readAt })]);
  const read = applyInboxCommand(start, { type: "read", id: "a" }, readAt);
  assert.equal(read.unreadCount, 0);
  assert.equal(read.notifications[0]?.read_at, readAt);
  const unread = applyInboxCommand(read, { type: "unread", id: "b" }, readAt);
  assert.equal(unread.unreadCount, 1);
  assert.equal(unread.notifications[1]?.read_at, null);
  assert.deepEqual(inboxRequestBody({ type: "read", id: "a" }), {
    notificationIds: ["a"],
  });
  assert.deepEqual(inboxRequestBody({ type: "unread", id: "b" }), {
    notificationIds: ["b"],
    markUnread: true,
  });
});

test("a swipe most of the way across the card dismisses it", () => {
  assert.equal(swipePastDismissThreshold(-220, 400), true);
  assert.equal(swipePastDismissThreshold(-219, 400), false);
  assert.equal(swipePastDismissThreshold(-40, 0), false);
});

test("dismiss removes the item and drops it from the unread count", () => {
  const next = applyInboxCommand(
    inbox([note({ id: "a" }), note({ id: "b" })]),
    { type: "dismiss", id: "a" },
    readAt,
  );
  assert.deepEqual(
    next.notifications.map((item) => item.id),
    ["b"],
  );
  assert.equal(next.unreadCount, 1);
  assert.deepEqual(inboxRequestBody({ type: "dismiss", id: "a" }), {
    notificationIds: ["a"],
    dismiss: true,
  });
});
