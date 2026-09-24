"use client";

import * as Sentry from "@sentry/nextjs";

export async function openUserFeedback(): Promise<void> {
  const feedback = Sentry.getFeedback();
  if (!feedback) return;

  const form = await feedback.createForm();
  form.appendToDom();
  form.open();
}
