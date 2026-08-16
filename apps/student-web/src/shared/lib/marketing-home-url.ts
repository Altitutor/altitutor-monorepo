type MarketingLandingUrlInput = {
  configuredMarketingUrl?: string;
  nodeEnv?: string;
  deploymentEnvironment?: string;
};

export function resolveMarketingLandingUrl({
  configuredMarketingUrl,
  nodeEnv = 'production',
  deploymentEnvironment,
}: MarketingLandingUrlInput = {}): string {
  const trimmed = configuredMarketingUrl?.trim();
  const isDevelopmentDeployment =
    deploymentEnvironment === 'development' || deploymentEnvironment === 'preview';

  const marketingOrigin =
    trimmed ||
    (nodeEnv === 'development'
      ? 'http://localhost:3003'
      : isDevelopmentDeployment
        ? 'https://development.altitutor.com'
        : 'https://altitutor.com');

  return new URL('/online-learning/', marketingOrigin).toString();
}

export const MARKETING_LANDING_URL = resolveMarketingLandingUrl({
  configuredMarketingUrl: process.env.NEXT_PUBLIC_MARKETING_URL,
  nodeEnv: process.env.NODE_ENV,
  deploymentEnvironment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT,
});
