/**
 * Query keys for automation rules
 */
export const automationKeys = {
  all: ['automation'] as const,
  rules: () => [...automationKeys.all, 'rules'] as const,
  rule: (id: string) => [...automationKeys.rules(), id] as const,
  notifications: () => [...automationKeys.all, 'notifications'] as const,
  notification: (id: string) => [...automationKeys.notifications(), id] as const,
  staffNotifications: (staffId: string) => [...automationKeys.notifications(), 'staff', staffId] as const,
};

