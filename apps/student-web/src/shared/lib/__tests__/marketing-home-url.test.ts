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
  });

  it('sends production to the public marketing landing', () => {
    expect(resolveMarketingLandingUrl()).toBe(
      'https://altitutor.com/online-learning/',
    );
  });

  it('prefers an explicit marketing origin over environment defaults', () => {
    expect(
      resolveMarketingLandingUrl({
        configuredMarketingUrl: 'https://marketing.example.com/',
        nodeEnv: 'development',
        deploymentEnvironment: 'preview',
      }),
    ).toBe('https://marketing.example.com/online-learning/');
  });
});
