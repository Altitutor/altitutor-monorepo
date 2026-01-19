'use client';

import { forwardRef } from 'react';
import { Bell } from 'lucide-react';
import { Button } from '@altitutor/ui';
import { cn } from '@/shared/utils';

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
      {unreadCount > 0 && (
        <span 
          className={cn(
            "absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white text-[10px] font-bold",
            unreadCount > 9 && "text-[9px]"
          )}
        >
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
      </Button>
    );
  }
);
NotificationsButton.displayName = 'NotificationsButton';
