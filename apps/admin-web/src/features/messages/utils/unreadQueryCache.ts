import type { QueryClient } from '@tanstack/react-query';
import { messagesKeys } from '../api/queryKeys';
import {
  applyUnreadToCachedConversations,
  findUnreadCacheEntry,
  type ConversationUnreadTarget,
} from './conversationUnreadCache';

export type UnreadCacheSnapshot = {
  previousLists: Array<readonly [unknown, unknown]>;
  previousUnread: number | undefined;
};

export async function applyOptimisticUnread(
  qc: QueryClient,
  target: ConversationUnreadTarget,
  unread: boolean
): Promise<UnreadCacheSnapshot> {
  await Promise.all([
    qc.cancelQueries({ queryKey: messagesKeys.conversationsByContactBase() }),
    qc.cancelQueries({ queryKey: messagesKeys.unreadCount() }),
    qc.cancelQueries({ queryKey: messagesKeys.conversations() }),
  ]);

  const previousLists = qc.getQueriesData({ queryKey: messagesKeys.conversationsByContactBase() });
  const previousUnread = qc.getQueryData<number>(messagesKeys.unreadCount());

  let badgeDelta = 0;
  for (const [, data] of previousLists) {
    const entry = findUnreadCacheEntry(data, target);
    if (!entry) continue;
    const wasUnread = entry.unreadCount > 0;
    if (unread && !wasUnread) badgeDelta = 1;
    if (!unread && wasUnread) badgeDelta = -1;
    break;
  }

  qc.setQueriesData(
    { queryKey: messagesKeys.conversationsByContactBase() },
    (old) => applyUnreadToCachedConversations(old, target, unread)
  );
  qc.setQueryData(
    messagesKeys.unreadCount(),
    Math.max(0, (previousUnread ?? 0) + badgeDelta)
  );

  return { previousLists, previousUnread };
}

export function restoreUnreadCache(qc: QueryClient, snapshot?: UnreadCacheSnapshot) {
  if (!snapshot) return;
  for (const [queryKey, data] of snapshot.previousLists) {
    qc.setQueryData(queryKey as readonly unknown[], data);
  }
  qc.setQueryData(messagesKeys.unreadCount(), snapshot.previousUnread);
}

/**
 * Mark inbox unread queries stale without refetching mounted ones.
 * A refetch here races the conversation_reads write and snaps the UI back.
 */
export function markUnreadQueriesStale(qc: QueryClient) {
  void qc.invalidateQueries({ queryKey: messagesKeys.conversations(), refetchType: 'none' });
  void qc.invalidateQueries({
    queryKey: messagesKeys.conversationsByContactBase(),
    refetchType: 'none',
  });
  void qc.invalidateQueries({ queryKey: messagesKeys.unreadCount(), refetchType: 'none' });
}
