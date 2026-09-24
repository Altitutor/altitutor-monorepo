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
  useMarkAllNotificationsRead,
  useDismissNotification,
} from '../api';
import type { Notification } from '../types';

interface NotificationsTrayProps {
  staffId: string;
}

export function NotificationsTray({ staffId }: NotificationsTrayProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [armedIds, setArmedIds] = useState<Set<string>>(new Set());
  const { data: notifications = [], isLoading } = useNotifications(staffId);
  const { data: unreadCount = 0 } = useUnreadCount(staffId);
  const markReadMutation = useMarkNotificationRead();
  const markAllReadMutation = useMarkAllNotificationsRead();
  const dismissMutation = useDismissNotification();

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
    dismissMutation.mutate({ notificationId, staffId });
  };

  const handleOpenNotification = (notification: Notification) => {
    if (!notification.read_at) {
      markReadMutation.mutate({ notificationId: notification.id, staffId });
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
        collisionPadding={16}
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
              onClick={() => markAllReadMutation.mutate(staffId)}
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
                isArmed={armedIds.has(notification.id)}
                onArm={() => handleArm(notification.id)}
                onConfirmDismiss={() => handleConfirmDismiss(notification.id)}
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
