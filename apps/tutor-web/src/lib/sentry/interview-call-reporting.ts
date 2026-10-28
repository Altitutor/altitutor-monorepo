"use client";
import { createInterviewCallReporter } from "@altitutor/shared";
import * as Sentry from "@sentry/nextjs";

// The browser's beforeSend enforces collection policy and scrubs inherited scope.
export const reportInterviewCallFailure = createInterviewCallReporter(
  "tutor-web",
  (event) => Sentry.captureEvent(event),
);
