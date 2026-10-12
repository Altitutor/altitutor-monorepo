import assert from "node:assert/strict";
import { test } from "node:test";
import {
  filterExpectedUcatAppError,
  nativeSentryTracePropagationTargets,
} from "../lib/sentry";

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

test('native filtering retains unexpected messages containing an expected phrase', () => {
  const failures = [
    'Unexpected sync failure: Please sign in again',
    'Unable to complete sign-in. Please sign in again.',
    'invalid_study_plan_task',
    'permission denied for function ucat_study_plan_task_has_active_work',
    'Failed to fetch',
  ];
  for (const message of failures) {
    const event = { message };
    assert.equal(filterExpectedUcatAppError(event), event);
  }
});
