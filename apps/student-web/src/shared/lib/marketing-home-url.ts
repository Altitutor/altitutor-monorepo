type MarketingLandingUrlInput = {
  configuredMarketingUrl?: string;
  nodeEnv?: string;
  deploymentEnvironment?: string;
  vercelEnvironment?: string;
  gitCommitRef?: string;
  requestHost?: string;
};

function hostnameOf(requestHost?: string): string | undefined {
  const hostname = requestHost?.split(':')[0]?.trim().toLowerCase();
  return hostname || undefined;
}

function marketingOriginFromRequestHost(requestHost?: string): string | undefined {
  const hostname = hostnameOf(requestHost);
  if (!hostname) return undefined;
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'http://localhost:3003';
  }
  if (
    hostname === 'development.altitutor.com' ||
    hostname.endsWith('.development.altitutor.com')
  ) {
    return 'https://development.altitutor.com';
  }
  return undefined;
}

export function resolveMarketingLandingUrl({
  configuredMarketingUrl,
  nodeEnv = 'production',
  deploymentEnvironment,
  vercelEnvironment,
  gitCommitRef,
  requestHost,
}: MarketingLandingUrlInput = {}): string {
  const trimmed = configuredMarketingUrl?.trim();
  const isDevelopmentDeployment =
    deploymentEnvironment === 'development' ||
    deploymentEnvironment === 'preview' ||
    vercelEnvironment === 'development' ||
    vercelEnvironment === 'preview' ||
    gitCommitRef === 'develop';

  const marketingOrigin =
    trimmed ||
    marketingOriginFromRequestHost(requestHost) ||
    (nodeEnv === 'development'
      ? 'http://localhost:3003'
      : isDevelopmentDeployment
        ? 'https://development.altitutor.com'
        : 'https://altitutor.com');

  return new URL('/online-learning/', marketingOrigin).toString();
}

export function getMarketingLandingUrl(requestHost?: string): string {
  return resolveMarketingLandingUrl({
    configuredMarketingUrl: process.env.NEXT_PUBLIC_MARKETING_URL,
    nodeEnv: process.env.NODE_ENV,
    deploymentEnvironment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT,
    vercelEnvironment: process.env.VERCEL_ENV,
    gitCommitRef: process.env.VERCEL_GIT_COMMIT_REF,
    requestHost,
  });
}
