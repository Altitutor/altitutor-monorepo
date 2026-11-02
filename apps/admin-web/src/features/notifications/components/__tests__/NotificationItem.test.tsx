import { fireEvent, render, screen } from '@testing-library/react';
import { NotificationItem } from '../NotificationItem';
import type { Notification } from '../../types';

const push = jest.fn();
const openSession = jest.fn();
jest.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
jest.mock('@/shared/contexts/EntityNavigation', () => ({
  useEntityNavigation: () => ({ openSession }),
}));
jest.mock('@/features/messages/utils/templateHelpers', () => ({
  formatRelativeDate: () => 'Today',
}));

const notification: Notification = {
  id: 'notice', staff_id: 'staff', student_id: null,
  title: 'You have met the requirements for this tier', body: null,
  action_url: '/pay-tier', notification_type: 'PAY_TIER_ELIGIBLE',
  app_scope: 'staff_web', priority: 'normal', metadata: {},
  created_at: null, updated_at: '2026-10-22T00:00:00Z',
  read_at: null, dismissed_at: null, resolved_at: null, expires_at: null,
  created_by_staff_id: null, activity_event_id: null, domain_event_id: null,
  dedupe_key: null,
};

const originalEnv = { ...process.env };
const fetchMock = jest.fn();
const tab = { postMessage: jest.fn(), close: jest.fn(), closed: false };
let open: jest.SpyInstance;
jest.mock('sonner', () => ({ toast: { error: jest.fn() } }));

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  process.env.NEXT_PUBLIC_TUTOR_URL = 'https://tutor.altitutor.com';
  tab.closed = false;
  global.fetch = fetchMock;
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({ tokenHash: 'one-time-sign-in-hash' }) });
  open = jest.spyOn(window, 'open').mockReturnValue(tab as unknown as Window);
});
afterEach(() => {
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
  open.mockRestore();
  process.env = { ...originalEnv };
});

function clickNotice(overrides: Partial<Notification> = {}) {
  const onOpen = jest.fn();
  render(<NotificationItem notification={{ ...notification, ...overrides }} onDismiss={jest.fn()} onOpen={onOpen} />);
  fireEvent.click(screen.getByText(notification.title));
  expect(onOpen).toHaveBeenCalledTimes(1);
}

function ready(origin = 'https://tutor.altitutor.com', source = tab) {
  fireEvent(window, new MessageEvent('message', {
    origin, source: source as unknown as Window, data: { type: 'tutor-handoff-ready' },
  }));
}

test('opens the tutor tab and signs in through the exact tab/origin handshake', async () => {
  clickNotice();
  expect(push).not.toHaveBeenCalled();
  expect(open).toHaveBeenCalledWith('https://tutor.altitutor.com/auth/admin-handoff', '_blank');
  expect(fetchMock).not.toHaveBeenCalled();
  ready();
  await Promise.resolve(); await Promise.resolve();
  expect(fetchMock).toHaveBeenCalledWith('/api/auth/tutor-handoff', expect.objectContaining({ method: 'POST', signal: expect.any(AbortSignal) }));
  expect(tab.postMessage).toHaveBeenCalledWith({ type: 'admin-handoff-token', tokenHash: 'one-time-sign-in-hash' }, 'https://tutor.altitutor.com');
  ready();
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

test('ignores messages from another origin or another tab', () => {
  clickNotice();
  ready('https://attacker.example');
  ready('https://tutor.altitutor.com', { ...tab });
  expect(fetchMock).not.toHaveBeenCalled();
  expect(tab.postMessage).not.toHaveBeenCalled();
});

test('does not mint a token when the popup is blocked', () => {
  open.mockReturnValue(null);
  clickNotice(); ready();
  expect(fetchMock).not.toHaveBeenCalled();
});

test('closes the tab when authentication fails', async () => {
  fetchMock.mockResolvedValue({ ok: false });
  clickNotice(); ready();
  await Promise.resolve();
  expect(tab.close).toHaveBeenCalledTimes(1);
  expect(tab.postMessage).not.toHaveBeenCalled();
});

test.each([
  { action_url: '/tasks', notification_type: 'TASK_ASSIGNED', expected: '/tasks' },
  { action_url: '/pay-tiers', notification_type: 'OTHER', expected: '/pay-tiers' },
])('preserves local action $action_url', ({ expected, ...overrides }) => {
  clickNotice(overrides);
  expect(push).toHaveBeenCalledWith(expected);
  expect(open).not.toHaveBeenCalled();
});

test('preserves session modal actions', () => {
  clickNotice({ notification_type: 'SESSION', action_url: 'modal://session/session-1' });
  expect(openSession).toHaveBeenCalledWith('session-1');
  expect(open).not.toHaveBeenCalled();
});

test('preserves external actions', () => {
  clickNotice({ notification_type: 'OTHER', action_url: 'https://example.com/notice' });
  expect(open).toHaveBeenCalledWith('https://example.com/notice', '_blank');
});

test('does not mint a token after the reserved tab closes', () => {
  clickNotice(); tab.closed = true; ready();
  expect(fetchMock).not.toHaveBeenCalled();
});
test('timeout removes the listener and closes the reserved tab', () => {
  clickNotice(); jest.advanceTimersByTime(30_000); ready();
  expect(tab.close).toHaveBeenCalledTimes(1);
  expect(fetchMock).not.toHaveBeenCalled();
});
test('malformed auth response is not delivered to the tutor tab', async () => {
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) });
  clickNotice(); ready();
  await Promise.resolve(); await Promise.resolve();
  expect(tab.close).toHaveBeenCalledTimes(1);
  expect(tab.postMessage).not.toHaveBeenCalled();
});
