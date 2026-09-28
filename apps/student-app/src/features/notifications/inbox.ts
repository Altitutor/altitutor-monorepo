import type { NotificationPatch, StudentNotification } from '@/lib/student-api';

export function swipePastDismissThreshold(translationX: number, rowWidth: number): boolean {
  'worklet';
  return rowWidth > 0 && -translationX * 20 >= rowWidth * 11;
}

export function applyNotificationPatch(
  notifications: StudentNotification[],
  patch: NotificationPatch,
  readAt: string,
): StudentNotification[] {
  const ids = new Set(patch.notificationIds ?? []);
  if (patch.dismiss) return notifications.filter((notification) => !ids.has(notification.id));
  return notifications.map((notification) => {
    const selected = patch.markAllRead || ids.has(notification.id);
    if (!selected) return notification;
    if (patch.markUnread) return { ...notification, read_at: null };
    return notification.read_at ? notification : { ...notification, read_at: readAt };
  });
}
