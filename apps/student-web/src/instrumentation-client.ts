import * as Sentry from "@sentry/nextjs";
import { sanitizeStudentAnalyticsUrl } from "@/shared/lib/analytics/posthog";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

// Production builds also run in previews and local smoke tests.
const replayEnabled =
  process.env.NODE_ENV === "production" &&
  (process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT || "production") === "production" &&
  typeof window !== "undefined" &&
  window.location.hostname === "student.altitutor.com";

Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  environment:
    process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT || process.env.NODE_ENV,
  sendDefaultPii: false,
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1 : 0.1,
  beforeSend(event) {
    if (event.request?.url) {
      event.request.url = sanitizeStudentAnalyticsUrl(event.request.url);
    }
    return event;
  },
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
      tags: { app: "student-web" },
    }),
  ],
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
