import * as Sentry from "@sentry/react-native";
import { isRunningInExpoGo } from "expo";
import {
  filterExpectedUcatAppError,
  nativeSentryTracePropagationTargets,
  resolveNativeSentryEnvironment,
  shouldEnableNativeSentry,
} from "./sentry";

const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn,
  enabled: shouldEnableNativeSentry(dsn),
  sendDefaultPii: false,
  environment: resolveNativeSentryEnvironment({
    explicit: process.env.EXPO_PUBLIC_SENTRY_ENVIRONMENT,
    isDev: __DEV__,
  }),
  tracesSampleRate: __DEV__ ? 1 : 0.1,
  enableNativeFramesTracking: !isRunningInExpoGo(),
  beforeSend: filterExpectedUcatAppError,
  tracePropagationTargets: nativeSentryTracePropagationTargets(
    process.env.EXPO_PUBLIC_UCAT_WEB_URL,
  ),
});

export function bindSentryUser(userId: string | undefined): void {
  Sentry.setUser(userId ? { id: userId } : null);
}

export { Sentry };
