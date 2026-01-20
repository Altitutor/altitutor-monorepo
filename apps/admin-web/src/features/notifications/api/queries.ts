import { useQuery } from '@tanstack/react-query';
import { notificationsApi } from './notifications';
import { notificationsKeys } from './queryKeys';

/**
 * Get unread notifications for a staff member
 */
export function useNotifications(staffId: string) {
  return useQuery({
    queryKey: notificationsKeys.notifications(staffId),
    queryFn: () => notificationsApi.getNotifications(staffId),
    enabled: !!staffId,
    staleTime: 1000 * 30, // 30 seconds - notifications change frequently
    gcTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Get unread count for a staff member
 */
export function useUnreadCount(staffId: string) {
  return useQuery({
    queryKey: notificationsKeys.unreadCount(staffId),
    queryFn: () => notificationsApi.getUnreadCount(staffId),
    enabled: !!staffId,
    staleTime: 1000 * 30, // 30 seconds
    gcTime: 1000 * 60 * 5, // 5 minutes
  });
}
