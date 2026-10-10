import { filterMobileAuthTelemetry } from "@/lib/privacy/mobile-auth-telemetry";
import * as Sentry from "@sentry/nextjs";
import { resolveSentryCollection } from "@altitutor/shared";
import { filterExpectedUcatWebError } from "@/lib/sentry/before-send";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
const collection = resolveSentryCollection({
  dsn,
  deploymentEnvironment: process.env.VERCEL_TARGET_ENV || process.env.VERCEL_ENV,
  explicitEnvironment: process.env.SENTRY_ENVIRONMENT,
  nodeEnvironment: process.env.NODE_ENV,
  ci: process.env.CI,
  disabled: process.env.SENTRY_DISABLED,
  testOptIn: process.env.SENTRY_TEST_OPT_IN,
});

Sentry.init({
  dsn,
  enabled: collection.errors,
  environment: collection.environment,
  sendDefaultPii: false,
  beforeSend: filterExpectedUcatWebError,
  beforeSendTransaction: filterMobileAuthTelemetry,
  beforeBreadcrumb: filterMobileAuthTelemetry,
  tracesSampleRate: collection.errors ? 0.1 : 0,
});
