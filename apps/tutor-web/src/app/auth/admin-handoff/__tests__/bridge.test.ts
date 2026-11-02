/** @jest-environment node */
import { runInNewContext } from 'node:vm';
import { handoffScript } from '../bridge';

type Message = { origin: string; source: unknown; data: unknown };
function harness(hasOpener = true) {
  const opener = { postMessage: jest.fn() };
  const replace = jest.fn();
  const status = { textContent: 'Signing in' };
  const fetch = jest.fn().mockResolvedValue({ ok: true });
  let receive: ((event: Message) => Promise<void>) | undefined;
  const window = {
    opener: hasOpener ? opener : null,
    addEventListener: (_type: string, listener: typeof receive) => { receive = listener; },
    removeEventListener: jest.fn(), location: { replace },
  };
  runInNewContext(handoffScript('https://admin.altitutor.com'), {
    window, document: { getElementById: () => status }, fetch,
  });
  const message = (overrides: Partial<Message> = {}) => receive?.({
    origin: 'https://admin.altitutor.com', source: opener,
    data: { type: 'admin-handoff-token', tokenHash: 'one-time-token' }, ...overrides,
  });
  return { window, opener, replace, status, fetch, message };
}

test('completes the trusted opener handshake once with a body-only token and fixed destination', async () => {
  const h = harness();
  expect(h.opener.postMessage).toHaveBeenCalledWith({ type: 'tutor-handoff-ready' }, 'https://admin.altitutor.com');
  await h.message(); await h.message();
  expect(h.fetch).toHaveBeenCalledTimes(1);
  expect(h.fetch).toHaveBeenCalledWith('/auth/admin-handoff', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tokenHash: 'one-time-token' }),
  });
  expect(h.window.opener).toBeNull();
  expect(h.replace).toHaveBeenCalledWith('/pay-tier');
});

test('no opener means no auth attempt', () => {
  const h = harness(false);
  expect(h.fetch).not.toHaveBeenCalled();
  expect(h.opener.postMessage).not.toHaveBeenCalled();
  expect(h.status.textContent).toContain('Unable to sign in');
});

test('ignores another origin, another sender and malformed token messages', async () => {
  const h = harness();
  await h.message({ origin: 'https://attacker.example' });
  await h.message({ source: {} });
  await h.message({ data: { type: 'admin-handoff-token' } });
  expect(h.fetch).not.toHaveBeenCalled();
  expect(h.replace).not.toHaveBeenCalled();
  await h.message();
  expect(h.fetch).toHaveBeenCalledTimes(1);
});

test('auth verification failure leaves a safe retry instruction, without redirecting', async () => {
  const h = harness(); h.fetch.mockResolvedValue({ ok: false });
  await h.message();
  expect(h.status.textContent).toContain('Unable to sign in');
  expect(h.replace).not.toHaveBeenCalled();
});
