/** @jest-environment node */

import { createClient } from '@/shared/lib/supabase/server-ssr';
import { getServiceRoleClient } from '@/shared/lib/supabase/service-role';
import { DELETE, GET, PATCH, POST } from '../route';

jest.mock('@/lib/sentry/capture-api-error', () => ({ captureApiError: jest.fn() }));
jest.mock('@/shared/lib/supabase/server-ssr', () => ({ createClient: jest.fn() }));
jest.mock('@/shared/lib/supabase/service-role', () => ({ getServiceRoleClient: jest.fn() }));

const token = 'ExpoPushToken[test-device]';
const sessionId = 'b4c4e732-63a5-4404-bd8d-cb8f110a282b';
const claims = Buffer.from(JSON.stringify({ sub: 'auth-user', session_id: sessionId })).toString('base64url');
const bearerToken = `header.${claims}.signature`;
const getUser = jest.fn();
const rpc = jest.fn();
const upsert = jest.fn();
const maybeSingle = jest.fn();
const eq = jest.fn();
const table = { select: jest.fn(), delete: jest.fn(), maybeSingle, eq, upsert };
const from = jest.fn();

function request(method: string, body?: unknown, bearer = true) {
  return new Request('https://tutor.example.com/api/mobile-push', {
    method,
    headers: bearer ? { Authorization: `Bearer ${bearerToken}` } : undefined,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

beforeEach(() => {
  jest.resetAllMocks();
  jest.mocked(createClient).mockResolvedValue({ auth: { getUser }, rpc } as never);
  jest.mocked(getServiceRoleClient).mockReturnValue({ from } as never);
  getUser.mockResolvedValue({ data: { user: { id: 'auth-user' } }, error: null });
  rpc.mockResolvedValue({ data: 'staff-id', error: null });
  from.mockReturnValue(table);
  table.select.mockReturnValue(table);
  table.delete.mockReturnValue(table);
  eq.mockReturnValue(table);
  maybeSingle.mockResolvedValue({ data: null, error: null });
  upsert.mockResolvedValue({ error: null });
});

it('rejects missing and invalid bearer credentials before accessing push storage', async () => {
  expect((await POST(request('POST', { token, platform: 'ios' }, false))).status).toBe(401);
  expect(createClient).not.toHaveBeenCalled();

  getUser.mockResolvedValue({ data: { user: null }, error: { status: 401 } });
  expect((await POST(request('POST', { token, platform: 'ios' }))).status).toBe(401);
  expect(getServiceRoleClient).not.toHaveBeenCalled();
});

it('requires tutor portal access before registering a device', async () => {
  rpc.mockResolvedValue({ data: null, error: null });

  expect((await POST(request('POST', { token, platform: 'ios' }))).status).toBe(403);
  expect(getServiceRoleClient).not.toHaveBeenCalled();
});

it('binds registration to the authenticated staff identity and scope', async () => {
  expect((await POST(request('POST', { token, platform: 'ios', staffId: 'different-staff' }))).status).toBe(200);

  expect(getUser).toHaveBeenCalledWith(bearerToken);
  expect(from).toHaveBeenCalledWith('mobile_push_devices');
  expect(upsert).toHaveBeenCalledWith(expect.objectContaining({
    app_scope: 'staff_web', staff_id: 'staff-id', staff_user_id: 'auth-user',
    student_id: null, staff_session_id: sessionId, platform: 'ios', expo_push_token: token,
  }), { onConflict: 'expo_push_token' });
});

it('defaults tutor updates on and retains an explicit opt-out', async () => {
  const defaultPreference = await GET(request('GET'));
  expect(await defaultPreference.json()).toEqual({ categories: { tutor_updates: true } });

  maybeSingle.mockResolvedValue({ data: { enabled: false }, error: null });
  const savedPreference = await GET(request('GET'));
  expect(await savedPreference.json()).toEqual({ categories: { tutor_updates: false } });
  expect(eq).toHaveBeenCalledWith('staff_id', 'staff-id');

  expect((await PATCH(request('PATCH', { category: 'payments', enabled: false }))).status).toBe(400);
  expect(upsert).not.toHaveBeenCalled();
});

it('allows a previously registered user to unregister after losing tutor portal access', async () => {
  expect((await DELETE(request('DELETE', { token }))).status).toBe(200);

  expect(rpc).not.toHaveBeenCalled();
  expect(eq.mock.calls).toEqual([
    ['staff_user_id', 'auth-user'],
    ['staff_session_id', sessionId],
    ['app_scope', 'staff_web'],
    ['expo_push_token', token],
  ]);
});
