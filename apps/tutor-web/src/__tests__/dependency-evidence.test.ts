/** @jest-environment node */
import * as Sentry from '@sentry/nextjs';
import { loadTutorPortalAccess } from '@/features/auth/server/portal-access';

jest.mock('server-only', () => ({}));
jest.mock('react', () => ({ ...jest.requireActual('react'), cache: (fn: unknown) => fn }));
jest.mock('@sentry/nextjs', () => ({ captureMessage: jest.fn(), instrumentSupabaseClient: jest.fn() }));
jest.mock('next/headers', () => ({ cookies: async () => ({ getAll: () => [], set: () => {} }), headers: async () => new Headers({ 'x-vercel-id': 'syd1::p786z-1794715332117-86c82a279d96' }) }));
const originalFetch = global.fetch;
const capture = jest.mocked(Sentry.captureMessage);
beforeEach(() => {
  jest.clearAllMocks();
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://project.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-key';
  delete process.env.NEXT_PUBLIC_SENTRY_DSN;
});
afterEach(() => { global.fetch = originalFetch; jest.useRealTimers(); });
const evidence = () => {
  const context = capture.mock.calls[0]?.[1];
  return context && typeof context === "object" && "extra" in context ? context.extra?.dependency_evidence : undefined;
};

test('actual profile failure carries the caller endpoint and consumed HTTP response in its existing event', async () => {
  global.fetch = jest.fn(async () => Response.json({ code: '57014', message: 'controlled failure' }, { status: 400, headers: { 'sb-request-id': '7034c5c4-b753-4d55-97db-e265d96ca17c' } }));
  await expect(loadTutorPortalAccess('verified-user')).resolves.toEqual({ status: 'unavailable' });
  expect(capture).toHaveBeenCalledTimes(1);
  expect(global.fetch).toHaveBeenCalledTimes(1);
  expect(evidence()).toMatchObject({ vercel_id: 'syd1::p786z-1794715332117-86c82a279d96', operations: [{ operation: 'create_client' }, { operation: 'tutor_profile', state: 'complete', network: 'observed' }], requests: [{ endpoint: 'tutor_profile', state: 'body_complete', status: 400, request_id: '7034c5c4-b753-4d55-97db-e265d96ca17c' }] });
});

test('upstream abort before the local deadline stays distinct from a local deadline-triggered abort', async () => {
  global.fetch = jest.fn(async () => { throw new DOMException('controlled abort', 'AbortError'); });
  await expect(loadTutorPortalAccess('verified-user')).resolves.toEqual({ status: 'unavailable' });
  expect(evidence()).toMatchObject({ local_deadline_expired: false, requests: [{ endpoint: 'tutor_profile', state: 'fetch_rejected', rejection: 'abort', local_deadline_at_rejection: false, effective_signal_aborted: false }] });
  expect(capture).toHaveBeenCalledTimes(1);
});

test('local abort records effective signal and does not alter the ten second deadline or add network calls', async () => {
  jest.useFakeTimers();
  global.fetch = jest.fn((_input, init) => new Promise<Response>((_resolve, reject) => init?.signal?.addEventListener('abort', () => reject(new DOMException('controlled abort', 'AbortError')), { once: true })));
  const result = loadTutorPortalAccess('verified-user');
  await jest.advanceTimersByTimeAsync(9999);
  expect(capture).not.toHaveBeenCalled();
  await jest.advanceTimersByTimeAsync(1);
  await expect(result).resolves.toEqual({ status: 'unavailable' });
  expect(evidence()).toMatchObject({ local_deadline_expired: true, requests: [{ endpoint: 'tutor_profile', state: 'fetch_rejected', local_deadline_at_rejection: true, effective_signal_aborted: true }] });
  expect(global.fetch).toHaveBeenCalledTimes(1);
  expect(capture).toHaveBeenCalledTimes(1);
});

test('a telemetry transport failure does not replace the unavailable result', async () => {
  global.fetch = jest.fn(async () => Response.json({ code: '57014' }, { status: 400 }));
  capture.mockImplementationOnce(() => { throw new Error('telemetry unavailable'); });
  await expect(loadTutorPortalAccess('verified-user')).resolves.toEqual({ status: 'unavailable' });
});
