"use client";

import * as Sentry from "@sentry/nextjs";

export async function openUserFeedback(
  context?: Record<string, string | number | boolean | null>,
): Promise<void> {
  if (context) {
    Sentry.setContext("ucat_exam", context);
  }
  const feedback = Sentry.getFeedback();
  if (!feedback) return;

  const form = await feedback.createForm();
  form.appendToDom();
  form.open();
}
