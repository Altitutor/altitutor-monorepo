import { resolveSentryCollection } from './sentry-collection';

const configured = { dsn: 'https://public@sentry.example/1', nodeEnvironment: 'production' };

describe('Sentry collection policy', () => {
  it.each([undefined, 'preview', 'development', 'test', 'local'])('keeps errors off in %s, regardless of production build mode or tag', (deploymentEnvironment) => {
    expect(resolveSentryCollection({ ...configured, deploymentEnvironment, explicitEnvironment: 'production' }).errors).toBe(false);
  });
  it('collects unexpected errors in a verified production deployment', () => {
    expect(resolveSentryCollection({ ...configured, deploymentEnvironment: 'production' }).errors).toBe(true);
  });
  it.each(['localhost', '127.0.0.1', '::1', 'ucat.development.altitutor.com', 'preview.vercel.app', 'ucat.altitutor.com.evil.test'])('rejects browser host %s even with a production deployment flag', (hostname) => {
    expect(resolveSentryCollection({ ...configured, deploymentEnvironment: 'production', hostname, productionHosts: ['ucat.altitutor.com'] }).errors).toBe(false);
  });
  it('collects in the exact production browser host', () => {
    expect(resolveSentryCollection({ ...configured, deploymentEnvironment: 'production', hostname: 'ucat.altitutor.com', productionHosts: ['ucat.altitutor.com'] }).errors).toBe(true);
  });
  it('requires an explicit test opt-in in local or preview builds', () => {
    expect(resolveSentryCollection({ ...configured, deploymentEnvironment: 'preview', testOptIn: 'true' })).toMatchObject({ errors: true, environment: 'sentry-test' });
    expect(resolveSentryCollection({ ...configured, testOptIn: '1' }).errors).toBe(false);
  });
  it.each([{ ci: 'true' }, { disabled: 'true' }, { nodeEnvironment: 'test' }])('keeps CI/test/disabled processes off even with test opt-in: %p', (off) => {
    expect(resolveSentryCollection({ ...configured, deploymentEnvironment: 'production', testOptIn: 'true', ...off })).toMatchObject({ errors: false, feedback: false });
  });
  it('preserves intentional development feedback without automatic events', () => {
    expect(resolveSentryCollection({ ...configured, nodeEnvironment: 'development', deploymentEnvironment: 'development' })).toMatchObject({ errors: false, feedback: true });
  });
  it.each([undefined, '', '   '])('needs a DSN for all collection (%s)', (dsn) => {
    expect(resolveSentryCollection({ ...configured, dsn, deploymentEnvironment: 'production' })).toMatchObject({ errors: false, feedback: false });
  });
});
