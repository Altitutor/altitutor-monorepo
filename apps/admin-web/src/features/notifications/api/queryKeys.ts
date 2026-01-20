/**
 * Query keys for notifications
 */
export const notificationsKeys = {
  all: ['notifications'] as const,
  notifications: (staffId: string) => [...notificationsKeys.all, 'list', staffId] as const,
  unreadCount: (staffId: string) => [...notificationsKeys.all, 'unreadCount', staffId] as const,
  notification: (id: string) => [...notificationsKeys.all, 'detail', id] as const,
};
