import * as Sentry from "@sentry/nextjs";
import { resolveServerSentryEnvironment } from "@altitutor/shared";
import { filterExpectedUcatWebError } from "@/lib/sentry/before-send";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  environment: resolveServerSentryEnvironment({
    ci: process.env.CI,
    explicitEnvironment: process.env.SENTRY_ENVIRONMENT,
    nodeEnvironment: process.env.NODE_ENV,
    vercelEnvironment: process.env.VERCEL_ENV,
  }),
  sendDefaultPii: false,
  beforeSend: filterExpectedUcatWebError,
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1 : 0.1,
});
