'use client';

import { forwardRef } from 'react';
import { Bell } from 'lucide-react';
import { Button } from '@altitutor/ui';
import { HeaderCountBadge } from '@/shared/components/HeaderCountBadge';

interface NotificationsButtonProps {
  unreadCount: number;
  onClick?: (e: React.MouseEvent) => void;
}

export const NotificationsButton = forwardRef<HTMLButtonElement, NotificationsButtonProps>(
  ({ unreadCount, onClick }, ref) => {
    return (
      <Button 
        ref={ref}
        variant="outline" 
        size="icon"
        className="h-9 w-9 relative"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
        onClick={onClick}
      >
      <Bell className="h-[1.2rem] w-[1.2rem]" />
      <HeaderCountBadge count={unreadCount} />
      </Button>
    );
  }
);
NotificationsButton.displayName = 'NotificationsButton';
