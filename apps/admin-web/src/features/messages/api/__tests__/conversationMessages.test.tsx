import type { ReactNode } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { getSupabaseClient } from '@/shared/lib/supabase/client';
import { useMessages } from '../queries';
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
    order: jest.fn(),
    limit: jest.fn(),
    lt: jest.fn(),
  });
  for (const method of [query.select, query.eq, query.order, query.limit, query.lt]) {
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
  jest.mocked(getSupabaseClient).mockReturnValue({
    from: jest.fn((table) => table === 'messages' ? messageQuery : conversationQuery),
  } as unknown as ReturnType<typeof getSupabaseClient>);

  const { result } = renderHook(() => useMessages('conversation'), { wrapper: createWrapper() });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));

  const message = result.current.data?.pages[0].items[0];
  expect(message?.sender?.provider).toBe('IMESSAGE');
  expect(message?.conversation_owned_number_id).toBe('sender');
  expect(isSystemOutboundMessage(message?.staff, {
    provider: message?.sender?.provider,
    imessageTempGuid: message?.imessage_temp_guid,
    status: message?.status,
  })).toBe(true);
});
