/** @jest-environment node */
import { POST } from '../route';

const getUser = jest.fn();
const maybeSingle = jest.fn();
const eq = jest.fn(() => ({ maybeSingle }));
const generateLink = jest.fn();
jest.mock('@/shared/lib/supabase/server-ssr', () => ({ createClient: () => ({
  auth: { getUser }, from: () => ({ select: () => ({ eq }) }),
}) }));
jest.mock('@/shared/lib/supabase/server/admin', () => ({ supabaseAdmin: { auth: { admin: { generateLink: (...args: unknown[]) => generateLink(...args) } } } }));

function request(origin = 'https://admin.altitutor.com', body = {}) {
  return new Request('https://admin.altitutor.com/api/auth/tutor-handoff', {
    method: 'POST', headers: { origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
}
const originalEnv = { ...process.env };
afterEach(() => { process.env = { ...originalEnv }; });
beforeEach(() => {
  process.env.NEXT_PUBLIC_ADMIN_URL = 'https://admin.altitutor.com';
  jest.clearAllMocks();
  getUser.mockResolvedValue({ data: { user: { id: 'verified-admin', email: 'admin@example.test' } }, error: null });
  maybeSingle.mockResolvedValue({ data: { role: 'ADMINSTAFF', status: 'ACTIVE' }, error: null });
  generateLink.mockResolvedValue({ data: { user: { id: 'verified-admin' }, properties: { hashed_token: 'single-use-hash' } }, error: null });
});

test('mints only the verified caller identity and never trusts request identity/destination', async () => {
  const response = await POST(request(undefined, { email: 'victim@example.test', redirectTo: 'https://attacker.example' }));
  expect(response.status).toBe(200);
  expect(eq).toHaveBeenCalledWith('user_id', 'verified-admin');
  expect(generateLink).toHaveBeenCalledWith({ type: 'magiclink', email: 'admin@example.test' });
  expect(await response.json()).toEqual({ tokenHash: 'single-use-hash' });
  expect(response.headers.get('Cache-Control')).toContain('no-store');
});

test('rejects an unauthenticated caller before generating any credential', async () => {
  getUser.mockResolvedValue({ data: { user: null }, error: null });
  expect((await POST(request())).status).toBe(401);
  expect(generateLink).not.toHaveBeenCalled();
});

test.each([{ role: 'TUTOR', status: 'ACTIVE' }, { role: 'ADMINSTAFF', status: 'INACTIVE' }])('rejects $role/$status', async (staff) => {
  maybeSingle.mockResolvedValue({ data: staff, error: null });
  expect((await POST(request())).status).toBe(403);
  expect(generateLink).not.toHaveBeenCalled();
});

test('rejects cross-origin requests', async () => {
  expect((await POST(request('https://attacker.example'))).status).toBe(403);
  expect(getUser).not.toHaveBeenCalled();
});

test('fails closed if generated identity differs from verified user', async () => {
  generateLink.mockResolvedValue({ data: { user: { id: 'other-user' }, properties: { hashed_token: 'secret' } }, error: null });
  const response = await POST(request());
  expect(response.status).toBe(503);
  expect(JSON.stringify(await response.json())).not.toContain('secret');
});

test('redacts auth failures', async () => {
  generateLink.mockRejectedValue(new Error('sensitive response'));
  const response = await POST(request());
  expect(response.status).toBe(503);
  expect(await response.json()).toEqual({ error: 'Unable to open the tutor portal' });
});
