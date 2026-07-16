'use client';

import posthog from 'posthog-js';

export const STUDENT_ANALYTICS_CONTEXT = {
  app: 'student-web',
  product: 'online-learning',
} as const;

export function getStudentAnalyticsSurface(pathname: string) {
  if (
    pathname.startsWith('/login') ||
    pathname.startsWith('/register') ||
    pathname.startsWith('/forgot-password') ||
    pathname.startsWith('/reset-password')
  ) {
    return 'auth';
  }
  if (pathname.startsWith('/billing')) return 'checkout';
  return 'application';
}

export function captureStudentEvent(
  event: string,
  properties: Record<string, unknown> = {},
) {
  if (!posthog.__loaded) return;

  posthog.capture(event, {
    ...STUDENT_ANALYTICS_CONTEXT,
    ...properties,
  });
}

export { posthog };
