export const IN_PERSON_ANALYTICS_CONTEXT = {
  app: "student-web",
  product: "in-person",
  journey: "in_person_enrollment",
  surface: "booking",
} as const;

export type InPersonPublicBookingType = "TRIAL_SESSION" | "SUBSIDY_INTERVIEW";

export const IN_PERSON_BOOKING_EVENTS = {
  started: "booking_started",
  stepCompleted: "booking_step_completed",
  failed: "booking_failed",
  completed: "booking_completed",
  cancelled: "booking_cancelled",
  rescheduled: "booking_rescheduled",
} as const;

export type InPersonBookingDurableEvent =
  | typeof IN_PERSON_BOOKING_EVENTS.completed
  | typeof IN_PERSON_BOOKING_EVENTS.cancelled
  | typeof IN_PERSON_BOOKING_EVENTS.rescheduled;

type AnalyticsProperty = string | number | boolean | string[] | null;

export function buildPosthogIdentityHeaders(identity: {
  distinctId?: string | null;
  sessionId?: string | null;
}): Record<string, string> {
  return {
    ...(identity.distinctId
      ? { "X-POSTHOG-DISTINCT-ID": identity.distinctId }
      : {}),
    ...(identity.sessionId
      ? { "X-POSTHOG-SESSION-ID": identity.sessionId }
      : {}),
  };
}

export function readPosthogIdentityFromHeaders(headers: Headers): {
  distinctId: string | null;
  sessionId: string | null;
} {
  const distinctId = headers.get("x-posthog-distinct-id")?.trim() || null;
  const sessionId = headers.get("x-posthog-session-id")?.trim() || null;
  return { distinctId, sessionId };
}

export function inPersonBookingInsertId(
  event: InPersonBookingDurableEvent,
  sessionId: string,
  disambiguator?: string,
): string {
  return disambiguator
    ? `in-person:${event}:${sessionId}:${disambiguator}`
    : `in-person:${event}:${sessionId}`;
}

export function buildInPersonBookingEvent(input: {
  event: InPersonBookingDurableEvent;
  distinctId: string;
  sessionId: string;
  sessionType: InPersonPublicBookingType;
  studentId?: string | null;
  occurredAt?: string;
  posthogSessionId?: string | null;
  properties?: Record<string, AnalyticsProperty>;
}) {
  return {
    distinctId: input.distinctId,
    event: input.event,
    ...(input.occurredAt ? { timestamp: new Date(input.occurredAt) } : {}),
    properties: {
      ...IN_PERSON_ANALYTICS_CONTEXT,
      environment:
        process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ??
        process.env.NODE_ENV ??
        "development",
      session_id: input.sessionId,
      session_type: input.sessionType,
      student_id: input.studentId ?? null,
      ...(input.posthogSessionId
        ? { $session_id: input.posthogSessionId }
        : {}),
      $insert_id: inPersonBookingInsertId(
        input.event,
        input.sessionId,
        input.event === IN_PERSON_BOOKING_EVENTS.rescheduled
          ? input.occurredAt
          : undefined,
      ),
      ...input.properties,
    },
  } as const;
}
