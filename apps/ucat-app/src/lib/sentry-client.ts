import { resolveSentryCollection } from "@altitutor/shared";
import * as Sentry from "@sentry/react-native";
import { isRunningInExpoGo } from "expo";
import {
  filterExpectedUcatAppError,
  nativeSentryTracePropagationTargets,
} from "./sentry";

const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
const collection = resolveSentryCollection({
  dsn,
  deploymentEnvironment: process.env.EXPO_PUBLIC_SENTRY_DEPLOYMENT_ENVIRONMENT,
  explicitEnvironment: process.env.EXPO_PUBLIC_SENTRY_ENVIRONMENT,
  nodeEnvironment: __DEV__ ? "development" : "production",
  ci: process.env.CI,
  disabled: process.env.EXPO_PUBLIC_SENTRY_DISABLED,
  testOptIn: process.env.EXPO_PUBLIC_SENTRY_TEST_OPT_IN,
});

Sentry.init({
  dsn,
  enabled: collection.errors,
  sendDefaultPii: false,
  environment: collection.environment,
  tracesSampleRate: collection.errors ? 0.1 : 0,
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
