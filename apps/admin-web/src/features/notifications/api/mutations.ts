import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@altitutor/ui';
import type { Notification } from '../types';
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
      if (queryClient.isMutating({ mutationKey: notificationsKeys.dismiss })) return;
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
      if (queryClient.isMutating({ mutationKey: notificationsKeys.dismiss })) return;
      queryClient.invalidateQueries({ queryKey: notificationsKeys.notifications(staffId) });
      queryClient.invalidateQueries({ queryKey: notificationsKeys.unreadCount(staffId) });
    },
  });
}

export function useDismissNotification() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationKey: notificationsKeys.dismiss,
    mutationFn: async ({ notificationId, staffId }: { notificationId: string; staffId: string }) =>
      notificationsApi.dismissNotification(notificationId, staffId),
    onMutate: async ({ notificationId, staffId }) => {
      const listKey = notificationsKeys.notifications(staffId);
      const countKey = notificationsKeys.unreadCount(staffId);
      await Promise.all([
        queryClient.cancelQueries({ queryKey: listKey }),
        queryClient.cancelQueries({ queryKey: countKey }),
      ]);

      const notifications = queryClient.getQueryData<Notification[]>(listKey);
      const index = notifications?.findIndex((item) => item.id === notificationId) ?? -1;
      const removed = index >= 0 ? notifications?.[index] : undefined;
      let countDecremented = false;
      queryClient.setQueryData<Notification[]>(listKey, (current) =>
        current?.filter((item) => item.id !== notificationId)
      );
      if (removed && !removed.read_at) {
        queryClient.setQueryData<number>(countKey, (count) => {
          if (count === undefined || count <= 0) return count;
          countDecremented = true;
          return count - 1;
        });
      }
      return { removed, index, countDecremented };
    },
    onError: (_, { staffId }, context) => {
      // Restore only this dismissal so other pending dismissals stay hidden.
      if (context?.removed) {
        const removed = context.removed;
        queryClient.setQueryData<Notification[]>(notificationsKeys.notifications(staffId), (current) => {
          if (current?.some((item) => item.id === removed.id)) return current;
          const restored = [...(current ?? [])];
          restored.splice(context.index, 0, removed);
          return restored;
        });
        if (context.countDecremented) {
          queryClient.setQueryData<number>(notificationsKeys.unreadCount(staffId), (count) =>
            count === undefined ? count : count + 1
          );
        }
      }
      toast({ title: 'Could not dismiss notification', description: 'Please try again.', variant: 'destructive' });
    },
    onSettled: (_, __, { staffId }) => {
      // Refetch after the last dismissal, avoiding flashes of other pending items.
      if (queryClient.isMutating({ mutationKey: notificationsKeys.dismiss }) === 1) {
        queryClient.invalidateQueries({ queryKey: notificationsKeys.notifications(staffId) });
        queryClient.invalidateQueries({ queryKey: notificationsKeys.unreadCount(staffId) });
      }
    },
  });
}
