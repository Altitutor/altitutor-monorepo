"use client";

import type { ReactNode } from 'react';
import { Bell, CheckCheck, X } from 'lucide-react';
import { Button } from './button';
import { Popover, PopoverContent, PopoverTrigger } from './popover';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './tooltip';
import { cn } from '../lib/cn';

interface NotificationTrayProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  unreadCount: number;
  isLoading: boolean;
  isEmpty: boolean;
  isMarkingAllRead: boolean;
  onMarkAllRead: () => void;
  onRetry?: () => void;
  children: ReactNode;
}

export function NotificationTray({
  open, onOpenChange, unreadCount, isLoading, isEmpty,
  isMarkingAllRead, onMarkAllRead, onRetry, children,
}: NotificationTrayProps) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <TooltipProvider delayDuration={100}>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="relative size-8 shrink-0"
                aria-label={unreadCount > 0 ? `Notifications (${unreadCount} unread)` : 'Notifications'}
              >
                <Bell className="size-4" aria-hidden />
                {unreadCount > 0 && (
                  <span aria-hidden className="absolute -right-1 -top-1 z-10 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white tabular-nums">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent side="bottom">Notifications</TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <PopoverContent
        aria-label="Notifications"
        className="!z-[100] w-96 max-w-[calc(100vw-2rem)] overflow-hidden bg-popover p-0 shadow-xl"
        side="bottom"
        align="end"
        sideOffset={8}
        collisionPadding={16}
      >
        <div className="flex items-center justify-between gap-2 border-b p-4">
          <div>
            <h3 className="text-sm font-semibold">Notifications</h3>
            {!isLoading && !onRetry && (
              <p className="text-xs text-muted-foreground">
                {unreadCount > 0 ? `${unreadCount} unread` : "You're all caught up"}
              </p>
            )}
          </div>
          {unreadCount > 0 && (
            <Button type="button" variant="ghost" size="sm" className="h-8 gap-1.5 text-xs" disabled={isMarkingAllRead} onClick={onMarkAllRead}>
              <CheckCheck className="h-4 w-4" aria-hidden />
              Mark all read
            </Button>
          )}
        </div>
        <div className="max-h-[min(70vh,calc(var(--radix-popover-content-available-height)-4.5rem))] divide-y overflow-y-auto">
          {isLoading ? (
            <p role="status" className="py-8 text-center text-sm text-muted-foreground">Loading notifications…</p>
          ) : onRetry ? (
            <div className="p-6 text-center">
              <p className="text-sm font-medium">Notifications couldn’t load</p>
              <Button type="button" variant="ghost" size="sm" className="mt-2" onClick={onRetry}>Try again</Button>
            </div>
          ) : isEmpty ? (
            <div className="flex flex-col items-center justify-center px-4 py-12">
              <Bell className="mb-4 h-12 w-12 text-muted-foreground" aria-hidden />
              <p className="text-center text-sm text-muted-foreground">No notifications</p>
            </div>
          ) : children}
        </div>
      </PopoverContent>
    </Popover>
  );
}

interface NotificationRowProps {
  title: string | null;
  body?: string | null;
  showFullBody?: boolean;
  timestamp: string;
  unread: boolean;
  icon?: ReactNode;
  details?: ReactNode;
  actionLabel?: string;
  onOpen: () => void;
  onDismiss: () => void;
  dismissArmed?: boolean;
  dismissDisabled?: boolean;
}

export function NotificationRow({
  title, body, showFullBody, timestamp, unread, icon, details, actionLabel,
  onOpen, onDismiss, dismissArmed, dismissDisabled,
}: NotificationRowProps) {
  return (
    <div className={cn('flex items-start justify-between gap-3 p-4 transition-colors hover:bg-muted/50', unread && 'bg-primary/[0.045]')}>
      <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 items-start gap-2 rounded-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        {icon}
        <span className="min-w-0 flex-1">
          <span className="flex items-start gap-2">
            <span className={cn('break-words text-sm', unread ? 'font-semibold' : 'font-medium')}>{title}</span>
            {unread && <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-label="Unread" />}
          </span>
          {body && <span className={cn("mt-1 block break-words text-sm text-muted-foreground", !showFullBody && "line-clamp-2")}>{body}</span>}
          {details}
          <span className="mt-2 block text-xs text-muted-foreground">{timestamp}</span>
        </span>
      </button>
      {actionLabel && <Button type="button" variant="outline" size="sm" className="h-8 shrink-0" onClick={onOpen}>{actionLabel}</Button>}
      <Button
        type="button"
        variant={dismissArmed ? 'destructive' : 'outline'}
        size="icon"
        className="h-8 w-8 shrink-0"
        aria-label={dismissArmed ? 'Confirm dismiss' : 'Dismiss'}
        disabled={dismissDisabled}
        onClick={onDismiss}
      >
        <X className="h-4 w-4" aria-hidden />
      </Button>
    </div>
  );
}
