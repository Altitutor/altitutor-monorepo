import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@altitutor/shared';
import { useSupabaseRealtimeInvalidation } from '@/shared/hooks/useSupabaseRealtimeInvalidation';
import { useProject, useProjects } from '../queries';

jest.mock('@/shared/hooks/useSupabaseRealtimeInvalidation', () => jest.requireActual('@/shared/hooks/useSupabaseRealtimeInvalidation'));
jest.mock('@/shared/lib/supabase/client', () => ({
  useSupabaseClient: () => client,
  getSupabaseClient: () => client,
}));

type Frame = { topic: string; event: string; ref: string; payload: Record<string, unknown> };
const frames: Frame[] = [];
const sockets: Socket[] = [];
class Socket {
  CONNECTING = 0; OPEN = 1; CLOSING = 2; CLOSED = 3;
  readyState = 0;
  protocol = '';
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  url: string;
  constructor(url: string | URL) {
    this.url = String(url);
    sockets.push(this);
    queueMicrotask(() => { this.readyState = 1; this.onopen?.(new Event('open')); });
  }
  addEventListener() {}
  removeEventListener() {}
  close() { this.readyState = 3; }
  send(data: string) {
    const [joinRef, ref, topic, event, payload] = JSON.parse(data) as [string, string, string, string, Record<string, unknown>];
    const frame = { ref, topic, event, payload };
    frames.push(frame);
    if (frame.event === 'phx_join' || frame.event === 'phx_leave') {
      queueMicrotask(() => this.onmessage?.(new MessageEvent('message', { data: JSON.stringify([joinRef, ref, topic, 'phx_reply', { status: 'ok', response: frame.event === 'phx_join' ? { postgres_changes: ((frame.payload.config as { postgres_changes: object[] }).postgres_changes).map((binding) => ({ ...binding, id: 1 })) } : {} }]) })));
    }
  }
}
let client: SupabaseClient<Database>;
const projectId = '00000000-0000-4000-8000-000000000001';
beforeEach(() => {
  frames.length = 0;
  sockets.length = 0;
  client = createClient<Database>('http://localhost:9999', 'synthetic-key', {
    accessToken: async () => 'synthetic-token',
    realtime: { transport: Socket },
    global: { fetch: async () => ({ ok: true, status: 200, statusText: 'OK', headers: new Headers(), text: async () => '[]' }) as Response },
  });
});
afterEach(async () => { await client.removeAllChannels(); client.realtime.disconnect(); });

describe.each(['list', 'detail'] as const)('%s project Realtime lifecycle', (kind) => {
  it('joins each table once across renders, then leaves on unmount', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: React.ReactNode }) =>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
    const { result, rerender, unmount } = renderHook(
      () => kind === 'list' ? useProjects() : useProject(projectId), { wrapper }
    );
    await waitFor(() => { expect(result.current.error).toBeNull(); expect(result.current.isSuccess).toBe(true); });
    for (let n = 0; n < 6; n++) await act(async () => rerender());
    const joins = frames.filter((frame) => frame.event === 'phx_join');
    expect(joins).toHaveLength(2);
    expect(client.getChannels()).toHaveLength(2);
    unmount();
    await waitFor(() => expect(client.getChannels()).toHaveLength(0));
    expect(frames.filter((frame) => frame.event === 'phx_leave')).toHaveLength(2);
    queryClient.clear();
  });
});

it('uses committed new invalidation callbacks without rejoining', async () => {
  const queryClient = new QueryClient();
  queryClient.setQueryData(['old', 'record'], 'cached');
  queryClient.setQueryData(['latest', 'record'], 'cached');
  const wrapper = ({ children }: { children: React.ReactNode }) =>
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  const { rerender, unmount } = renderHook(({ prefix }) => useSupabaseRealtimeInvalidation({
    table: 'projects', queryKey: ['list'], detailKey: (id) => [prefix, id],
  }), { wrapper, initialProps: { prefix: 'old' } });
  await waitFor(() => expect(frames.filter((f) => f.event === 'phx_join')).toHaveLength(1));
  await act(async () => rerender({ prefix: 'latest' }));
  const join = frames.find((f) => f.event === 'phx_join')!;
  await act(async () => sockets.at(-1)!.onmessage?.(new MessageEvent('message', { data: JSON.stringify([
    join.ref, null, join.topic, 'postgres_changes', {
      ids: [1], data: { schema: 'public', table: 'projects', type: 'UPDATE',
        columns: [], record: { id: 'record' }, old_record: {} },
    },
  ]) })));
  expect(queryClient.getQueryState(['latest', 'record'])?.isInvalidated).toBe(true);
  expect(queryClient.getQueryState(['old', 'record'])?.isInvalidated).toBe(false);
  expect(frames.filter((f) => f.event === 'phx_join')).toHaveLength(1);
  unmount();
  queryClient.clear();
});
