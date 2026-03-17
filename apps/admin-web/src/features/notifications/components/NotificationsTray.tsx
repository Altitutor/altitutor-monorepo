'use client';

import { useState, useEffect } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@altitutor/ui';
import { NotificationsButton } from './NotificationsButton';
import { NotificationItem } from './NotificationItem';
import { NotificationsEmptyState } from './NotificationsEmptyState';
import { useNotifications, useUnreadCount, useMarkNotificationRead } from '../api';
import type { Notification } from '../types';

interface NotificationsTrayProps {
  staffId: string;
}

export function NotificationsTray({ staffId }: NotificationsTrayProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const { data: notifications = [], isLoading } = useNotifications(staffId);
  const { data: unreadCount = 0 } = useUnreadCount(staffId);
  const markReadMutation = useMarkNotificationRead();

  // When tray closes, mark all dismissed notifications as read
  useEffect(() => {
    if (!isOpen && dismissedIds.size > 0) {
      // Batch mark all dismissed notifications as read
      Promise.all(
        Array.from(dismissedIds).map((notificationId) =>
          markReadMutation.mutateAsync({ notificationId, staffId })
        )
      ).then(() => {
        // Clear dismissed set after successful batch mark
        setDismissedIds(new Set());
      }).catch((error) => {
        console.error('Failed to mark some notifications as read:', error);
      });
    }
  }, [isOpen, dismissedIds, markReadMutation, staffId]);

  const handleDismiss = (notificationId: string) => {
    setDismissedIds((prev) => new Set(prev).add(notificationId));
  };

  const handleUndismiss = (notificationId: string) => {
    setDismissedIds((prev) => {
      const next = new Set(prev);
      next.delete(notificationId);
      return next;
    });
  };

  const handleTriggerClick = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsOpen((prev) => !prev);
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
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
        <div className="p-4 border-b">
          <h3 className="font-semibold text-sm">Notifications</h3>
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
                isDismissed={dismissedIds.has(notification.id)}
                onDismiss={() => handleDismiss(notification.id)}
                onUndismiss={() => handleUndismiss(notification.id)}
              />
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
