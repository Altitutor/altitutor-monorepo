const MAX_NOTIFICATION_PATCH_IDS = 50;

export type NotificationInboxPatch =
  | { type: "readAll" }
  | { type: "read"; ids: string[] }
  | { type: "unread"; ids: string[] }
  | { type: "dismiss"; ids: string[] };

export function parseNotificationInboxPatch(body: {
  notificationIds?: unknown;
  markAllRead?: unknown;
  markUnread?: unknown;
  dismiss?: unknown;
}):
  | { ok: true; patch: NotificationInboxPatch }
  | { ok: false; error: string } {
  const ids = Array.from(
    new Set(
      (Array.isArray(body.notificationIds) ? body.notificationIds : []).filter(
        (id): id is string => typeof id === "string",
      ),
    ),
  ).slice(0, MAX_NOTIFICATION_PATCH_IDS);

  if (body.markAllRead && body.markUnread) {
    return { ok: false, error: "Cannot unread all notifications" };
  }
  if (body.markAllRead && body.dismiss) {
    return { ok: false, error: "Cannot dismiss all notifications" };
  }
  if (body.markUnread && body.dismiss) {
    return { ok: false, error: "Cannot unread and dismiss together" };
  }
  if (!body.markAllRead && ids.length === 0) {
    return { ok: false, error: "No notifications selected" };
  }
  if (body.dismiss) return { ok: true, patch: { type: "dismiss", ids } };
  if (body.markUnread) return { ok: true, patch: { type: "unread", ids } };
  if (body.markAllRead) return { ok: true, patch: { type: "readAll" } };
  return { ok: true, patch: { type: "read", ids } };
}
