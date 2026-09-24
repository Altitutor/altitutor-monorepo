import assert from "node:assert/strict";
import { test } from "node:test";
import {
  filterExpectedUcatAppError,
  nativeSentryTracePropagationTargets,
  resolveNativeSentryEnvironment,
  shouldEnableNativeSentry,
} from "../lib/sentry";

test("native Sentry stays off until a DSN is configured", () => {
  assert.equal(shouldEnableNativeSentry(undefined), false);
  assert.equal(shouldEnableNativeSentry("   "), false);
  assert.equal(
    shouldEnableNativeSentry("https://public@o0.ingest.sentry.io/1"),
    true,
  );
});

test("native Sentry environment prefers an explicit tag over the bundle mode", () => {
  assert.equal(
    resolveNativeSentryEnvironment({ explicit: "preview", isDev: true }),
    "preview",
  );
  assert.equal(
    resolveNativeSentryEnvironment({ explicit: "  production  ", isDev: true }),
    "production",
  );
  assert.equal(
    resolveNativeSentryEnvironment({ isDev: true }),
    "development",
  );
  assert.equal(
    resolveNativeSentryEnvironment({ isDev: false }),
    "production",
  );
});

test("native tracing headers stay on UCAT origins", () => {
  const targets = nativeSentryTracePropagationTargets(
    "http://127.0.0.1:3016",
  );
  assert.ok(targets.includes("localhost"));
  assert.ok(targets.includes("127.0.0.1"));
  assert.ok(
    targets.some(
      (target) =>
        target instanceof RegExp &&
        target.test("https://ucat.altitutor.com/api/ucat/practice"),
    ),
  );
  const lan = nativeSentryTracePropagationTargets(
    "http://192.168.1.12:3016",
  );
  assert.ok(lan.includes("192.168.1.12"));
});

test("expected student outcomes are not reported as native crashes", () => {
  assert.equal(
    filterExpectedUcatAppError({
      exception: { values: [{ value: "QUOTA_EXCEEDED" }] },
    }),
    null,
  );
  assert.equal(
    filterExpectedUcatAppError(
      { message: "sign in failed" },
      { originalException: new Error("Invalid login credentials") },
    ),
    null,
  );
  assert.equal(
    filterExpectedUcatAppError({
      message: "Please sign in to continue.",
    }),
    null,
  );
  const unexpected = { message: "Native exam sync failed" };
  assert.equal(filterExpectedUcatAppError(unexpected), unexpected);
});
