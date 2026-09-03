export type ConversationUnreadTarget =
  | { contactId: string }
  | { conversationId: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function itemMatchesUnreadTarget(
  item: Record<string, unknown>,
  target: ConversationUnreadTarget
): boolean {
  if ('contactId' in target) {
    return item.contactId === target.contactId && item.kind !== 'group';
  }

  if (item.kind === 'group') {
    return item.conversationId === target.conversationId;
  }

  if (Array.isArray(item.conversations)) {
    return item.conversations.some(
      (conversation) => isRecord(conversation) && conversation.id === target.conversationId
    );
  }

  return item.conversationId === target.conversationId || item.id === target.conversationId;
}

export function findUnreadCacheEntry(
  items: unknown,
  target: ConversationUnreadTarget
): { unreadCount: number } | null {
  if (!Array.isArray(items)) return null;
  const match = items.find((item) => isRecord(item) && itemMatchesUnreadTarget(item, target));
  if (!isRecord(match)) return null;
  return { unreadCount: Number(match.unreadCount) || 0 };
}

export function applyUnreadToCachedConversations(
  items: unknown,
  target: ConversationUnreadTarget,
  unread: boolean
): unknown {
  if (!Array.isArray(items)) return items;

  return items.map((item) => {
    if (!isRecord(item) || !itemMatchesUnreadTarget(item, target)) return item;
    const nextUnreadCount = unread ? Math.max(1, Number(item.unreadCount) || 1) : 0;
    if (item.unreadCount === nextUnreadCount) return item;
    return { ...item, unreadCount: nextUnreadCount };
  });
}

export function unreadBadgeDeltaForCache(
  items: unknown,
  target: ConversationUnreadTarget,
  unread: boolean
): number {
  if (!Array.isArray(items)) return 0;

  const match = items.find((item) => isRecord(item) && itemMatchesUnreadTarget(item, target));
  if (!isRecord(match)) return 0;

  const wasUnread = Number(match.unreadCount) > 0;
  if (unread && !wasUnread) return 1;
  if (!unread && wasUnread) return -1;
  return 0;
}
