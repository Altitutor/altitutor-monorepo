/** @jest-environment node */
import * as Sentry from '@sentry/nextjs';
import { createRealtimeJoinDiagnostics } from '../realtime-join-diagnostics';

const events: Sentry.ErrorEvent[] = [];
beforeAll(() => {
  Sentry.init({
    dsn: 'https://public@sentry.example/1', defaultIntegrations: false,
    sendClientReports: false,
    transport: () => ({ send: async () => ({}), flush: async () => true }),
    beforeSend: (event) => { events.push(event); return null; },
  });
});
beforeEach(() => { events.length = 0; });
afterAll(async () => { await Sentry.close(); });

it('is absent unless explicitly enabled', () => {
  expect(createRealtimeJoinDiagnostics({ enabled: false, pathname: () => '/', channels: () => [] })).toBeUndefined();
});

it('captures allowlisted join replies once per code and removes inherited sensitive data', async () => {
  const observe = createRealtimeJoinDiagnostics({ enabled: true,
    pathname: () => '/students/private-email@example.test?token=secret',
    channels: () => [
      { topic: 'realtime:admin-realtime-project_members-private-id' },
      { topic: 'realtime:admin-realtime-project_members-other-id' },
      { topic: 'realtime:messages-contact-private-contact' },
      { topic: 'realtime:unrecognized-secret' },
    ],
  })!;
  Sentry.setUser({ id: 'private-user', email: 'secret@example.test' });
  Sentry.addBreadcrumb({ message: 'private breadcrumb' });
  Sentry.setContext('private', { token: 'secret' });
  for (const reason of ['unrelated', 'too_many_connections', 'too_many_joins', 'too_many_joins', 'too_many_channels']) {
    observe('receive', 'error realtime:admin-realtime-project_members-private-id phx_reply (1)', {
      status: 'error', response: { reason, token: 'secret' },
    });
  }
  observe('send', 'error realtime:private phx_reply (1)', { status: 'error', response: { reason: 'too_many_joins' } });
  await Sentry.flush(1000);
  expect(events).toHaveLength(2);
  expect(events[0].contexts?.realtime_join).toEqual({
    schema: 1, code: 'too_many_joins', route: '/students/:id', topic: 'project_members',
    channels: { project_members: 2, messages: 1, other: 1 },
  });
  expect(JSON.stringify(events)).not.toMatch(/private-|secret|example.test|breadcrumb/);
  expect(events[1].contexts?.realtime_join?.code).toBe('too_many_channels');
});

it('contains a throwing Sentry sink and does not retry capture', () => {
  const capture = jest.fn(() => { throw new Error('sink unavailable'); });
  const observe = createRealtimeJoinDiagnostics({ enabled: true, capture, pathname: () => '/private', channels: () => [] })!;
  const notify = () => observe('receive', 'error realtime:unknown phx_reply (1)', { status: 'error', response: { reason: 'too_many_joins' } });
  expect(notify).not.toThrow();
  expect(notify).not.toThrow();
  expect(capture).toHaveBeenCalledTimes(1);
});
