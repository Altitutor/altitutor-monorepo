import React from 'react';
import { act, render, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider, QueryObserver } from '@tanstack/react-query';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { AuthProvider } from '../AuthProvider';

let authChange: (event: AuthChangeEvent, session: Session | null) => void;
const mockSetUser = jest.fn();
const mockSetLoading = jest.fn();
const mockSupabase = {
  auth: {
    getSession: jest.fn().mockResolvedValue({ data: { session: null }, error: null }),
    onAuthStateChange: jest.fn((callback) => {
      authChange = callback;
      return { data: { subscription: { unsubscribe: jest.fn() } } };
    }),
  },
};

jest.mock('@sentry/nextjs', () => ({ setUser: jest.fn() }));
jest.mock('@/shared/lib/supabase/client', () => ({ useSupabaseClient: () => mockSupabase }));
jest.mock('@/shared/lib/supabase/auth', () => ({
  useAuthStore: () => ({ setUser: mockSetUser, setLoading: mockSetLoading }),
}));

it('discards a delayed pre-restore empty profile after the refreshed session arrives', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const screen = render(<QueryClientProvider client={client}><AuthProvider><div /></AuthProvider></QueryClientProvider>);
  await waitFor(() => expect(mockSupabase.auth.onAuthStateChange).toHaveBeenCalled());
  let resolveOld!: (profile: null) => void;
  const oldResponse = new Promise<null>(resolve => { resolveOld = resolve; });
  const profile = { id: 'original-student' };
  const queryFn = jest.fn().mockReturnValueOnce(oldResponse).mockResolvedValue(profile);
  const observer = new QueryObserver(client, { queryKey: ['student', 'profile'], queryFn });
  const unsubscribe = observer.subscribe(() => {});
  expect(queryFn).toHaveBeenCalledTimes(1);
  try {
    await act(async () => {
      authChange('TOKEN_REFRESHED', { user: { id: 'original-user' } } as Session);
      await Promise.resolve();
      resolveOld(null);
      await oldResponse;
    });
    await waitFor(() => expect(client.getQueryData(['student', 'profile'])).toEqual(profile));
    expect(queryFn).toHaveBeenCalledTimes(2);
  } finally {
    resolveOld(null);
    unsubscribe();
    screen.unmount();
    client.clear();
  }
});
