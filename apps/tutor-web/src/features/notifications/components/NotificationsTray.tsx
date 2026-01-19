'use client';

import { useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@altitutor/ui';
import { NotificationsButton } from './NotificationsButton';
import { NotificationItem } from './NotificationItem';
import { NotificationsEmptyState } from './NotificationsEmptyState';
import { useNotifications, useUnreadCount, useMarkNotificationRead } from '../api';
import type { Notification } from '../types';

export function NotificationsTray() {
  const [isOpen, setIsOpen] = useState(false);
  const { data: notifications = [], isLoading } = useNotifications();
  const { data: unreadCount = 0 } = useUnreadCount();
  const markReadMutation = useMarkNotificationRead();

  const handleMarkRead = (notificationId: string) => {
    markReadMutation.mutate(notificationId);
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <NotificationsButton unreadCount={unreadCount} />
      </PopoverTrigger>
      <PopoverContent 
        className="w-96 max-w-[calc(100vw-2rem)] p-0 max-h-[80vh] overflow-y-auto !z-[100]"
        side="bottom"
        align="end"
        sideOffset={8}
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
                onMarkRead={handleMarkRead}
              />
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
