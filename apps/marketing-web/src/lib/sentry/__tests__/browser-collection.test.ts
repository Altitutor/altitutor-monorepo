import * as Sentry from '@sentry/nextjs';

jest.mock('@sentry/nextjs', () => ({
  init: jest.fn(), replayIntegration: jest.fn(() => ({ name: 'Replay' })),
  feedbackIntegration: jest.fn(() => ({ name: 'Feedback' })), captureRouterTransitionStart: jest.fn(),
}));

// Exercise the actual init callbacks as well as the shared resolver. No transport runs.
describe('marketing browser collection', () => {
  const originalEnv = process.env;
  afterEach(() => { process.env = originalEnv; jest.clearAllMocks(); });
  function initialize(env: Record<string, string>) {
    process.env = { ...originalEnv, NODE_ENV: 'production', NEXT_PUBLIC_SENTRY_DSN: 'https://public@sentry.example/1', NEXT_PUBLIC_SENTRY_DISABLED: '', NEXT_PUBLIC_SENTRY_TEST_OPT_IN: '', ...env };
    jest.isolateModules(() => require('@/instrumentation-client'));
    return jest.mocked(Sentry.init).mock.calls.at(-1)?.[0] as (Parameters<typeof Sentry.init>[0] & { replaysSessionSampleRate?: number; replaysOnErrorSampleRate?: number }) | undefined;
  }
  it.each(['local', 'preview', 'development', 'production'])('does not report automatic localhost events even from a %s build', (deployment) => {
    const options = initialize({ NEXT_PUBLIC_SENTRY_DEPLOYMENT_ENVIRONMENT: deployment });
    const beforeSend = options?.beforeSend as (event: Sentry.ErrorEvent, hint: Sentry.EventHint) => unknown;
    expect(beforeSend({ type: undefined, message: 'Unexpected production error' }, {})).toBeNull();
    expect(beforeSend({ type: 'feedback' } as unknown as Sentry.ErrorEvent, {})).not.toBeNull();
    expect(options?.tracesSampleRate).toBe(0);
    expect(options?.replaysSessionSampleRate ?? 0).toBe(0);
    expect(options?.replaysOnErrorSampleRate ?? 0).toBe(0);
    const integrations = options?.integrations as (defaults: { name: string }[]) => { name: string }[];
    expect(integrations([{ name: 'BrowserSession' }]).map((integration) => integration.name)).toEqual([]);
  });
  it('preserves unexpected failures under explicit telemetry test opt-in', () => {
    const options = initialize({ NEXT_PUBLIC_SENTRY_TEST_OPT_IN: 'true' });
    const beforeSend = options?.beforeSend as (event: Sentry.ErrorEvent, hint: Sentry.EventHint) => unknown;
    const failure: Sentry.ErrorEvent = { type: undefined, exception: { values: [{ value: 'permission denied for function ucat_study_plan_task_has_active_work' }] } };
    expect(beforeSend(failure, {})).toBe(failure);
    expect(options?.environment).toBe('sentry-test');
    expect(options?.replaysSessionSampleRate ?? 0).toBe(0);
    expect(options?.replaysOnErrorSampleRate ?? 0).toBe(0);
  });
  it('disables even feedback when the E2E/CI kill switch is set', () => {
    const options = initialize({ NEXT_PUBLIC_SENTRY_DISABLED: 'true', NEXT_PUBLIC_SENTRY_TEST_OPT_IN: 'true' });
    expect(options?.enabled).toBe(false);
    expect(options?.tracesSampleRate).toBe(0);
    expect(options?.sendClientReports).toBe(false);
  });
});
