import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@altitutor/shared';
import { useSupabaseRealtimeInvalidation } from '@/shared/hooks/useSupabaseRealtimeInvalidation';
import { useProject, useProjects } from '../queries';
import { useAuthStore } from '@/shared/lib/supabase/auth';

jest.mock('@/shared/hooks/useSupabaseRealtimeInvalidation', () => jest.requireActual('@/shared/hooks/useSupabaseRealtimeInvalidation'));
jest.mock('@/shared/lib/supabase/client', () => ({
  useSupabaseClient: () => client,
  getSupabaseClient: () => client,
}));

type Frame = { topic: string; event: string; ref: string; payload: Record<string, unknown> };
const frames: Frame[] = [];
const sockets: Socket[] = [];
const reads: string[] = [];
let projectName = 'Before update';
let gateRead: ((url: URL) => Promise<void> | undefined) | undefined;
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
  reads.length = 0;
  projectName = 'Before update';
  gateRead = undefined;
  useAuthStore.getState().setUser(null);
  client = createClient<Database>('http://localhost:9999', 'synthetic-key', {
    accessToken: async () => 'synthetic-token',
    realtime: { transport: Socket, reconnectAfterMs: () => 10 },
    global: { fetch: async (input) => {
      const url = String(input);
      reads.push(url);
      const parsed = new URL(url);
      const project = { id: projectId, name: projectName };
      const data = parsed.pathname.endsWith('/projects')
        ? (parsed.searchParams.has('id') ? project : [project]) : [];
      await gateRead?.(parsed);
      return { ok: true, status: 200, statusText: 'OK', headers: new Headers(), text: async () => JSON.stringify(data) } as Response;
    } },
  });
});

function change(table: string, type = 'UPDATE') {
  for (const join of frames.filter((frame) => frame.event === 'phx_join'
    && (frame.payload.config as { postgres_changes: { table: string }[] }).postgres_changes[0]?.table === table)) {
    sockets.at(-1)!.onmessage?.(new MessageEvent('message', { data: JSON.stringify([
      join.ref, null, join.topic, 'postgres_changes', {
        ids: [1], data: { schema: 'public', table, type, columns: [],
          record: { id: projectId, project_id: projectId }, old_record: { id: projectId } },
      },
    ]) }));
  }
}
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

it('shares live project updates between mounted list and detail readers', async () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: React.ReactNode }) =>
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  const list = renderHook(() => useProjects(), { wrapper });
  const detail = renderHook(() => useProject(projectId), { wrapper });
  await waitFor(() => {
    expect(list.result.current.isSuccess).toBe(true);
    expect(detail.result.current.isSuccess).toBe(true);
  });
  expect(frames.filter((frame) => frame.event === 'phx_join')).toHaveLength(2);
  list.unmount();
  expect(client.getChannels()).toHaveLength(2);
  await act(async () => { projectName = 'Still live in detail'; change('projects'); });
  await waitFor(() => expect(detail.result.current.data?.name).toBe('Still live in detail'));
  detail.unmount();
  await waitFor(() => expect(client.getChannels()).toHaveLength(0));
  queryClient.clear();
});

it('refreshes mounted list and detail once for an overlapping project/member burst', async () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: React.ReactNode }) =>
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  const { result, unmount } = renderHook(() => ({ list: useProjects(), detail: useProject(projectId) }), { wrapper });
  await waitFor(() => {
    expect(result.current.list.data?.[0]?.name).toBe('Before update');
    expect(result.current.detail.data?.name).toBe('Before update');
  });
  await act(async () => {
    projectName = 'Updated in both views';
    change('projects');
    change('project_members');
  });
  await waitFor(() => {
    expect(result.current.list.data?.[0]?.name).toBe('Updated in both views');
    expect(result.current.detail.data?.name).toBe('Updated in both views');
  });
  expect(reads.filter((url) => new URL(url).pathname.endsWith('/projects'))).toHaveLength(4);
  unmount();
  queryClient.clear();
});

it('releases the previous actor subscription before rejoining for a new actor', async () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: React.ReactNode }) =>
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  const { result, unmount } = renderHook(() => useProjects(), { wrapper });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  await act(async () => useAuthStore.getState().setUser({
    id: '00000000-0000-4000-8000-000000000002', aud: 'authenticated',
    created_at: '2026-11-23T00:00:00Z', app_metadata: {}, user_metadata: {},
  }));
  await waitFor(() => expect(frames.filter((frame) => frame.event === 'phx_leave')).toHaveLength(2));
  expect(frames.filter((frame) => frame.event === 'phx_join')).toHaveLength(4);
  expect(client.getChannels()).toHaveLength(2);
  unmount();
  queryClient.clear();
});

it('recovers changes missed while the project channel was disconnected', async () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: React.ReactNode }) =>
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  const { result, unmount } = renderHook(() => useProjects(), { wrapper });
  await waitFor(() => expect(result.current.data?.[0]?.name).toBe('Before update'));
  const join = frames.find((frame) => frame.event === 'phx_join'
    && (frame.payload.config as { postgres_changes: { table: string }[] }).postgres_changes[0]?.table === 'projects')!;
  await act(async () => {
    projectName = 'Changed while disconnected';
    sockets.at(-1)!.onmessage?.(new MessageEvent('message', { data: JSON.stringify([
      join.ref, null, join.topic, 'phx_error', {},
    ]) }));
  });
  await waitFor(() => expect(frames.filter((frame) => frame.event === 'phx_join')).toHaveLength(3));
  await waitFor(() => expect(result.current.data?.[0]?.name).toBe('Changed while disconnected'));
  unmount();
  queryClient.clear();
});

