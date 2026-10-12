import { assertEquals } from "jsr:@std/assert";
import { edgeFunctionSentryCollection } from "./sentry-collection.ts";

Deno.test('Edge collection requires hosted production identity, not a DSN or tag', () => {
  const base = { SENTRY_DSN: 'https://public@sentry.example/1', SENTRY_ENVIRONMENT: 'production' };
  for (const extra of [{}, { SENTRY_DEPLOYMENT_ENVIRONMENT: 'production' }, { DENO_DEPLOYMENT_ID: 'development-deployment', SENTRY_DEPLOYMENT_ENVIRONMENT: 'development' }]) {
    const env: Record<string, string | undefined> = { ...base, ...extra };
    assertEquals(edgeFunctionSentryCollection((name) => env[name]).errors, false);
  }
  const production: Record<string, string | undefined> = { ...base, DENO_DEPLOYMENT_ID: 'production-deployment', SENTRY_DEPLOYMENT_ENVIRONMENT: 'production' };
  assertEquals(edgeFunctionSentryCollection((name) => production[name]).errors, true);
  assertEquals(edgeFunctionSentryCollection((name) => name === 'SENTRY_DISABLED' ? 'true' : production[name]).errors, false);
  assertEquals(edgeFunctionSentryCollection((name) => name === 'CI' ? 'true' : production[name]).errors, false);
});
Deno.test('Edge telemetry testing is explicit and labeled sentry-test', () => {
  const env: Record<string, string | undefined> = { SENTRY_DSN: 'https://public@sentry.example/1', SENTRY_TEST_OPT_IN: 'true' };
  assertEquals(edgeFunctionSentryCollection((name) => env[name]).errors, true);
  assertEquals(edgeFunctionSentryCollection((name) => env[name]).environment, 'sentry-test');
});
