"use client";

import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { AlertCircle, Bell, CheckCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { Popover, PopoverContent, PopoverTrigger } from "@altitutor/ui";
import { Button } from "@/components/ui/button";
import {
  useMarkUcatNotificationsRead,
  useUcatNotifications,
} from "@/features/notifications/hooks";
import type { UcatNotification } from "@/features/notifications/types";
import {
  UCAT_HEADER_ICON_BUTTON,
  UCAT_SURFACE_CARD,
} from "@/lib/ucat-surface-motion";
import { cn } from "@/lib/utils";

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
  const inbox = useUcatNotifications(true);
  const markRead = useMarkUcatNotificationsRead();
  const notifications = inbox.data?.notifications ?? [];
  const unreadCount = inbox.data?.unreadCount ?? 0;

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (nextOpen) void inbox.refetch();
  };

  const openNotification = async (notification: UcatNotification) => {
    if (!notification.read_at) {
      try {
        await markRead.mutateAsync({ notificationIds: [notification.id] });
      } catch {
        // Reading the destination remains useful even if acknowledgement failed.
      }
    }
    setOpen(false);
    if (!notification.action_url) return;
    if (/^https?:\/\//i.test(notification.action_url)) {
      window.open(notification.action_url, "_blank", "noopener,noreferrer");
      return;
    }
    router.push(notification.action_url);
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className={cn(UCAT_HEADER_ICON_BUTTON, "relative")}
          aria-label={
            unreadCount > 0
              ? `${unreadCount} unread notification${unreadCount === 1 ? "" : "s"}`
              : "Notifications"
          }
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 ? (
            <span className="absolute -right-1 -top-1 flex min-h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-primary-foreground">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className={cn(
          UCAT_SURFACE_CARD,
          "w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-ucatShell p-0",
        )}
      >
        <div className="flex items-center justify-between border-b border-black/[0.05] px-4 py-3 dark:border-white/[0.07]">
          <div>
            <h2 className="text-sm font-semibold">Notifications</h2>
            <p className="text-xs text-muted-foreground">
              {inbox.isLoading
                ? "Checking for updates…"
                : inbox.isError
                  ? "Couldn’t load updates"
                  : unreadCount > 0
                    ? `${unreadCount} unread`
                    : "You’re all caught up"}
            </p>
          </div>
          {unreadCount > 0 ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 text-xs"
              disabled={markRead.isPending}
              onClick={() => markRead.mutate({ markAllRead: true })}
            >
              <CheckCheck className="h-4 w-4" />
              Mark all read
            </Button>
          ) : null}
        </div>

        <div className="max-h-[min(32rem,70vh)] overflow-y-auto">
          {inbox.isLoading ? (
            <div className="space-y-3 p-4" aria-label="Loading notifications">
              {[0, 1, 2].map((item) => (
                <div
                  key={item}
                  className="h-16 animate-pulse rounded-ucatControl bg-muted"
                />
              ))}
            </div>
          ) : inbox.isError ? (
            <div className="p-6 text-center">
              <p className="text-sm font-medium">Notifications couldn’t load</p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="mt-2"
                onClick={() => void inbox.refetch()}
              >
                Try again
              </Button>
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-8 text-center">
              <Bell className="mx-auto h-6 w-6 text-muted-foreground" />
              <p className="mt-3 text-sm font-medium">No notifications yet</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Referral rewards, billing updates and new releases will appear
                here.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-black/[0.05] dark:divide-white/[0.07]">
              {notifications.map((notification) => {
                const unread = !notification.read_at;
                return (
                  <div
                    key={notification.id}
                    className={cn(
                      "flex w-full items-center transition-colors hover:bg-muted/50",
                      unread && "bg-primary/[0.045]",
                    )}
                  >
                    <button
                      type="button"
                      className="flex min-w-0 flex-1 items-start gap-3 px-4 py-3 text-left"
                      onClick={() => void openNotification(notification)}
                    >
                      <span
                        className={cn(
                          "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground",
                          notification.priority === "critical" &&
                            "bg-destructive/10 text-destructive",
                        )}
                      >
                        {notification.priority === "critical" ? (
                          <AlertCircle className="h-4 w-4" />
                        ) : (
                          <Bell className="h-4 w-4" />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-start gap-2">
                          <span
                            className={cn(
                              "text-sm",
                              unread && "font-semibold",
                            )}
                          >
                            {notification.title}
                          </span>
                          {unread ? (
                            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                          ) : null}
                        </span>
                        {notification.body ? (
                          <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                            {notification.body}
                          </span>
                        ) : null}
                        <span className="mt-1.5 block text-[11px] text-muted-foreground/80">
                          {relativeTime(notification.created_at)}
                        </span>
                      </span>
                    </button>
                    {notification.action_url ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="mr-3 shrink-0"
                        onClick={() => void openNotification(notification)}
                      >
                        {notificationActionLabel(notification)}
                      </Button>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
