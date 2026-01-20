import { useQuery } from '@tanstack/react-query';
import { notificationsApi } from './notifications';
import { notificationsKeys } from './queryKeys';

/**
 * Get unread notifications for current tutor
 */
export function useNotifications() {
  return useQuery({
    queryKey: notificationsKeys.notifications(),
    queryFn: () => notificationsApi.getNotifications(),
    staleTime: 1000 * 30, // 30 seconds - notifications change frequently
    gcTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Get unread count for current tutor
 */
export function useUnreadCount() {
  return useQuery({
    queryKey: notificationsKeys.unreadCount(),
    queryFn: () => notificationsApi.getUnreadCount(),
    staleTime: 1000 * 30, // 30 seconds
    gcTime: 1000 * 60 * 5, // 5 minutes
  });
}
