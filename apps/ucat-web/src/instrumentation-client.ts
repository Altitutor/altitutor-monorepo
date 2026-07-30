import * as Sentry from "@sentry/nextjs";
import { shouldEnableClientSentry } from "@/lib/sentry/client-config";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
const hostname =
  typeof window === "undefined" ? undefined : window.location.hostname;

Sentry.init({
  dsn,
  enabled: shouldEnableClientSentry(dsn, hostname),
  environment:
    process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT || process.env.NODE_ENV,
  sendDefaultPii: false,
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1 : 0.1,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
