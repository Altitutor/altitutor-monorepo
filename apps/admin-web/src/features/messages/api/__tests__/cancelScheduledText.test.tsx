import type { ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import { useCancelScheduledText } from '../mutations';

jest.mock('@/shared/lib/supabase/client', () => ({ getSupabaseClient: jest.fn() }));
jest.mock('@/shared/lib/supabase/auth', () => ({ useAuthStore: jest.fn() }));

function setup(rows: Array<{ id: string }>) {
  const query = {
    update: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    select: jest.fn().mockResolvedValue({ data: rows, error: null }),
  };
  jest.mocked(getSupabaseClient).mockReturnValue({
    from: jest.fn(() => query),
  } as unknown as ReturnType<typeof getSupabaseClient>);

  const client = new QueryClient();
  const refresh = jest.spyOn(client, 'invalidateQueries');
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  const { result } = renderHook(() => useCancelScheduledText(), { wrapper: Wrapper });
  return {
    cancel: () => result.current.mutateAsync({
      messageId: 'message', conversationId: 'conversation', contactId: 'contact',
    }),
    query,
    refresh,
  };
}

it('cancels and refreshes a pending text', async () => {
  const { cancel, query, refresh } = setup([{ id: 'message' }]);
  await act(async () => { await cancel(); });
  expect(query.update).toHaveBeenCalledWith({ status: 'CANCELED' });
  expect(query.eq.mock.calls).toEqual([['id', 'message'], ['status', 'SCHEDULED']]);
  expect(refresh).toHaveBeenCalled();
});

it('reports when dispatch wins the race with cancellation', async () => {
  const { cancel, refresh } = setup([]);
  await act(async () => {
    await expect(cancel()).rejects.toThrow('This text is no longer scheduled.');
  });
  expect(refresh).toHaveBeenCalled();
});
