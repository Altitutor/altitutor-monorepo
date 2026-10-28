import { sanitizeInterviewCallEvent, resolveSentryCollection } from "@altitutor/shared";
import * as Sentry from "@sentry/nextjs";
import { filterExpectedTutorWebError } from "@/lib/sentry/before-send";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
const hostname = typeof window === "undefined" ? undefined : window.location.hostname;
const collection = resolveSentryCollection({
  dsn,
  hostname,
  productionHosts: ["tutor.altitutor.com"],
  deploymentEnvironment: process.env.NEXT_PUBLIC_SENTRY_DEPLOYMENT_ENVIRONMENT,
  explicitEnvironment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT,
  nodeEnvironment: process.env.NODE_ENV,
  disabled: process.env.NEXT_PUBLIC_SENTRY_DISABLED,
  testOptIn: process.env.NEXT_PUBLIC_SENTRY_TEST_OPT_IN,
});

const replayEnabled = collection.errors;

Sentry.init({
  dsn,
  enabled: collection.feedback,
  environment: collection.environment,
  sendClientReports: collection.errors,
  sendDefaultPii: false,
  beforeSendTransaction: (event) => collection.errors ? event : null,
  beforeSend: (event, hint) => {
    if (!collection.errors && event.type !== "feedback") return null;
    const filtered = filterExpectedTutorWebError(event, hint);
    return filtered ? sanitizeInterviewCallEvent(filtered) : null;
  },
  tracesSampleRate: collection.errors ? 0.1 : 0,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: replayEnabled ? 0.1 : 0,
  integrations: (defaults) => [
    ...defaults.filter((integration) => collection.errors || integration.name !== "BrowserSession"),
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
