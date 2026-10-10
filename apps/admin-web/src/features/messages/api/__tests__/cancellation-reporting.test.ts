/** @jest-environment node */
import * as Sentry from '@sentry/nextjs';
import { createClient } from '@supabase/supabase-js';
import { QueryClient, QueryObserver } from '@tanstack/react-query';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import { instrumentSupabaseClient } from '@/lib/sentry/instrument-supabase-client';
import { fetchConversationList, fetchUnreadConversationCount } from '../queries';
import { queryClient as adminQueryClient } from '@/shared/lib/react-query/client';

jest.mock('@/shared/lib/supabase/client', () => ({ getSupabaseClient: jest.fn() }));
const events: Sentry.ErrorEvent[] = [];
const originalDsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
beforeAll(() => {
  process.env.NEXT_PUBLIC_SENTRY_DSN = 'https://public@sentry.example/1';
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN, defaultIntegrations: false,
    tracesSampleRate: 0, sendClientReports: false,
    transport: () => ({
      send: async () => { throw new Error('Offline test must not send telemetry'); },
      flush: async () => true,
    }),
    beforeSend: (event) => { events.push(event); return null; },
  });
});

it.each(['Fetch is aborted', 'The operation was aborted.'])('retains an inbox abort with an active caller signal: %s', async (message) => {
  useClient(async () => { throw new DOMException(message, 'AbortError'); });
  const controller = new AbortController();
  await expect(fetchConversationList(null, controller.signal)).rejects.toMatchObject({ message: `AbortError: ${message}`, cause: { name: 'AbortError' } });
  await Sentry.flush(1000);
  expect(events).toHaveLength(1);
  expect(events[0].tags?.['inbox.operation']).toBe('conversation-list');
  expect(events[0].exception?.values?.[0].value).toBe(message);
});

it('retains a timeout even if fetch rejects with AbortError', async () => {
  const controller = new AbortController();
  useClient(async () => {
    controller.abort(new DOMException('Request timed out', 'TimeoutError'));
    throw new DOMException('The operation was aborted.', 'AbortError');
  });
  await expect(fetchConversationList(null, controller.signal)).rejects.toMatchObject({ cause: { name: 'AbortError' } });
  await Sentry.flush(1000);
  expect(events).toHaveLength(1);
});

it('retains a database failure that races with cancellation', async () => {
  const controller = new AbortController();
  useClient(async () => {
    controller.abort();
    return new Response(JSON.stringify({ code: '42501', message: 'permission denied for table conversations' }), {
      status: 403, headers: { 'content-type': 'application/json' },
    });
  });
  await expect(fetchConversationList(null, controller.signal)).rejects.toMatchObject({ code: '42501' });
  await Sentry.flush(1000);
  expect(events).toHaveLength(1);
  expect(events[0].exception?.values?.[0].value).toContain('permission denied');
});

it('retains an unexpected unread-count RPC failure once', async () => {
  useClient(async () => new Response(JSON.stringify({ code: 'XX000', message: 'Unexpected database failure' }), {
    status: 500, headers: { 'content-type': 'application/json' },
  }));
  await expect(fetchUnreadConversationCount(new AbortController().signal)).rejects.toMatchObject({ code: 'XX000' });
  await Sentry.flush(1000);
  expect(events).toHaveLength(1);
  expect(events[0].tags?.['inbox.operation']).toBe('unread-count');
});
beforeEach(() => { events.length = 0; });
afterAll(async () => {
  await Sentry.close();
  if (originalDsn === undefined) delete process.env.NEXT_PUBLIC_SENTRY_DSN;
  else process.env.NEXT_PUBLIC_SENTRY_DSN = originalDsn;
});

function useClient(fetch: typeof globalThis.fetch) {
  const client = instrumentSupabaseClient(createClient('https://database.example', 'fixture-key', {
    auth: { persistSession: false, autoRefreshToken: false }, global: { fetch },
  }));
  jest.mocked(getSupabaseClient).mockReturnValue(client as unknown as ReturnType<typeof getSupabaseClient>);
}

