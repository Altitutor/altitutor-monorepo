/** @jest-environment node */
import * as Sentry from '@sentry/nextjs';
jest.mock('@sentry/nextjs', () => ({ init: jest.fn() }));
describe.each(['server', 'edge'])('%s collection', (runtime) => {
  const previous = process.env;
  afterEach(() => { process.env = previous; jest.clearAllMocks(); });
  it.each([
    [{}, false],
    [{ VERCEL_ENV: 'preview' }, false],
    [{ VERCEL_ENV: 'development' }, false],
    [{ VERCEL_ENV: 'production' }, true],
    [{ VERCEL_ENV: 'production', VERCEL_TARGET_ENV: 'staging' }, false],
    [{ VERCEL_ENV: 'preview', SENTRY_ENVIRONMENT: 'production' }, false],
    [{ SENTRY_TEST_OPT_IN: 'true' }, true],
    [{ VERCEL_ENV: 'production', CI: 'true', SENTRY_TEST_OPT_IN: 'true' }, false],
    [{ VERCEL_ENV: 'production', SENTRY_DISABLED: 'true', SENTRY_TEST_OPT_IN: 'true' }, false],
  ])('gates actual SDK initialization for %p', (env, expected) => {
    process.env = { ...previous, NODE_ENV: 'production', CI: '', VERCEL_ENV: '', VERCEL_TARGET_ENV: '', SENTRY_ENVIRONMENT: '', SENTRY_DISABLED: '', SENTRY_TEST_OPT_IN: '', NEXT_PUBLIC_SENTRY_DSN: 'https://public@sentry.example/1', ...env };
    jest.isolateModules(() => {
      if (runtime === 'server') jest.requireActual('@/sentry.server.config');
      else jest.requireActual('@/sentry.edge.config');
    });
    const options = jest.mocked(Sentry.init).mock.calls.at(-1)?.[0];
    expect(options?.enabled).toBe(expected);
    expect(options?.tracesSampleRate).toBe(expected ? 0.1 : 0);
  });
});
