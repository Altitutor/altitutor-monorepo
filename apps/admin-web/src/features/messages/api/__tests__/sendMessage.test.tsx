import type { ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import { useAuthStore, type User } from '@/shared/lib/supabase/auth';
import { useSendMessage } from '../mutations';

jest.mock('@/shared/lib/supabase/client', () => ({ getSupabaseClient: jest.fn() }));

function query(data: unknown, error: unknown = null) {
  const result = Object.assign(Promise.resolve({ data, error }), {
    select: jest.fn(), eq: jest.fn(), insert: jest.fn(), update: jest.fn(),
    single: jest.fn(), maybeSingle: jest.fn(),
  });
  for (const method of [result.select, result.eq, result.insert, result.update, result.single, result.maybeSingle]) method.mockReturnValue(result);
  return result;
}

it('dispatches the queued message even when clearing its assignment fails', async () => {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  useAuthStore.setState({ user: { id: 'user' } as User });
  const invoke = jest.fn().mockResolvedValue({ data: {}, error: null });
  const warning = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  jest.mocked(getSupabaseClient).mockReturnValue({
    from: jest.fn((table: string) => {
      if (table === 'staff') return query({ id: 'staff' });
      if (table === 'owned_numbers') return query({ id: 'sender', provider: 'IMESSAGE', sender_type: 'PHONE', phone_e164: '+61400000000' });
      if (table === 'messages') return query({ id: 'message' });
      if (table === 'conversations') return query(null, { message: 'Assignment temporarily unavailable' });
      return query(null);
    }),
    functions: { invoke },
  } as unknown as ReturnType<typeof getSupabaseClient>);
  const { result } = renderHook(() => useSendMessage(), { wrapper: Wrapper });
  try {
    await act(async () => {
      await expect(result.current.mutateAsync({ conversationId: 'conversation', groupChatId: 'group', body: 'Hello', selectedSenderId: 'sender' }))
        .resolves.toEqual({ messageId: 'message', conversationId: 'conversation' });
    });
    expect(invoke).toHaveBeenCalledWith('send-message', { body: { messageId: 'message' } });
  } finally {
    warning.mockRestore();
    client.clear();
  }
});
