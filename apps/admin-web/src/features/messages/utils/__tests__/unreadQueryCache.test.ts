import { QueryClient } from '@tanstack/react-query';
import { messagesKeys } from '../../api/queryKeys';
import { findUnreadCacheEntry } from '../conversationUnreadCache';
import {
  applyOptimisticUnread,
  markUnreadQueriesStale,
} from '../unreadQueryCache';

const listKey = [...messagesKeys.conversationsByContact(null), 'including-groups'] as const;

const unreadContact = {
  kind: 'contact' as const,
  contactId: 'c-1',
  unreadCount: 1,
  conversations: [{ id: 'conv-a' }],
};

describe('unread query cache', () => {
  it('keeps the optimistic read state when settlement does not refetch', async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    qc.setQueryData(listKey, [unreadContact]);
    qc.setQueryData(messagesKeys.unreadCount(), 3);

    await applyOptimisticUnread(qc, { contactId: 'c-1' }, false);
    markUnreadQueriesStale(qc);

    expect(findUnreadCacheEntry(qc.getQueryData(listKey), { contactId: 'c-1' })).toEqual({
      unreadCount: 0,
    });
    expect(qc.getQueryData(messagesKeys.unreadCount())).toBe(2);
  });

  it('lets a refetch of stale server data snap the optimistic row back', async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const serverRow = { ...unreadContact };
    qc.setQueryData(listKey, [serverRow]);
    await qc.fetchQuery({
      queryKey: listKey,
      queryFn: async () => [{ ...serverRow }],
    });

    await applyOptimisticUnread(qc, { contactId: 'c-1' }, false);
    expect(findUnreadCacheEntry(qc.getQueryData(listKey), { contactId: 'c-1' })?.unreadCount).toBe(0);

    await qc.invalidateQueries({
      queryKey: messagesKeys.conversationsByContactBase(),
      refetchType: 'all',
    });

    expect(findUnreadCacheEntry(qc.getQueryData(listKey), { contactId: 'c-1' })?.unreadCount).toBe(1);
  });
});
