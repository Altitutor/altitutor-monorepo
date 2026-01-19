'use client';

import { useRouter } from 'next/navigation';
import { Check } from 'lucide-react';
import { Button } from '@altitutor/ui';
import { formatRelativeDate } from '@/features/messages/utils/templateHelpers';
import type { Notification } from '../types';

interface NotificationItemProps {
  notification: Notification;
  onMarkRead: (notificationId: string) => void;
}

export function NotificationItem({ notification, onMarkRead }: NotificationItemProps) {
  const router = useRouter();

  const handleClick = () => {
    if (notification.action_url) {
      // Handle both relative and absolute URLs
      if (notification.action_url.startsWith('http')) {
        window.open(notification.action_url, '_blank');
      } else {
        router.push(notification.action_url);
      }
    }
  };

  return (
    <div className="p-4 hover:bg-muted/50 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div 
          className="flex-1 cursor-pointer min-w-0"
          onClick={handleClick}
        >
          <h4 className="font-medium text-sm">{notification.title}</h4>
          {notification.body && (
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
              {notification.body}
            </p>
          )}
          <p className="text-xs text-muted-foreground mt-2">
            {notification.created_at ? formatRelativeDate(notification.created_at) : 'unknown'}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={(e) => {
            e.stopPropagation();
            onMarkRead(notification.id);
          }}
          className="h-8 w-8 flex-shrink-0"
          aria-label="Mark as read"
        >
          <Check className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
