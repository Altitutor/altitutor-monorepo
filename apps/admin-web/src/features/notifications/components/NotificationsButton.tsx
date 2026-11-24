'use client';

import { forwardRef, type ComponentProps } from 'react';
import { Bell } from 'lucide-react';
import { Button } from '@altitutor/ui';
import { HeaderCountBadge } from '@/shared/components/HeaderCountBadge';

type NotificationsButtonProps = ComponentProps<typeof Button> & { unreadCount: number };

export const NotificationsButton = forwardRef<HTMLButtonElement, NotificationsButtonProps>(
  ({ unreadCount, ...props }, ref) => {
    return (
      <Button 
        {...props}
        ref={ref}
        variant="outline" 
        size="icon"
        className="relative size-8"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
      >
      <Bell className="size-4" />
      <HeaderCountBadge count={unreadCount} />
      </Button>
    );
  }
);
NotificationsButton.displayName = 'NotificationsButton';
