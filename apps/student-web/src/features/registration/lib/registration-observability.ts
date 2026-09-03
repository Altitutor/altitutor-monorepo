"use client";

import * as Sentry from "@sentry/nextjs";
import { captureStudentEvent } from "@/shared/lib/analytics/posthog";

export const REGISTRATION_STEPS = [
  "student_details",
  "parent_details",
  "availability",
  "password",
  "payment_method",
  "confirmation",
] as const;

export type RegistrationStep = (typeof REGISTRATION_STEPS)[number];

let registrationSubjectKey: string | undefined;

type SafeRegistrationProperties = {
  step?: RegistrationStep;
  step_number?: number;
  skip_password?: boolean;
  result_code?: string;
  http_status?: number;
  retry_number?: number;
  payment_method_verified?: boolean;
};

export function captureRegistrationEvent(
  event: `student_registration_${string}`,
  properties: SafeRegistrationProperties = {},
) {
  captureStudentEvent(event, {
    journey: "student_registration",
    registration_subject_key: registrationSubjectKey,
    ...properties,
  });
}

export function captureRegistrationOperationalError(
  error: unknown,
  stage: string,
  resultCode: string,
) {
  const exception = error instanceof Error ? error : new Error(resultCode);
  Sentry.captureException(exception, {
    tags: {
      journey: "student_registration",
      registration_stage: stage,
      result_code: resultCode,
      ...(registrationSubjectKey
        ? { registration_subject_key: registrationSubjectKey }
        : {}),
    },
  });
}

/**
 * Correlates an anonymous journey with a database record without sending the
 * student ID, registration token, or contact details to observability tools.
 */
export async function initializeRegistrationObservability(studentId: string) {
  if (!globalThis.crypto?.subtle) return;
  const bytes = new TextEncoder().encode(studentId);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  registrationSubjectKey = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

export function clearRegistrationObservability() {
  registrationSubjectKey = undefined;
}

export function registrationStepAt(index: number): RegistrationStep {
  return REGISTRATION_STEPS[index] ?? "confirmation";
}
