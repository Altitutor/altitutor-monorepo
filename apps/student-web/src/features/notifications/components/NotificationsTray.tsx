'use client';

import { useState } from 'react';
import { NotificationTray } from '@altitutor/ui';
import { NotificationItem } from './NotificationItem';
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

  return (
    <NotificationTray
      open={isOpen}
      onOpenChange={handleOpenChange}
      unreadCount={unreadCount}
      isLoading={isLoading}
      isEmpty={notifications.length === 0}
      isMarkingAllRead={markAllReadMutation.isPending}
      onMarkAllRead={() => markAllReadMutation.mutate({ markAllRead: true })}
    >
      {notifications.map((notification: Notification) => (
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
      ))}
    </NotificationTray>
  );
}
