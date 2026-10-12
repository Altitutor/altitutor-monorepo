import { resolveSentryCollection } from "@altitutor/shared";
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
const hostname = typeof window === "undefined" ? undefined : window.location.hostname;
const collection = resolveSentryCollection({
  dsn,
  hostname,
  productionHosts: ["altitutor.com", "www.altitutor.com"],
  deploymentEnvironment: process.env.NEXT_PUBLIC_SENTRY_DEPLOYMENT_ENVIRONMENT,
  explicitEnvironment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT,
  nodeEnvironment: process.env.NODE_ENV,
  disabled: process.env.NEXT_PUBLIC_SENTRY_DISABLED,
  testOptIn: process.env.NEXT_PUBLIC_SENTRY_TEST_OPT_IN,
});

Sentry.init({
  dsn,
  enabled: collection.feedback,
  environment: collection.environment,
  sendClientReports: collection.errors,
  integrations: (defaults) => defaults.filter((integration) => collection.errors || integration.name !== "BrowserSession"),
  sendDefaultPii: false,
  beforeSend: (event) => collection.errors || event.type === "feedback" ? event : null,
  beforeSendTransaction: (event) => collection.errors ? event : null,
  tracesSampleRate: collection.errors ? 0.1 : 0,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
