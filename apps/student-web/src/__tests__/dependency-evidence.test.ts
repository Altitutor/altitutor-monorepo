/** @jest-environment node */
import * as Sentry from '@sentry/nextjs';
import { NextRequest } from 'next/server';
import { middleware } from '../middleware';
import { loadStudentPortalAccess } from '@/features/auth/server/portal-access';
import { createServerClient } from '@supabase/ssr';
import { createDependencyEvidence } from '@altitutor/shared';
import { generateKeyPairSync, sign } from 'node:crypto';

jest.mock('server-only', () => ({}));
jest.mock('react', () => ({ ...jest.requireActual('react'), cache: (fn: unknown) => fn }));
jest.mock('@sentry/nextjs', () => ({ captureMessage: jest.fn(), instrumentSupabaseClient: jest.fn() }));
const cookieStore = { getAll: jest.fn(), set: jest.fn() };
const getCookies = jest.fn(async () => cookieStore);
jest.mock('next/headers', () => ({ cookies: () => getCookies(), headers: async () => new Headers({ 'x-vercel-id': 'syd1::bbp6w-1794708426371-2e8f5db32150' }) }));
const upstreamId = '7034c5c4-b753-4d55-97db-e265d96ca17c';
const originalFetch = global.fetch;
const capture = jest.mocked(Sentry.captureMessage);
const now = () => Math.floor(Date.now() / 1000);
function session(expired = false) {
  const part = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return { access_token: `${part({ alg: 'HS256', typ: 'JWT' })}.${part({ sub: '00000000-0000-4000-8000-000000000001', exp: now() + 3600, iat: now() })}.c2ln`, refresh_token: 'private-refresh', expires_at: now() + (expired ? -10 : 3600), expires_in: 3600, token_type: 'bearer', user: { id: '00000000-0000-4000-8000-000000000001' } };
}
function cookie(expired = false) { return { name: 'student-auth', value: `base64-${Buffer.from(JSON.stringify(session(expired))).toString('base64url')}` }; }
function request() { return new NextRequest('https://student.altitutor.test/dashboard', { headers: { cookie: `${cookie().name}=${cookie().value}`, 'x-vercel-id': 'syd1::bbp6w-1794708426371-2e8f5db32150' } }); }
function failure() { return Response.json({ code: '57014', message: 'controlled failure' }, { status: 503, headers: { 'sb-request-id': upstreamId } }); }
function evidence() {
  const context = capture.mock.calls[0]?.[1];
  return context && typeof context === "object" && "extra" in context ? context.extra?.dependency_evidence : undefined;
}

beforeEach(() => {
  jest.clearAllMocks();
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://project.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-key';
  process.env.NEXT_PUBLIC_AUTH_COOKIE_NAME = 'student-auth';
  delete process.env.NEXT_PUBLIC_SENTRY_DSN;
  cookieStore.getAll.mockReturnValue([cookie()]);
});
afterEach(() => { global.fetch = originalFetch; jest.useRealTimers(); });

test('real SSR getClaims failure carries the actual Auth branch, status/body timing and correlation on its one event', async () => {
  global.fetch = jest.fn(async () => failure());
  expect((await middleware(request())).status).toBe(503);
  expect(capture).toHaveBeenCalledTimes(1);
  expect(evidence()).toMatchObject({ vercel_id: 'syd1::bbp6w-1794708426371-2e8f5db32150', operations: [{ operation: 'get_claims', state: 'complete', network: 'observed' }], requests: [{ endpoint: 'auth_user', state: 'body_complete', status: 503, request_id: upstreamId, trace_source: 'diagnostic', trace_id: expect.stringMatching(/^[a-f\d]{32}$/) }] });
  expect(global.fetch).toHaveBeenCalledTimes(1);
});

test('real SSR portal refresh is recorded before the named RPC without an extra call or success event', async () => {
  cookieStore.getAll.mockReturnValue([cookie(true)]);
  global.fetch = jest.fn(async (input) => String(input).includes('/token') ? Response.json(session()) : failure());
  await expect(loadStudentPortalAccess('verified-user')).resolves.toEqual({ status: 'unavailable' });
  expect(evidence()).toMatchObject({ requests: [{ endpoint: 'auth_refresh', state: 'body_complete' }, { endpoint: 'student_portal_access', state: 'body_complete', status: 503, request_id: upstreamId }] });
  expect(global.fetch).toHaveBeenCalledTimes(2);
  expect(capture).toHaveBeenCalledTimes(1);
});

