import { sanitizeSubjectCoverEvent } from '@altitutor/shared';
import { sentryWebCompatibilityOptions } from "@altitutor/shared";
import { sanitizeInterviewCallEvent, resolveSentryCollection } from "@altitutor/shared";
import * as Sentry from "@sentry/nextjs";
import {
  filterMobileAuthTelemetry,
  isMobileAuthBrowserContext,
} from "@/lib/privacy/mobile-auth-telemetry";
import { sanitizeStudentAnalyticsUrl } from "@/shared/lib/analytics/posthog";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
const hostname = typeof window === "undefined" ? undefined : window.location.hostname;
const collection = resolveSentryCollection({
  dsn,
  hostname,
  productionHosts: ["student.altitutor.com"],
  deploymentEnvironment: process.env.NEXT_PUBLIC_SENTRY_DEPLOYMENT_ENVIRONMENT,
  explicitEnvironment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT,
  nodeEnvironment: process.env.NODE_ENV,
  disabled: process.env.NEXT_PUBLIC_SENTRY_DISABLED,
  testOptIn: process.env.NEXT_PUBLIC_SENTRY_TEST_OPT_IN,
});

const replayEnabled = collection.errors && !isMobileAuthBrowserContext();

function attachTrialStylesheetContext(event: Sentry.ErrorEvent, hint: Sentry.EventHint) {
  if (
    typeof window === "undefined" ||
    window.location.pathname !== "/booking/trial-session" ||
    hint.mechanism?.type !== "auto.browser.global_handlers.onunhandledrejection"
  ) return;

  const reason = hint.originalException;
  if (!(reason instanceof Event) || reason.type !== "error") return;

  const link = reason.target;
  if (
    !(link instanceof HTMLLinkElement) ||
    link.parentElement !== document.head ||
    link.rel !== "stylesheet" ||
    !link.href.startsWith(`${window.location.origin}/_next/static/`)
  ) return;

  const { pathname } = new URL(link.href);
  if (!/^\/_next\/static\/[a-z0-9_./()-]+\.css$/i.test(pathname)) return;

  const timing = performance.getEntriesByName?.(link.href, "resource").at(-1);
  const responseStatus = (timing as PerformanceResourceTiming | undefined)?.responseStatus;
  event.contexts = {
    ...event.contexts,
    trial_stylesheet: {
      path: pathname,
      response_status: responseStatus,
    },
  };
}

Sentry.init({
  dsn,
  enabled: collection.feedback,
  environment: collection.environment,
  sendClientReports: collection.errors,
  ...sentryWebCompatibilityOptions(),
  tracesSampleRate: collection.errors ? 0.1 : 0,
  beforeSend(event, hint) {
    if (!collection.errors && event.type !== "feedback") return null;
    const filtered = filterMobileAuthTelemetry(event);
    if (!filtered) return null;
    if (filtered.request?.url) {
      filtered.request.url = sanitizeStudentAnalyticsUrl(filtered.request.url);
    }
    attachTrialStylesheetContext(filtered, hint);
    const safe = sanitizeInterviewCallEvent(filtered);
    return safe ? sanitizeSubjectCoverEvent(safe) : null;
  },
  beforeSendTransaction: (event) => collection.errors ? filterMobileAuthTelemetry(event) : null,
  beforeBreadcrumb: filterMobileAuthTelemetry,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: replayEnabled ? 0.1 : 0,
  integrations: (defaults) => [
    ...defaults.filter((integration) => collection.errors || integration.name !== "BrowserSession").map((integration) => integration.name === "BrowserSession" ? Sentry.browserSessionIntegration({ lifecycle: "route" }) : integration),
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
