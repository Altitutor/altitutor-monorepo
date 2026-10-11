import { resolveSentryCollection } from "../../../packages/shared/src/observability/sentry-collection.ts";

export function edgeFunctionSentryCollection(env: (name: string) => string | undefined) {
  const deployed = Boolean(env("DENO_DEPLOYMENT_ID")?.trim());
  return resolveSentryCollection({
    dsn: env("SENTRY_DSN"),
    deploymentEnvironment: deployed ? env("SENTRY_DEPLOYMENT_ENVIRONMENT") : "local",
    explicitEnvironment: env("SENTRY_ENVIRONMENT"),
    nodeEnvironment: "production",
    ci: env("CI"),
    disabled: env("SENTRY_DISABLED"),
    testOptIn: env("SENTRY_TEST_OPT_IN"),
  });
}
