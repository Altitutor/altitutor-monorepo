import type { NextRequest } from "next/server";
import { captureInPersonBookingEventInBackground } from "@/shared/lib/analytics/posthog-server";
import {
  readPosthogIdentityFromHeaders,
  type InPersonBookingDurableEvent,
  type InPersonPublicBookingType,
} from "@/shared/lib/analytics/in-person-booking-event";

export function capturePublicBookingOutcome(
  request: NextRequest,
  input: {
    event: InPersonBookingDurableEvent;
    sessionId: string;
    sessionType: InPersonPublicBookingType;
    studentId?: string | null;
    properties?: Record<string, string | number | boolean | string[] | null>;
  },
) {
  const identity = readPosthogIdentityFromHeaders(request.headers);
  captureInPersonBookingEventInBackground({
    ...input,
    distinctId: identity.distinctId || input.studentId || input.sessionId,
    posthogSessionId: identity.sessionId,
  });
}
