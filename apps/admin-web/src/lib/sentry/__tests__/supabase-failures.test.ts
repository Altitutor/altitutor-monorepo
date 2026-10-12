/** @jest-environment node */
import * as Sentry from '@sentry/nextjs';
import { createClient } from '@supabase/supabase-js';
import { instrumentSupabaseClient } from '../instrument-supabase-client';

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
beforeEach(() => { events.length = 0; });
afterAll(async () => {
  await Sentry.close();
  if (originalDsn === undefined) delete process.env.NEXT_PUBLIC_SENTRY_DSN;
  else process.env.NEXT_PUBLIC_SENTRY_DSN = originalDsn;
});

it.each(['Fetch is aborted', 'The operation was aborted.'])('retains an unsignalled Safari-shaped failed operation: %s', async (message) => {
  const client = instrumentSupabaseClient(createClient('https://database.example', 'fixture-key', {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: async () => { throw new DOMException(message, 'AbortError'); } },
  }));
  const result = await client.from('parents').select('id');
  await Sentry.flush(1000);
  expect(result.status).toBe(0);
  expect(result.error?.message).toBe(`AbortError: ${message}`);
  expect(events).toHaveLength(1);
  expect(events[0].exception?.values?.[0].mechanism?.type).toBe('auto.db.supabase.postgres');
});

it('demonstrates that a caller cancellation has the same reported shape as an unexpected abort', async () => {
  const controller = new AbortController();
  controller.abort();
  const client = instrumentSupabaseClient(createClient('https://database.example', 'fixture-key', {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: async (_url, init) => { init?.signal?.throwIfAborted(); return new Response('[]'); } },
  }));
  const result = await client.from('parents').select('id').abortSignal(controller.signal);
  await Sentry.flush(1000);
  expect(result.status).toBe(0);
  expect(result.error?.message).toContain('AbortError:');
  // No broad message filter: this must remain visible until caller intent is known.
  expect(events).toHaveLength(1);
});

it('retains a timed-out operation and instruments a shared client only once', async () => {
  const client = instrumentSupabaseClient(createClient('https://database.example', 'fixture-key', {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: async () => { throw new DOMException('Request timed out', 'TimeoutError'); } },
  }));
  instrumentSupabaseClient(client);
  await client.from('parents').select('id').retry(false);
  await Sentry.flush(1000);
  expect(events).toHaveLength(1);
  expect(events[0].exception?.values?.[0].value).toContain('TimeoutError: Request timed out');
});
