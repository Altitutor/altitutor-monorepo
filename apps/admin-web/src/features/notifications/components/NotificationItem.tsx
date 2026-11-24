'use client';

import { useRouter } from 'next/navigation';
import { NotificationRow } from '@altitutor/ui';
import { formatRelativeDate } from '@/features/messages/utils/templateHelpers';
import { useEntityNavigation } from '@/shared/contexts/EntityNavigation';
import type { Notification } from '../types';
import { openPayTierPortal } from '../utils/openPayTierPortal';

interface NotificationItemProps {
  notification: Notification;
  onDismiss: () => void;
  onOpen: () => void;
}

export function NotificationItem({
  notification,
  onDismiss,
  onOpen,
}: NotificationItemProps) {
  const router = useRouter();
  const entityModals = useEntityNavigation();
  const unread = !notification.read_at;

  const handleClick = () => {
    onOpen();

    if (!notification.action_url) return;

    if (notification.notification_type === 'PAY_TIER_ELIGIBLE') {
      openPayTierPortal();
      return;
    }

    const sessionModalMatch = notification.action_url.match(/^modal:\/\/session\/([^/?#]+)$/);
    if (sessionModalMatch) {
      entityModals.openSession(decodeURIComponent(sessionModalMatch[1]));
      return;
    }

    if (notification.action_url.startsWith('http')) {
      window.open(notification.action_url, '_blank');
    } else {
      router.push(notification.action_url);
    }
  };

  return (
    <NotificationRow
      title={notification.title}
      body={notification.body}
      timestamp={notification.created_at ? formatRelativeDate(notification.created_at) : 'unknown'}
      unread={unread}
      onOpen={handleClick}
      onDismiss={onDismiss}
    />
  );
}
