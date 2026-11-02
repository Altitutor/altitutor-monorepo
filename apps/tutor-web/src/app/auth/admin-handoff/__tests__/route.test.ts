/** @jest-environment node */
import { GET, POST } from '../route';
const verifyOtp = jest.fn();
jest.mock('@/shared/lib/supabase/server-ssr', () => ({ createClient: () => ({ auth: { verifyOtp } }) }));
function request(origin = 'https://tutor.altitutor.com', tokenHash = 'fixture-single-use-hash', contentType = 'application/json') {
  return new Request('https://tutor.altitutor.com/auth/admin-handoff', {
    method: 'POST', headers: { origin, 'Content-Type': contentType }, body: JSON.stringify({ tokenHash }),
  });
}
const originalEnv = { ...process.env };
afterEach(() => { process.env = { ...originalEnv }; });
beforeEach(() => {
  process.env.NEXT_PUBLIC_TUTOR_URL = 'https://tutor.altitutor.com';
  jest.clearAllMocks(); verifyOtp.mockResolvedValue({ error: null });
});
test('serves only the isolated bridge with strict CSP and no-store', async () => {
  const response = GET();
  const html = await response.text();
  expect(html).not.toContain('src=');
  expect(html.match(/<script>/g)).toHaveLength(1);
  expect(response.headers.get('Content-Security-Policy')).toContain("default-src 'none'");
  expect(response.headers.get('Content-Security-Policy')).toContain("frame-ancestors 'none'");
  expect(response.headers.get('Cache-Control')).toContain('no-store');
});
test('verifies the one-time token using the tutor cookie client', async () => {
  const response = await POST(request());
  expect(response.status).toBe(200);
  expect(verifyOtp).toHaveBeenCalledWith({ type: 'magiclink', token_hash: 'fixture-single-use-hash' });
  expect(await response.json()).toEqual({ ok: true });
  expect(response.headers.get('Cache-Control')).toContain('no-store');
});
test.each(['', 'https://attacker.example'])('rejects untrusted Origin %s', async (origin) => {
  expect((await POST(request(origin))).status).toBe(403);
  expect(verifyOtp).not.toHaveBeenCalled();
});
test('rejects form/simple POSTs', async () => {
  expect((await POST(request(undefined, undefined, 'text/plain'))).status).toBe(403);
  expect(verifyOtp).not.toHaveBeenCalled();
});
test('rejects malformed tokens', async () => {
  expect((await POST(request(undefined, 'bad'))).status).toBe(400);
  expect(verifyOtp).not.toHaveBeenCalled();
});
test('reports expired/used tokens without leaking token or provider error', async () => {
  verifyOtp.mockResolvedValue({ error: { message: 'sensitive provider error' } });
  const response = await POST(request());
  expect(response.status).toBe(401);
  expect(await response.json()).toEqual({ error: 'Sign-in failed' });
});
