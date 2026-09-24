'use client';

import { useState } from 'react';
import { CheckCheck } from 'lucide-react';
import { Button, Popover, PopoverContent, PopoverTrigger } from '@altitutor/ui';
import { NotificationsButton } from './NotificationsButton';
import { NotificationItem } from './NotificationItem';
import { NotificationsEmptyState } from './NotificationsEmptyState';
import {
  useNotifications,
  useUnreadCount,
  useMarkNotificationRead,
  useMarkNotificationsRead,
  useDismissNotifications,
} from '../api';
import type { Notification } from '../types';

export function NotificationsTray() {
  const [isOpen, setIsOpen] = useState(false);
  const [armedIds, setArmedIds] = useState<Set<string>>(new Set());
  const { data: notifications = [], isLoading } = useNotifications();
  const { data: unreadCount = 0 } = useUnreadCount();
  const markReadMutation = useMarkNotificationRead();
  const markAllReadMutation = useMarkNotificationsRead();
  const dismissMutation = useDismissNotifications();

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      setArmedIds(new Set());
    }
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
    dismissMutation.mutate([notificationId]);
  };

  const handleOpenNotification = (notification: Notification) => {
    if (!notification.read_at && notification.id) {
      markReadMutation.mutate(notification.id);
    }
  };

  const handleTriggerClick = (e: React.MouseEvent) => {
    e.preventDefault();
    handleOpenChange(!isOpen);
  };

  return (
    <Popover open={isOpen} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <NotificationsButton unreadCount={unreadCount} onClick={handleTriggerClick} />
      </PopoverTrigger>
      <PopoverContent
        className="w-96 max-w-[calc(100vw-2rem)] p-0 max-h-[80vh] overflow-y-auto !z-[100] bg-popover border shadow-xl"
        side="bottom"
        align="end"
        sideOffset={8}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="flex items-center justify-between border-b p-4">
          <div>
            <h3 className="font-semibold text-sm">Notifications</h3>
            <p className="text-xs text-muted-foreground">
              {unreadCount > 0 ? `${unreadCount} unread` : "You're all caught up"}
            </p>
          </div>
          {unreadCount > 0 ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 text-xs"
              disabled={markAllReadMutation.isPending}
              onClick={() => markAllReadMutation.mutate({ markAllRead: true })}
            >
              <CheckCheck className="h-4 w-4" />
              Mark all read
            </Button>
          ) : null}
        </div>
        <div className="divide-y">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <p className="text-sm text-muted-foreground">Loading...</p>
            </div>
          ) : notifications.length === 0 ? (
            <NotificationsEmptyState />
          ) : (
            notifications.map((notification: Notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                isArmed={armedIds.has(notification.id ?? '')}
                onArm={() => notification.id && handleArm(notification.id)}
                onConfirmDismiss={() => notification.id && handleConfirmDismiss(notification.id)}
                onOpen={() => {
                  handleOpenNotification(notification);
                  if (notification.action_url) {
                    setIsOpen(false);
                  }
                }}
              />
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
