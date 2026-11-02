import React, { type ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { focusManager, onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { queryClient as applicationClient } from '@/shared/lib/react-query/client';
import { useResourceSignedFileUrl } from '../useResources';

let mockUnavailable = false;
let mockSuccesses = 0;
const mockSign = jest.fn(async () => {
  if (mockUnavailable) return { data: null, error: new Error('Synthetic offline') };
  mockSuccesses += 1;
  return { data: { signedUrl: `https://synthetic.invalid/pdf-${mockSuccesses}` }, error: null };
});
jest.mock('@/shared/lib/supabase/client', () => ({
  getSupabaseClient: () => ({
    from: () => {
      const query = {
        select: () => query, eq: () => query, ilike: () => query,
        maybeSingle: async () => ({ data: {
          id: 'resource', topic_id: 'topic', code: '1N.1', type: 'NOTES',
          index: 1, filename: 'Synthetic.pdf', mimetype: 'application/pdf',
          storage_path: 'subject/topic/synthetic.pdf', bucket: 'resources', external_url: null,
        }, error: null }),
      };
      return query;
    },
    storage: { from: () => ({ createSignedUrl: mockSign }) },
  }),
}));
function wrapper() {
  const client = new QueryClient({ defaultOptions: applicationClient.getDefaultOptions() });
  return function Provider({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}
beforeEach(() => {
  jest.useFakeTimers();
  mockUnavailable = false;
  mockSuccesses = 0;
  mockSign.mockClear();
  onlineManager.setOnline(true);
  focusManager.setFocused(true);
});
afterEach(() => { onlineManager.setOnline(true); focusManager.setFocused(undefined); jest.useRealTimers(); });

it('renews by credential age when still-fresh cache is remounted at minute 41', async () => {
  const startedAt = Date.now();
  const Provider = wrapper();
  const first = renderHook(() => useResourceSignedFileUrl('topic', '1N.1'), { wrapper: Provider });
  await waitFor(() => expect(first.result.current.data).toBe('https://synthetic.invalid/pdf-1'));
  await act(async () => { await jest.advanceTimersByTimeAsync(40 * 60_000 - (Date.now() - startedAt)); });
  first.unmount();
  await act(async () => { await jest.advanceTimersByTimeAsync(60_000); });
  const second = renderHook(() => useResourceSignedFileUrl('topic', '1N.1'), { wrapper: Provider });
  expect(second.result.current.data).toBe('https://synthetic.invalid/pdf-1');
  await act(async () => { await jest.advanceTimersByTimeAsync(9 * 60_000 + 100); });
  await waitFor(() => expect(second.result.current.data).toBe('https://synthetic.invalid/pdf-2'));
  expect(mockSign).toHaveBeenCalledTimes(2);
});

it('recovers on reconnect after all real application renewal retries fail', async () => {
  const startedAt = Date.now();
  const view = renderHook(() => useResourceSignedFileUrl('topic', '1N.1'), { wrapper: wrapper() });
  await waitFor(() => expect(view.result.current.data).toBe('https://synthetic.invalid/pdf-1'));
  expect(view.result.current.isError).toBe(false);
  mockUnavailable = true;
  await act(async () => { await jest.advanceTimersByTimeAsync(50 * 60_000 - (Date.now() - startedAt) + 8_000); });
  await waitFor(() => expect(view.result.current.isError).toBe(true));
  expect(mockSign).toHaveBeenCalledTimes(5); // initial success, then 1 request + 3 retries
  mockUnavailable = false;
  await act(async () => { onlineManager.setOnline(false); onlineManager.setOnline(true); });
  await waitFor(() => expect(view.result.current.data).toBe('https://synthetic.invalid/pdf-2'));
});

it('backs off exhausted background renewal before trying again without a reconnect', async () => {
  const startedAt = Date.now();
  const view = renderHook(() => useResourceSignedFileUrl('topic', '1N.1'), { wrapper: wrapper() });
  await waitFor(() => expect(view.result.current.data).toBe('https://synthetic.invalid/pdf-1'));
  expect(view.result.current.isError).toBe(false);
  mockUnavailable = true;
  await act(async () => { await jest.advanceTimersByTimeAsync(50 * 60_000 - (Date.now() - startedAt) + 8_000); });
  await waitFor(() => expect(view.result.current.isError).toBe(true));
  const failedAt = view.result.current.errorUpdatedAt;
  expect(mockSign).toHaveBeenCalledTimes(5);
  await act(async () => { await jest.advanceTimersByTimeAsync(59_999 - (Date.now() - failedAt)); });
  expect(mockSign).toHaveBeenCalledTimes(5);
  mockUnavailable = false;
  await act(async () => { await jest.advanceTimersByTimeAsync(1_001); });
  await waitFor(() => expect(view.result.current.data).toBe('https://synthetic.invalid/pdf-2'));
  expect(mockSign).toHaveBeenCalledTimes(6);
});
