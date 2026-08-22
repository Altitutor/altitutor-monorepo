import * as Sentry from "@sentry/nextjs";
import {
  shouldEnableClientSentry,
  shouldSendClientSentryEvent,
  shouldSendClientSentryTransaction,
} from "@/lib/sentry/client-config";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
const hostname =
  typeof window === "undefined" ? undefined : window.location.hostname;

Sentry.init({
  dsn,
  enabled: shouldEnableClientSentry(dsn, hostname),
  environment:
    process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT || process.env.NODE_ENV,
  sendDefaultPii: false,
  beforeSend: (event) =>
    shouldSendClientSentryEvent(event.type, hostname) ? event : null,
  beforeSendTransaction: (event) =>
    shouldSendClientSentryTransaction(hostname) ? event : null,
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1 : 0.1,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: process.env.NODE_ENV === "production" ? 1 : 0,
  integrations: [
    Sentry.replayIntegration({
      maskAllText: true,
      maskAllInputs: true,
      blockAllMedia: true,
      block: ["iframe[src^='https://js.stripe.com']"],
    }),
    Sentry.feedbackIntegration({
      autoInject: false,
      showBranding: false,
      showName: false,
      showEmail: false,
      enableScreenshot: false,
      formTitle: "Report a bug",
      messageLabel: "What happened?",
      messagePlaceholder:
        "What were you trying to do, what happened, and what did you expect?",
      submitButtonLabel: "Send bug report",
      successMessageText: "Thank you. Your bug report has been sent.",
      tags: { app: "ucat-web" },
    }),
  ],
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
