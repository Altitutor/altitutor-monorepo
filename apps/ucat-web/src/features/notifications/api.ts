import type { UcatNotificationInbox } from "@/features/notifications/types";

export async function fetchUcatNotifications(): Promise<UcatNotificationInbox> {
  const response = await fetch("/api/ucat/notifications", {
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error("Failed to load notifications");
  }
  return response.json() as Promise<UcatNotificationInbox>;
}

export async function markUcatNotificationsRead(input: {
  notificationIds?: string[];
  markAllRead?: boolean;
}): Promise<void> {
  const response = await fetch("/api/ucat/notifications", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    throw new Error("Failed to update notifications");
  }
}

export async function dismissUcatNotifications(
  notificationIds: string[],
): Promise<void> {
  const response = await fetch("/api/ucat/notifications", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ notificationIds, dismiss: true }),
  });
  if (!response.ok) {
    throw new Error("Failed to dismiss notifications");
  }
}
