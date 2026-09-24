export const UCAT_RETENTION_EVENT = "learning_activity_completed";

export type UcatLearningActivityType =
  | "practice"
  | "set"
  | "mock"
  | "lesson"
  | "skill_trainer";

type RetentionEventProperty = string | number | boolean | null;

export type UcatLearningActivityCompletedInput = {
  userId: string;
  activityType: UcatLearningActivityType;
  activityId: string;
  properties?: Record<string, RetentionEventProperty>;
};

export function buildUcatLearningActivityCompletedEvent(
  input: UcatLearningActivityCompletedInput,
) {
  return {
    distinctId: input.userId,
    event: UCAT_RETENTION_EVENT,
    properties: {
      app: "ucat-web",
      product: "ucat",
      surface: "application",
      environment:
        process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ??
        process.env.NODE_ENV ??
        "development",
      activity_type: input.activityType,
      activity_id: input.activityId,
      ...input.properties,
      // Stable across retries and concurrent completion requests so PostHog
      // can collapse duplicate captures of the same durable completion.
      $insert_id: `ucat:${input.activityType}:${input.activityId}:completed`,
    },
  } as const;
}
