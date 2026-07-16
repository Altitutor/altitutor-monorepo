import { useMutation, useQueryClient } from '@tanstack/react-query';
import { notificationsApi } from './notifications';
import { notificationsKeys } from './queryKeys';

/**
 * Mark notification as read
 */
export function useMarkNotificationRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (notificationId: string) =>
      notificationsApi.markNotificationRead(notificationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationsKeys.notifications() });
      queryClient.invalidateQueries({ queryKey: notificationsKeys.unreadCount() });
    },
  });
}

export function useMarkNotificationsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input?: { notificationIds?: string[]; markAllRead?: boolean }) =>
      notificationsApi.markNotificationsRead(input?.notificationIds, input?.markAllRead ?? false),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationsKeys.notifications() });
      queryClient.invalidateQueries({ queryKey: notificationsKeys.unreadCount() });
    },
  });
}

export function useDismissNotifications() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (notificationIds: string[]) =>
      notificationsApi.dismissNotifications(notificationIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationsKeys.notifications() });
      queryClient.invalidateQueries({ queryKey: notificationsKeys.unreadCount() });
    },
  });
}
