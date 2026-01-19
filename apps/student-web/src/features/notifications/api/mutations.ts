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
      // Invalidate queries - notification will disappear from tray (unread filter)
      queryClient.invalidateQueries({ queryKey: notificationsKeys.notifications() });
      queryClient.invalidateQueries({ queryKey: notificationsKeys.unreadCount() });
    },
  });
}
