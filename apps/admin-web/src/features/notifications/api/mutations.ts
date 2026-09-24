import { useMutation, useQueryClient } from '@tanstack/react-query';
import { notificationsApi } from './notifications';
import { notificationsKeys } from './queryKeys';

/**
 * Mark notification as read
 */
export function useMarkNotificationRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ notificationId, staffId }: { notificationId: string; staffId: string }) =>
      notificationsApi.markNotificationRead(notificationId, staffId),
    onSuccess: (_, { staffId }) => {
      queryClient.invalidateQueries({ queryKey: notificationsKeys.notifications(staffId) });
      queryClient.invalidateQueries({ queryKey: notificationsKeys.unreadCount(staffId) });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (staffId: string) => notificationsApi.markAllNotificationsRead(staffId),
    onSuccess: (_, staffId) => {
      queryClient.invalidateQueries({ queryKey: notificationsKeys.notifications(staffId) });
      queryClient.invalidateQueries({ queryKey: notificationsKeys.unreadCount(staffId) });
    },
  });
}

export function useDismissNotification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ notificationId, staffId }: { notificationId: string; staffId: string }) =>
      notificationsApi.dismissNotification(notificationId, staffId),
    onSuccess: (_, { staffId }) => {
      queryClient.invalidateQueries({ queryKey: notificationsKeys.notifications(staffId) });
      queryClient.invalidateQueries({ queryKey: notificationsKeys.unreadCount(staffId) });
    },
  });
}
