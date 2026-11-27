import type { ReactNode } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { getSupabaseClient } from '@/shared/lib/supabase/client';
import { useMessages, useMessagesForContact } from '../queries';
import { isSystemOutboundMessage } from '../../utils/conversationPreview';

jest.mock('@/shared/lib/supabase/client', () => ({ getSupabaseClient: jest.fn() }));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

function messagesQuery(data: unknown[]) {
  const query = Object.assign(Promise.resolve({ data, error: null }), {
    select: jest.fn(),
    eq: jest.fn(),
    is: jest.fn(),
    not: jest.fn(),
    or: jest.fn(),
    order: jest.fn(),
    limit: jest.fn(),
    neq: jest.fn(),
    in: jest.fn(),
    lt: jest.fn(),
  });
  for (const method of [query.select, query.eq, query.is, query.not, query.or, query.order, query.limit, query.neq, query.in, query.lt]) {
    method.mockReturnValue(query);
  }
  return query;
}

it('enriches conversation-id messages with their sender for system attribution', async () => {
  const messageQuery = messagesQuery([{
    id: 'message',
    conversation_id: 'conversation',
    direction: 'OUTBOUND',
    status: 'QUEUED',
    imessage_temp_guid: null,
    staff: null,
    message_attachments: [],
    created_at: '2026-10-14T00:00:00Z',
  }]);
  const maybeSingle = jest.fn().mockResolvedValue({
    data: {
      owned_number_id: 'sender',
      owned_numbers: {
        id: 'sender',
        provider: 'IMESSAGE',
        phone_e164: '+61400000000',
        alphanumeric_sender_id: null,
        sender_type: 'PHONE',
        label: 'iMessage',
      },
    },
    error: null,
  });
  const conversationQuery = {
    select: jest.fn(),
    eq: jest.fn(),
    maybeSingle,
  };
  conversationQuery.select.mockReturnValue(conversationQuery);
  conversationQuery.eq.mockReturnValue(conversationQuery);
  const scheduledQuery = messagesQuery([{
    id: 'scheduled',
    conversation_id: 'conversation',
    direction: 'OUTBOUND',
    status: 'SCHEDULED',
    created_at: '2026-07-14T00:00:00Z',
    scheduled_at: '2026-11-14T00:00:00Z',
  }]);
  jest.mocked(getSupabaseClient).mockReturnValue({
    from: jest.fn()
      .mockReturnValueOnce(conversationQuery)
      .mockReturnValueOnce(messageQuery)
      .mockReturnValueOnce(messagesQuery([]))
      .mockReturnValueOnce(scheduledQuery),
  } as unknown as ReturnType<typeof getSupabaseClient>);

  const { result } = renderHook(() => useMessages('conversation'), { wrapper: createWrapper() });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));

  const items = result.current.data?.pages[0].items ?? [];
  expect(items.map((message) => message.id)).toEqual(['scheduled', 'message']);
  expect(messageQuery.is).toHaveBeenCalledWith('scheduled_at', null);
  expect(scheduledQuery.eq).toHaveBeenCalledWith('status', 'SCHEDULED');
  const message = items[1];
  expect(message?.sender?.provider).toBe('IMESSAGE');
  expect(message?.conversation_owned_number_id).toBe('sender');
  expect(isSystemOutboundMessage(message?.staff, {
    provider: message?.sender?.provider,
    imessageTempGuid: message?.imessage_temp_guid,
    status: message?.status,
  })).toBe(true);
});


it('includes older-created pending texts across all the contact’s sender threads', async () => {
  const conversations = messagesQuery([
    { id: 'sms', owned_number_id: 'a', owned_numbers: { provider: 'TWILIO' } },
    { id: 'apple', owned_number_id: 'b', owned_numbers: { provider: 'IMESSAGE' } },
  ]);
  const history = messagesQuery([{ id: 'sent', conversation_id: 'sms', created_at: '2026-11-01T00:00:00Z' }]);
  const released = messagesQuery([{
    id: 'recently-dispatched', conversation_id: 'apple', created_at: '2026-07-01T00:00:00Z',
    scheduled_at: '2026-11-02T00:00:00Z', scheduled_dispatch_at: '2026-11-02T00:05:00Z', status: 'SENDING',
  }]);
  const scheduled = messagesQuery([{
    id: 'later', conversation_id: 'apple', created_at: '2026-10-01T00:00:00Z',
    scheduled_at: '2026-11-30T00:00:00Z', status: 'SCHEDULED',
  }]);
  jest.mocked(getSupabaseClient).mockReturnValue({
    from: jest.fn().mockReturnValueOnce(conversations).mockReturnValueOnce(history).mockReturnValueOnce(released).mockReturnValueOnce(scheduled),
  } as unknown as ReturnType<typeof getSupabaseClient>);

  const { result } = renderHook(() => useMessagesForContact('contact'), { wrapper: createWrapper() });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(scheduled.in).toHaveBeenCalledWith('conversation_id', ['sms', 'apple']);
  expect(result.current.data?.pages[0].items.map((message) => [message.id, message.sender?.provider]))
    .toEqual([['later', 'IMESSAGE'], ['recently-dispatched', 'IMESSAGE'], ['sent', 'TWILIO']]);
});