it('preserves the existing retry policy for an unexpected abort with an active signal', async () => {
  let attempts = 0;
  useClient(async () => { attempts += 1; throw new DOMException('Fetch is aborted', 'AbortError'); });
  const defaults = adminQueryClient.getDefaultOptions();
  const queryClient = new QueryClient({ defaultOptions: { ...defaults, queries: { ...defaults.queries, retryDelay: 0, gcTime: 0 } } });
  try {
    await expect(queryClient.fetchQuery({ queryKey: ['unexpected-abort-retry-fixture'],
      queryFn: ({ signal }) => fetchConversationList(null, signal),
    })).rejects.toBeDefined();
    await Sentry.flush(1000);
    expect(attempts).toBe(4);
    expect(events).toHaveLength(4);
  } finally { queryClient.clear(); }
});

it('does not report the inbox read that React Query cancels when its last observer unmounts', async () => {
  let started!: () => void;
  const fetching = new Promise<void>((resolve) => { started = resolve; });
  useClient(async (_url, init) => new Promise<Response>((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => reject(new DOMException('Fetch is aborted', 'AbortError')), { once: true });
    started();
  }));
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const observer = new QueryObserver(queryClient, {
    queryKey: ['inbox-cancellation-fixture'], queryFn: ({ signal }) => fetchConversationList(null, signal),
  });
  const unsubscribe = observer.subscribe(() => {});
  try {
    await fetching;
    unsubscribe();
    await new Promise((resolve) => setImmediate(resolve));
    await Sentry.flush(1000);
    expect(events).toHaveLength(0);
  } finally {
    unsubscribe();
    queryClient.clear();
  }
});

it.each(['message-preview', 'reaction-preview', 'unread-ids', 'unread-count'])('does not report a caller cancellation during %s', async (stage) => {
  let started!: () => void;
  const fetching = new Promise<void>((resolve) => { started = resolve; });
  const conversations = [{ id: 'fixture-conversation', last_message_id: 'fixture-message' }];
  useClient(async (url, init) => {
    const target = new URL(String(url));
    const blocked = stage === 'unread-count' ? target.pathname.endsWith('/get_unread_contact_conversation_count')
      : stage === 'unread-ids' ? target.pathname.endsWith('/get_unread_message_conversation_ids')
      : stage === 'message-preview' ? target.pathname.endsWith('/messages')
      : target.pathname.endsWith('/messages') && target.searchParams.has('conversation_id');
    if (blocked) return new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('The operation was aborted.', 'AbortError')), { once: true });
      started();
    });
    return new Response(JSON.stringify(target.pathname.endsWith('/conversations') ? conversations
      : [{ id: 'fixture-message', is_reaction: true }]), { headers: { 'content-type': 'application/json' } });
  });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const observer = new QueryObserver<Awaited<ReturnType<typeof fetchConversationList>> | number>(queryClient, {
    queryKey: ['inbox-cancellation-stage', stage],
    queryFn: ({ signal }) => stage === 'unread-count' ? fetchUnreadConversationCount(signal) : fetchConversationList(null, signal),
  });
  const unsubscribe = observer.subscribe(() => {});
  try {
    await fetching;
    unsubscribe();
    await new Promise((resolve) => setImmediate(resolve));
    await Sentry.flush(1000);
    expect(events).toHaveLength(0);
  } finally { unsubscribe(); queryClient.clear(); }
});

it('retains a cancellation whose caller supplied an unknown abort reason', async () => {
  const controller = new AbortController();
  controller.abort('Unexpected fixture shutdown');
  useClient(async () => { throw new Error('A pre-aborted request must not start'); });
  await expect(fetchConversationList(null, controller.signal)).rejects.toBe('Unexpected fixture shutdown');
  await Sentry.flush(1000);
  expect(events).toHaveLength(1);
});

it('retains an abort when the read has no caller signal', async () => {
  useClient(async () => { throw new DOMException('Fetch is aborted', 'AbortError'); });
  await expect(fetchConversationList()).rejects.toMatchObject({ message: 'AbortError: Fetch is aborted' });
  await Sentry.flush(1000);
  expect(events).toHaveLength(1);
  expect(events[0].exception?.values?.[0].mechanism?.type).toBe('auto.db.supabase.postgres');
});
