import { resolveMarketingLandingUrl } from '../marketing-home-url';

describe('resolveMarketingLandingUrl', () => {
  it('sends local development to the local marketing landing', () => {
    expect(
      resolveMarketingLandingUrl({
        nodeEnv: 'development',
      }),
    ).toBe('http://localhost:3003/online-learning/');
  });

  it('sends development and preview deployments to the remote marketing preview', () => {
    expect(
      resolveMarketingLandingUrl({
        nodeEnv: 'production',
        deploymentEnvironment: 'development',
      }),
    ).toBe('https://development.altitutor.com/online-learning/');
    expect(
      resolveMarketingLandingUrl({
        nodeEnv: 'production',
        deploymentEnvironment: 'preview',
      }),
    ).toBe('https://development.altitutor.com/online-learning/');
    expect(
      resolveMarketingLandingUrl({
        nodeEnv: 'production',
        vercelEnvironment: 'preview',
      }),
    ).toBe('https://development.altitutor.com/online-learning/');
    expect(
      resolveMarketingLandingUrl({
        nodeEnv: 'production',
        gitCommitRef: 'develop',
      }),
    ).toBe('https://development.altitutor.com/online-learning/');
  });

  it('keeps hosted development on the development marketing site even when env tags say production', () => {
    expect(
      resolveMarketingLandingUrl({
        nodeEnv: 'production',
        deploymentEnvironment: 'production',
        vercelEnvironment: 'production',
        requestHost: 'student.development.altitutor.com',
      }),
    ).toBe('https://development.altitutor.com/online-learning/');
  });

  it('sends a local request host to the local marketing landing', () => {
    expect(
      resolveMarketingLandingUrl({
        nodeEnv: 'production',
        requestHost: 'localhost:3001',
      }),
    ).toBe('http://localhost:3003/online-learning/');
  });

  it('sends production to the public marketing landing', () => {
    expect(resolveMarketingLandingUrl()).toBe(
      'https://altitutor.com/online-learning/',
    );
  });

  it('keeps local and hosted development on their marketing sites even when a production origin is configured', () => {
    expect(
      resolveMarketingLandingUrl({
        configuredMarketingUrl: 'https://altitutor.com',
        nodeEnv: 'development',
      }),
    ).toBe('http://localhost:3003/online-learning/');
    expect(
      resolveMarketingLandingUrl({
        configuredMarketingUrl: 'https://altitutor.com',
        nodeEnv: 'production',
        requestHost: 'localhost:3001',
      }),
    ).toBe('http://localhost:3003/online-learning/');
    expect(
      resolveMarketingLandingUrl({
        configuredMarketingUrl: 'https://altitutor.com',
        nodeEnv: 'production',
        requestHost: 'student.development.altitutor.com',
      }),
    ).toBe('https://development.altitutor.com/online-learning/');
  });

  it('uses an explicit marketing origin in production', () => {
    expect(
      resolveMarketingLandingUrl({
        configuredMarketingUrl: 'https://marketing.example.com/',
        nodeEnv: 'production',
      }),
    ).toBe('https://marketing.example.com/online-learning/');
  });
});