it('keeps a trailing authoritative read when changes overlap an existing request', async () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: React.ReactNode }) =>
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  const { result, unmount } = renderHook(() => useProjects(), { wrapper });
  await waitFor(() => expect(result.current.data?.[0]?.name).toBe('Before update'));
  let held = false;
  let release = () => {};
  gateRead = (url) => {
    if (!held && url.pathname.endsWith('/projects')) {
      held = true;
      return new Promise<void>((resolve) => { release = resolve; });
    }
    return undefined;
  };
  let request: Promise<unknown> | undefined;
  act(() => { request = result.current.refetch(); });
  await waitFor(() => expect(held).toBe(true));
  await act(async () => {
    projectName = 'Changed during the request';
    for (let n = 0; n < 10; n++) change('projects');
    await new Promise((resolve) => setTimeout(resolve, 550));
  });
  await act(async () => { release(); await request; });
  await waitFor(() => expect(result.current.data?.[0]?.name).toBe('Changed during the request'));
  expect(reads.filter((url) => new URL(url).pathname.endsWith('/projects'))).toHaveLength(3);
  unmount();
  queryClient.clear();
});

it('keeps the coalescing window when further changes arrive during its own refresh', async () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: React.ReactNode }) =>
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  const { result, unmount } = renderHook(() => useProjects(), { wrapper });
  await waitFor(() => expect(result.current.data?.[0]?.name).toBe('Before update'));
  let held = false;
  let release = () => {};
  gateRead = (url) => {
    if (!held && url.pathname.endsWith('/projects')) {
      held = true;
      return new Promise<void>((resolve) => { release = resolve; });
    }
    return undefined;
  };
  await act(async () => { change('projects'); });
  await waitFor(() => expect(held).toBe(true));
  await act(async () => {
    projectName = 'Final burst state';
    for (let n = 0; n < 10; n++) change('projects');
    release();
    await new Promise((resolve) => setTimeout(resolve, 100));
  });
  expect(reads.filter((url) => new URL(url).pathname.endsWith('/projects'))).toHaveLength(2);
  await waitFor(() => expect(result.current.data?.[0]?.name).toBe('Final burst state'));
  expect(reads.filter((url) => new URL(url).pathname.endsWith('/projects'))).toHaveLength(3);
  unmount();
  queryClient.clear();
});

it('drops pending refreshes when the final reader unmounts', async () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: React.ReactNode }) =>
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  const { result, unmount } = renderHook(() => useProjects(), { wrapper });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  await act(async () => { change('projects'); });
  unmount();
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 550)); });
  expect(reads.filter((url) => new URL(url).pathname.endsWith('/projects'))).toHaveLength(1);
  expect(client.getChannels()).toHaveLength(0);
  queryClient.clear();
});

it('keeps separate query caches independently subscribed and fresh', async () => {
  const firstCache = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const secondCache = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const first = renderHook(() => useProjects(), { wrapper: ({ children }) =>
    <QueryClientProvider client={firstCache}>{children}</QueryClientProvider> });
  const second = renderHook(() => useProjects(), { wrapper: ({ children }) =>
    <QueryClientProvider client={secondCache}>{children}</QueryClientProvider> });
  await waitFor(() => {
    expect(first.result.current.isSuccess).toBe(true);
    expect(second.result.current.isSuccess).toBe(true);
  });
  expect(client.getChannels()).toHaveLength(4);
  first.unmount();
  expect(client.getChannels()).toHaveLength(2);
  await act(async () => { projectName = 'Second cache stays live'; change('projects'); });
  await waitFor(() => expect(second.result.current.data?.[0]?.name).toBe('Second cache stays live'));
  second.unmount();
  firstCache.clear();
  secondCache.clear();
});

it('stays responsive when a detail reader closes during a request and rejoins with fresh data', async () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 60_000 } } });
  const wrapper = ({ children }: { children: React.ReactNode }) =>
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  const list = renderHook(() => useProjects(), { wrapper });
  const detail = renderHook(() => useProject(projectId), { wrapper });
  await waitFor(() => {
    expect(list.result.current.data?.[0]?.name).toBe('Before update');
    expect(detail.result.current.data?.name).toBe('Before update');
  });
  let held = false;
  let release = () => {};
  gateRead = (url) => {
    if (!held && url.pathname.endsWith('/projects') && url.searchParams.has('id')) {
      held = true;
      return new Promise<void>((resolve) => { release = resolve; });
    }
    return undefined;
  };
  let request: Promise<unknown> | undefined;
  act(() => { request = detail.result.current.refetch(); });
  await waitFor(() => expect(held).toBe(true));
  detail.unmount();
  // Bound a broken scheduler so this responsiveness regression fails rather
  // than hanging the entire test process and starving its watchdog timers.
  const enqueue = globalThis.queueMicrotask;
  let microtasks = 0;
  let exhausted = false;
  const scheduler = jest.spyOn(globalThis, 'queueMicrotask').mockImplementation((task) => {
    if (++microtasks > 100) { exhausted = true; throw new Error('Microtask work budget exceeded'); }
    enqueue(task);
  });
  let rejoined: ReturnType<typeof renderHook<ReturnType<typeof useProject>, unknown>> | undefined;
  try {
    await act(async () => { projectName = 'Fresh after navigation'; change('projects'); });
    await waitFor(() => expect(list.result.current.data?.[0]?.name).toBe('Fresh after navigation'));
    await act(async () => { release(); await request; });
    rejoined = renderHook(() => useProject(projectId), { wrapper });
    await waitFor(() => expect(rejoined?.result.current.data?.name).toBe('Fresh after navigation'));
    expect(exhausted).toBe(false);
  } finally {
    release();
    scheduler.mockRestore();
    rejoined?.unmount();
    list.unmount();
    queryClient.clear();
  }
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
