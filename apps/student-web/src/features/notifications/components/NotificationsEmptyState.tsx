'use client';

import { Bell } from 'lucide-react';

export function NotificationsEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4">
      <Bell className="h-12 w-12 text-muted-foreground mb-4" />
      <p className="text-sm text-muted-foreground text-center">
        No unread notifications
      </p>
    </div>
  );
}