test('local middleware deadline captures the still pending actual SDK request with a usable outgoing trace ID', async () => {
  jest.useFakeTimers();
  global.fetch = jest.fn(() => new Promise<Response>(() => {}));
  const pending = middleware(request());
  await jest.advanceTimersByTimeAsync(10_000);
  expect((await pending).status).toBe(503);
  expect(evidence()).toMatchObject({ local_deadline_expired: true, incoming_signal_aborted: false, operations: [{ operation: 'get_claims', state: 'pending' }], requests: [{ endpoint: 'auth_user', state: 'headers_pending', trace_id: expect.stringMatching(/^[a-f\d]{32}$/) }] });
  expect(global.fetch).toHaveBeenCalledTimes(1);
});

test('portal deadline distinguishes received headers from the actual SDK still consuming a body', async () => {
  jest.useFakeTimers();
  const response = new Response(new ReadableStream({ start() {} }), { headers: { 'sb-request-id': upstreamId } });
  global.fetch = jest.fn(async () => response);
  const pending = loadStudentPortalAccess('verified-user');
  await jest.advanceTimersByTimeAsync(10_000);
  await expect(pending).resolves.toEqual({ status: 'unavailable' });
  expect(evidence()).toMatchObject({ local_deadline_expired: true, requests: [{ endpoint: 'student_portal_access', state: 'body_pending', status: 200, request_id: upstreamId }] });
  expect(capture).toHaveBeenCalledTimes(1);
});

test('successful real SDK access is silent and performs only its existing RPC', async () => {
  global.fetch = jest.fn(async () => Response.json({ student_id: 'student', active_staff_role: null }));
  await expect(loadStudentPortalAccess('verified-user')).resolves.toEqual({ status: 'allowed', userId: 'verified-user', studentId: 'student' });
  expect(capture).not.toHaveBeenCalled();
  expect(global.fetch).toHaveBeenCalledTimes(1);
});

test('a failure before SDK fetch retains the rejected setup operation without guessing network latency', async () => {
  getCookies.mockRejectedValueOnce(new Error('private cookie context'));
  global.fetch = jest.fn();
  await expect(loadStudentPortalAccess('verified-user')).resolves.toEqual({ status: 'unavailable' });
  expect(evidence()).toMatchObject({ operations: [{ operation: 'create_client', state: 'rejected', network: 'none_observed' }], requests: [] });
  expect(global.fetch).not.toHaveBeenCalled();
});

test('actual asymmetric verification records a JWKS fetch and then honestly reports no network with the SDK cache', async () => {
  const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const key = { ...publicKey.export({ format: 'jwk' }), kid: 'diagnostic-fixture', alg: 'RS256', use: 'sig' };
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const unsigned = `${encode({ alg: 'RS256', typ: 'JWT', kid: key.kid })}.${encode({ sub: 'fixture', exp: now() + 3600, iat: now() })}`;
  const jwt = `${unsigned}.${sign('RSA-SHA256', Buffer.from(unsigned), privateKey).toString('base64url')}`;
  const transport = jest.fn(async () => Response.json({ keys: [key] }));
  const first = createDependencyEvidence({ supabaseUrl: 'https://jwks-fixture.supabase.co' });
  const second = createDependencyEvidence({ supabaseUrl: 'https://jwks-fixture.supabase.co' });
  const client = (observer: typeof first) => createServerClient('https://jwks-fixture.supabase.co', 'test-key', { cookies: { getAll: () => [], setAll: () => {} }, global: { fetch: observer.fetch(transport) } });
  expect((await first.operation('get_claims', () => client(first).auth.getClaims(jwt))).error).toBeNull();
  expect((await second.operation('get_claims', () => client(second).auth.getClaims(jwt))).error).toBeNull();
  expect(first.snapshot()).toMatchObject({ requests: [{ endpoint: 'auth_jwks', state: 'body_complete' }] });
  expect(second.snapshot()).toMatchObject({ operations: [{ operation: 'get_claims', network: 'none_observed', state: 'complete' }], requests: [] });
  expect(transport).toHaveBeenCalledTimes(1);
  expect(capture).not.toHaveBeenCalled();
});
