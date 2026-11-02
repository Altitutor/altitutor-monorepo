jest.mock('@/shared/lib/analytics/posthog', () => ({ sanitizeStudentAnalyticsUrl: (url: string) => url }));
import * as Sentry from '@sentry/nextjs';

jest.mock('@sentry/nextjs', () => ({
  init: jest.fn(), replayIntegration: jest.fn(() => ({ name: 'Replay' })),
  feedbackIntegration: jest.fn(() => ({ name: 'Feedback' })), captureRouterTransitionStart: jest.fn(),
}));

// Exercise the actual init callbacks as well as the shared resolver. No transport runs.
describe('student browser collection', () => {
  const originalEnv = process.env;
  afterEach(() => { process.env = originalEnv; jest.clearAllMocks(); });
  function initialize(env: Record<string, string>) {
    process.env = { ...originalEnv, NODE_ENV: 'production', NEXT_PUBLIC_SENTRY_DSN: 'https://public@sentry.example/1', NEXT_PUBLIC_SENTRY_DISABLED: '', NEXT_PUBLIC_SENTRY_TEST_OPT_IN: '', ...env };
    jest.isolateModules(() => jest.requireActual('@/instrumentation-client'));
    return jest.mocked(Sentry.init).mock.calls.at(-1)?.[0] as (Parameters<typeof Sentry.init>[0] & { replaysSessionSampleRate?: number; replaysOnErrorSampleRate?: number }) | undefined;
  }
  it.each(['local', 'preview', 'development', 'production'])('does not report automatic localhost events even from a %s build', (deployment) => {
    const options = initialize({ NEXT_PUBLIC_SENTRY_DEPLOYMENT_ENVIRONMENT: deployment });
    const beforeSend = options?.beforeSend as (event: Sentry.ErrorEvent, hint: Sentry.EventHint) => unknown;
    expect(beforeSend({ type: undefined, message: 'Unexpected production error' }, {})).toBeNull();
    expect(beforeSend({ type: 'feedback' } as unknown as Sentry.ErrorEvent, {})).not.toBeNull();
    expect(options?.tracesSampleRate).toBe(0);
    expect(options?.replaysSessionSampleRate).toBe(0);
    expect(options?.replaysOnErrorSampleRate).toBe(0);
    const integrations = options?.integrations as (defaults: { name: string }[]) => { name: string }[];
    expect(integrations([{ name: 'BrowserSession' }]).map((integration) => integration.name)).toEqual(['Feedback']);
  });
  it('preserves unexpected failures under explicit telemetry test opt-in', () => {
    const options = initialize({ NEXT_PUBLIC_SENTRY_TEST_OPT_IN: 'true' });
    const beforeSend = options?.beforeSend as (event: Sentry.ErrorEvent, hint: Sentry.EventHint) => unknown;
    const failure: Sentry.ErrorEvent = { type: undefined, exception: { values: [{ value: 'permission denied for function ucat_study_plan_task_has_active_work' }] } };
    expect(beforeSend(failure, {})).toBe(failure);
    expect(options?.environment).toBe('sentry-test');
    expect(options?.replaysSessionSampleRate).toBe(0);
    expect(options?.replaysOnErrorSampleRate).toBe(0.1);
  });
  it('strips inherited private data from handled interview failure events', () => {
    const options = initialize({ NEXT_PUBLIC_SENTRY_TEST_OPT_IN: 'true' });
    const beforeSend = options?.beforeSend as (event: Sentry.ErrorEvent, hint: Sentry.EventHint) => Sentry.ErrorEvent | null;
    const sent = beforeSend({
      type: undefined, message: 'private provider message',
      tags: { 'interview.failure': 'true', app: 'student-web', 'interview.source': 'sdk', 'interview.category': 'connection', 'interview.phase': 'questions', 'interview.state': 'joined', privateTag: 'private room' },
      user: { id: 'private student', email: 'private email' },
      request: { url: 'https://private/round?token=private' }, breadcrumbs: [{ message: 'private device label' }],
      extra: { token: 'private token' }, exception: { values: [{ value: 'private SDK details' }] },
      contexts: { browser: { name: 'Safari', version: '18.1' }, trace: { trace_id: 'private trace', span_id: 'private span' } },
    }, {});
    expect(sent?.message).toBe('Interview call failed');
    expect(sent?.contexts).toEqual({ browser: { name: 'Safari', version: '18.1' } });
    expect(JSON.stringify(sent)).not.toContain('private');
  });
  it('disables even feedback when the E2E/CI kill switch is set', () => {
    const options = initialize({ NEXT_PUBLIC_SENTRY_DISABLED: 'true', NEXT_PUBLIC_SENTRY_TEST_OPT_IN: 'true' });
    expect(options?.enabled).toBe(false);
    expect(options?.tracesSampleRate).toBe(0);
    expect(options?.sendClientReports).toBe(false);
  });
});

it('excludes sensitive mobile auth contexts from replay even during explicit testing', () => {
  const previous = process.env;
  window.history.replaceState({}, '', '/mobile-auth?ticket=fixture');
  process.env = { ...previous, NODE_ENV: 'production', NEXT_PUBLIC_SENTRY_DSN: 'https://public@sentry.example/1', NEXT_PUBLIC_SENTRY_TEST_OPT_IN: 'true', NEXT_PUBLIC_SENTRY_DISABLED: '' };
  try {
    jest.isolateModules(() => jest.requireActual('@/instrumentation-client'));
    expect((jest.mocked(Sentry.init).mock.calls.at(-1)?.[0] as { replaysOnErrorSampleRate?: number })?.replaysOnErrorSampleRate).toBe(0);
  } finally { process.env = previous; window.history.replaceState({}, '', '/'); }
});
