'use client';

import { useRouter } from 'next/navigation';
import { NotificationRow } from '@altitutor/ui';
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
    <NotificationRow
      title={notification.title}
      body={notification.body}
      timestamp={notification.created_at ? formatRelativeDate(notification.created_at) : 'unknown'}
      unread={unread}
      onOpen={handleClick}
      onDismiss={isArmed ? onConfirmDismiss : onArm}
      dismissArmed={isArmed}
    />
  );
}
