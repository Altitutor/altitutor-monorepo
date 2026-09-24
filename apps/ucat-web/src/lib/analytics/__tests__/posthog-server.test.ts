import {
  buildUcatLearningActivityCompletedEvent,
  UCAT_RETENTION_EVENT,
} from "@/lib/analytics/ucat-retention-event";

describe("UCAT retention analytics", () => {
  const originalEnvironment = process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT;

  afterEach(() => {
    if (originalEnvironment === undefined) {
      delete process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT;
    } else {
      process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT = originalEnvironment;
    }
  });

  it("builds one normalized learning completion event", () => {
    process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT = "preview";

    expect(
      buildUcatLearningActivityCompletedEvent({
        userId: "user-123",
        activityType: "mock",
        activityId: "attempt-456",
        properties: { completion_source: "question_engine" },
      }),
    ).toEqual({
      distinctId: "user-123",
      event: UCAT_RETENTION_EVENT,
      properties: {
        app: "ucat-web",
        product: "ucat",
        surface: "application",
        environment: "preview",
        activity_type: "mock",
        activity_id: "attempt-456",
        completion_source: "question_engine",
        $insert_id: "ucat:mock:attempt-456:completed",
      },
    });
  });
});
