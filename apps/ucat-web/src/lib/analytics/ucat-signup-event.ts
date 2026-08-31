import type {
  UcatAcquisitionSource,
  UcatObservedFirstTouch,
} from "@altitutor/shared";
import { createHash } from "node:crypto";

export const UCAT_SIGNUP_COMPLETED_EVENT = "signup_completed";

export type UcatSignupCompletedInput = {
  userId: string;
  studentId: string;
  completedAt: string;
  accountClass: "external" | "internal_test";
  selfReportedSources: UcatAcquisitionSource[];
  selfReportedOther: string | null;
  observedFirstTouch: UcatObservedFirstTouch | null;
};

function deterministicEventUuid(key: string): string {
  const hex = createHash("sha256").update(key).digest("hex").slice(0, 32);
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    `5${hex.slice(13, 16)}`,
    `8${hex.slice(17, 20)}`,
    hex.slice(20),
  ].join("-");
}

export function buildUcatSignupCompletedEvent(
  input: UcatSignupCompletedInput,
) {
  return {
    distinctId: input.userId,
    event: UCAT_SIGNUP_COMPLETED_EVENT,
    timestamp: new Date(input.completedAt),
    uuid: deterministicEventUuid(
      `ucat:signup_completed:${input.studentId}`,
    ),
    properties: {
      app: "ucat-web",
      product: "ucat",
      surface: "signup",
      environment:
        process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ??
        process.env.NODE_ENV ??
        "development",
      student_id: input.studentId,
      account_class: input.accountClass,
      self_reported_acquisition_sources: input.selfReportedSources,
      self_reported_acquisition_other: input.selfReportedOther,
      initial_utm_source: input.observedFirstTouch?.utmSource ?? null,
      initial_utm_medium: input.observedFirstTouch?.utmMedium ?? null,
      initial_utm_campaign: input.observedFirstTouch?.utmCampaign ?? null,
      initial_utm_content: input.observedFirstTouch?.utmContent ?? null,
      initial_utm_term: input.observedFirstTouch?.utmTerm ?? null,
      initial_referrer_domain:
        input.observedFirstTouch?.referrerDomain ?? null,
      initial_landing_path: input.observedFirstTouch?.landingPath ?? null,
    },
  } as const;
}
