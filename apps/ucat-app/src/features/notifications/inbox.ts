import type { UcatNotification, UcatNotificationInbox } from "./types";

export type InboxCommand =
  | { type: "readAll" }
  | { type: "read"; id: string }
  | { type: "unread"; id: string }
  | { type: "dismiss"; id: string };

export function applyInboxCommand(
  inbox: UcatNotificationInbox,
  command: InboxCommand,
  readAt: string,
): UcatNotificationInbox {
  const notifications = applyNotifications(inbox.notifications, command, readAt);
  return {
    notifications,
    unreadCount: notifications.filter((notification) => !notification.read_at)
      .length,
  };
}

export function swipePastDismissThreshold(
  translationX: number,
  rowWidth: number,
): boolean {
  "worklet";
  return rowWidth > 0 && -translationX * 20 >= rowWidth * 11;
}

export function inboxRequestBody(command: InboxCommand): {
  notificationIds?: string[];
  markAllRead?: boolean;
  markUnread?: boolean;
  dismiss?: boolean;
} {
  if (command.type === "readAll") return { markAllRead: true };
  if (command.type === "read") return { notificationIds: [command.id] };
  if (command.type === "unread")
    return { notificationIds: [command.id], markUnread: true };
  return { notificationIds: [command.id], dismiss: true };
}

function applyNotifications(
  notifications: UcatNotification[],
  command: InboxCommand,
  readAt: string,
): UcatNotification[] {
  if (command.type === "readAll") {
    return notifications.map((notification) =>
      notification.read_at ? notification : { ...notification, read_at: readAt },
    );
  }
  if (command.type === "dismiss") {
    return notifications.filter((notification) => notification.id !== command.id);
  }
  return notifications.map((notification) => {
    if (notification.id !== command.id) return notification;
    if (command.type === "read") {
      return { ...notification, read_at: notification.read_at ?? readAt };
    }
    return { ...notification, read_at: null };
  });
}
