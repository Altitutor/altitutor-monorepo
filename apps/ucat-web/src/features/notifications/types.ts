import type { Json } from "@altitutor/shared";

export type UcatNotification = {
  id: string;
  notification_type: string;
  title: string;
  body: string | null;
  read_at: string | null;
  dismissed_at: string | null;
  action_url: string | null;
  metadata: Json;
  priority: "normal" | "important" | "critical";
  expires_at: string | null;
  resolved_at: string | null;
  created_at: string | null;
};

export type UcatNotificationInbox = {
  notifications: UcatNotification[];
  unreadCount: number;
};
