/**
 * Centralized query key factory for messages feature
 * Ensures consistent query key structure across the application
 */
export const messagesKeys = {
  all: ['messages'] as const,
  conversations: () => [...messagesKeys.all, 'conversations'] as const,
  conversation: (id: string) => [...messagesKeys.all, 'conversation', id] as const,
  conversationInfo: (id: string) => [...messagesKeys.all, 'conversation-info', id] as const,
  conversationContact: (id: string) => [...messagesKeys.all, 'conversation-contact', id] as const,
  conversationSubjects: (id: string, type: 'student' | 'staff') => [...messagesKeys.all, 'conversation-subjects', id, type] as const,
  conversationClasses: (id: string) => [...messagesKeys.all, 'conversation-classes', id] as const,
  messages: (conversationId: string) => [...messagesKeys.all, 'messages', conversationId] as const,
  templates: () => [...messagesKeys.all, 'templates'] as const,
};



