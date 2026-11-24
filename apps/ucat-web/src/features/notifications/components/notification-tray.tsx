"use client";

import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { AlertCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { NotificationTray as SharedNotificationTray, NotificationRow } from "@altitutor/ui";
import {
  useDismissUcatNotifications,
  useMarkUcatNotificationsRead,
  useUcatNotifications,
} from "@/features/notifications/hooks";
import type { UcatNotification } from "@/features/notifications/types";

function relativeTime(value: string | null): string {
  if (!value) return "Recently";
  return formatDistanceToNow(new Date(value), { addSuffix: true });
}

function notificationActionLabel(notification: UcatNotification): string {
  const metadata = notification.metadata;
  if (
    metadata &&
    typeof metadata === "object" &&
    !Array.isArray(metadata) &&
    typeof metadata.action_label === "string"
  ) {
    return metadata.action_label;
  }
  return "View";
}

export function NotificationTray() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [armedIds, setArmedIds] = useState<Set<string>>(new Set());
  const inbox = useUcatNotifications(true);
  const markRead = useMarkUcatNotificationsRead();
  const dismiss = useDismissUcatNotifications();
  const notifications = inbox.data?.notifications ?? [];
  const unreadCount = inbox.data?.unreadCount ?? 0;

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (nextOpen) {
      void inbox.refetch();
      return;
    }
    setArmedIds(new Set());
  };

  const handleArm = (notificationId: string) => {
    setArmedIds((prev) => new Set(prev).add(notificationId));
  };

  const handleConfirmDismiss = (notificationId: string) => {
    setArmedIds((prev) => {
      const next = new Set(prev);
      next.delete(notificationId);
      return next;
    });
    dismiss.mutate([notificationId]);
  };

  const openNotification = async (notification: UcatNotification) => {
    if (!notification.read_at) {
      try {
        await markRead.mutateAsync({ notificationIds: [notification.id] });
      } catch {
        // Reading the destination remains useful even if acknowledgement failed.
      }
    }
    handleOpenChange(false);
    if (!notification.action_url) return;
    if (/^https?:\/\//i.test(notification.action_url)) {
      window.open(notification.action_url, "_blank", "noopener,noreferrer");
      return;
    }
    router.push(notification.action_url);
  };

  return (
    <SharedNotificationTray
      open={open}
      onOpenChange={handleOpenChange}
      unreadCount={unreadCount}
      isLoading={inbox.isLoading}
      isEmpty={notifications.length === 0}
      isMarkingAllRead={markRead.isPending}
      onMarkAllRead={() => markRead.mutate({ markAllRead: true })}
      onRetry={inbox.isError ? () => void inbox.refetch() : undefined}
    >
      {notifications.map((notification) => {
        const isArmed = armedIds.has(notification.id);
        const metadata = notification.metadata;
        const actionRequired = metadata && typeof metadata === "object"
          && !Array.isArray(metadata) && metadata.action_required === true;

        return (
          <NotificationRow
            key={notification.id}
            title={notification.title}
            body={notification.body}
            showFullBody
            timestamp={relativeTime(notification.created_at)}
            unread={!notification.read_at}
            icon={notification.priority === "critical" ? (
              <AlertCircle className="mt-0.5 size-5 shrink-0 text-destructive" aria-label="Critical" />
            ) : undefined}
            details={actionRequired ? (
              <span className="mt-1 block text-xs font-medium text-muted-foreground">Action required</span>
            ) : undefined}
            actionLabel={notification.action_url ? notificationActionLabel(notification) : undefined}
            onOpen={() => void openNotification(notification)}
            onDismiss={() => isArmed ? handleConfirmDismiss(notification.id) : handleArm(notification.id)}
            dismissArmed={isArmed}
            dismissDisabled={dismiss.isPending}
          />
        );
      })}
    </SharedNotificationTray>
  );
}
