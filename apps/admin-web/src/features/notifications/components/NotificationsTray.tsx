'use client';

import { useState } from 'react';
import { NotificationTray } from '@altitutor/ui';
import { NotificationItem } from './NotificationItem';
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
  const { data: notifications = [], isLoading } = useNotifications(staffId);
  const { data: unreadCount = 0 } = useUnreadCount(staffId);
  const markReadMutation = useMarkNotificationRead();
  const markAllReadMutation = useMarkAllNotificationsRead();
  const dismissMutation = useDismissNotification();

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
  };

  const handleDismiss = (notificationId: string) => {
    dismissMutation.mutate({ notificationId, staffId });
  };

  const handleOpenNotification = (notification: Notification) => {
    if (!notification.read_at) {
      markReadMutation.mutate({ notificationId: notification.id, staffId });
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
      onMarkAllRead={() => markAllReadMutation.mutate(staffId)}
    >
      {notifications.map((notification: Notification) => (
        <NotificationItem
          key={notification.id}
          notification={notification}
          onDismiss={() => handleDismiss(notification.id)}
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
