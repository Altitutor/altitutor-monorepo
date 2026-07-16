'use client';

import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import { Button } from '@altitutor/ui';
import { cn } from '@/shared/utils';
import { formatRelativeDate } from '@/shared/utils/datetime';
import type { Notification } from '../types';

interface NotificationItemProps {
  notification: Notification;
  isArmed?: boolean;
  onArm: () => void;
  onConfirmDismiss: () => void;
  onOpen: () => void;
}

export function NotificationItem({
  notification,
  isArmed = false,
  onArm,
  onConfirmDismiss,
  onOpen,
}: NotificationItemProps) {
  const router = useRouter();
  const unread = !notification.read_at;

  const handleClick = () => {
    onOpen();

    if (!notification.action_url) return;

    const actionUrl = notification.action_url;
    if (actionUrl.startsWith('http')) {
      window.open(actionUrl, '_blank');
    } else {
      router.push(actionUrl);
    }
  };

  return (
    <div
      className={cn(
        'p-4 hover:bg-muted/50 transition-all',
        unread && 'bg-primary/[0.045]',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div
          className="flex-1 cursor-pointer min-w-0"
          onClick={handleClick}
        >
          <div className="flex items-start gap-2">
            <h4 className={cn('text-sm', unread ? 'font-semibold' : 'font-medium')}>
              {notification.title}
            </h4>
            {unread ? (
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
            ) : null}
          </div>
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
          variant={isArmed ? 'destructive' : 'outline'}
          size="icon"
          onClick={(e) => {
            e.stopPropagation();
            if (isArmed) {
              onConfirmDismiss();
            } else {
              onArm();
            }
          }}
          className={cn(
            'h-8 w-8 flex-shrink-0 transition-all duration-200',
            isArmed && 'scale-110',
          )}
          aria-label={isArmed ? 'Confirm dismiss' : 'Dismiss'}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
