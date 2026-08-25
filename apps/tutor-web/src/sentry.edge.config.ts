import * as Sentry from "@sentry/nextjs";
import { filterExpectedTutorWebError } from "@/lib/sentry/before-send";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  environment:
    process.env.SENTRY_ENVIRONMENT ||
    process.env.VERCEL_ENV ||
    process.env.NODE_ENV,
  sendDefaultPii: false,
  beforeSend: filterExpectedTutorWebError,
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1 : 0.1,
});
