const configuredMarketingUrl = process.env.NEXT_PUBLIC_MARKETING_URL?.trim();
const deploymentEnvironment = process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT;
const isDevelopmentDeployment =
  deploymentEnvironment === "development" || deploymentEnvironment === "preview";

const marketingOrigin =
  configuredMarketingUrl ||
  (process.env.NODE_ENV === "development"
    ? "http://localhost:3003"
    : isDevelopmentDeployment
      ? "https://development.altitutor.com"
      : "https://altitutor.com");

export const MARKETING_LANDING_URL = new URL(
  "/ucat/",
  marketingOrigin,
).toString();
