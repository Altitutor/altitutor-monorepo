import * as Sentry from "@sentry/nextjs";
import { filterExpectedTutorWebError } from "@/lib/sentry/before-send";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

// Production builds also run in previews and local smoke tests.
const replayEnabled =
  process.env.NODE_ENV === "production" &&
  (process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT || "production") === "production" &&
  typeof window !== "undefined" &&
  window.location.hostname === "tutor.altitutor.com";

Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  environment:
    process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT || process.env.NODE_ENV,
  sendDefaultPii: false,
  beforeSend: filterExpectedTutorWebError,
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1 : 0.1,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: replayEnabled ? 0.1 : 0,
  integrations: [
    ...(replayEnabled
      ? [
          Sentry.replayIntegration({
            maskAllText: true,
            maskAllInputs: true,
            blockAllMedia: true,
          }),
        ]
      : []),
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
      tags: { app: "tutor-web" },
    }),
  ],
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
