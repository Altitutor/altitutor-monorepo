import { fetchConversationList } from '../queries';
import { getSupabaseClient } from '@/shared/lib/supabase/client';

jest.mock('@/shared/lib/supabase/client', () => ({ getSupabaseClient: jest.fn() }));

function queryResult(data: unknown) {
  const query = Object.assign(Promise.resolve({ data, error: null }), {
    select: jest.fn(), in: jest.fn(), order: jest.fn(), limit: jest.fn(), abortSignal: jest.fn(),
  });
  for (const method of [query.select, query.in, query.order, query.limit, query.abortSignal]) {
    method.mockReturnValue(query);
  }
  return query;
}

it.each(['QUEUED', 'FAILED', 'UNDELIVERED'])('retains contact and group unread state with an outbound %s preview', async (status) => {
  const baseConversation = {
    status: 'OPEN', last_message_at: '2026-10-03T01:00:00Z', last_message_direction: 'OUTBOUND',
    owned_number_id: 'number', owned_numbers: null, conversation_reads: [], group_chat_participants: [],
  };
  const conversations = [
    { ...baseConversation, id: 'contact-thread', contact_id: 'contact', last_message_id: 'contact-message',
      is_group_chat: false, contacts: { id: 'contact', students: { first_name: 'Ada' } } },
    { ...baseConversation, id: 'group-thread', contact_id: null, last_message_id: 'group-message',
      is_group_chat: true, group_chat_id: 'group', group_chat_name: 'Study group', contacts: null },
  ];
  const messages = ['contact', 'group'].map((kind) => ({
    id: `${kind}-message`, conversation_id: `${kind}-thread`, body: 'Reply', direction: 'OUTBOUND', status,
    is_reaction: false, staff: { first_name: 'Grace' }, message_attachments: [],
  }));
  const rpc = jest.fn(() => queryResult(['contact-thread', 'group-thread']));
  jest.mocked(getSupabaseClient).mockReturnValue({
    from: jest.fn((table) => queryResult(table === 'conversations' ? conversations : messages)), rpc,
  } as unknown as ReturnType<typeof getSupabaseClient>);

  const result = await fetchConversationList();
  expect(result).toHaveLength(2);
  expect(result.every((conversation) => conversation.unreadCount === 1)).toBe(true);
  expect(result.every((conversation) => conversation.latestMessage?.preview?.direction === 'OUTBOUND')).toBe(true);
  expect(rpc).toHaveBeenCalledWith('get_unread_message_conversation_ids', {
    p_conversation_ids: ['contact-thread', 'group-thread'],
  });
});
