/**
 * Query keys for notifications
 */
export const notificationsKeys = {
  all: ['notifications'] as const,
  notifications: () => [...notificationsKeys.all, 'list'] as const,
  unreadCount: () => [...notificationsKeys.all, 'unreadCount'] as const,
  notification: (id: string) => [...notificationsKeys.all, 'detail', id] as const,
};
