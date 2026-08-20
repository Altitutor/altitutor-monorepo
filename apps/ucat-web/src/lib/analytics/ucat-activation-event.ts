export const UCAT_ACTIVATION_EVENT = "activation_completed";
export const UCAT_ACTIVATION_DEFINITION =
  "completed_attempt_and_reviewed_results_v1";

export type UcatActivationAttemptType =
  | "practice_session"
  | "set_attempt"
  | "mock_attempt";

export type UcatActivationCompletedInput = {
  userId: string;
  attemptType: UcatActivationAttemptType;
  attemptId: string;
  completionMethod: "automatic" | "manual" | null;
};

export function buildUcatActivationCompletedEvent(
  input: UcatActivationCompletedInput,
) {
  return {
    distinctId: input.userId,
    event: UCAT_ACTIVATION_EVENT,
    properties: {
      app: "ucat-web",
      product: "ucat",
      surface: "application",
      environment:
        process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ??
        process.env.NODE_ENV ??
        "development",
      activation_definition: UCAT_ACTIVATION_DEFINITION,
      attempt_type: input.attemptType,
      attempt_id: input.attemptId,
      completion_method: input.completionMethod,
      $insert_id: `ucat:activation:${input.attemptType}:${input.attemptId}`,
    },
  } as const;
}
