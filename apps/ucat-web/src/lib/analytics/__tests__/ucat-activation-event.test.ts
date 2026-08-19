import {
  buildUcatActivationCompletedEvent,
  UCAT_ACTIVATION_DEFINITION,
  UCAT_ACTIVATION_EVENT,
} from "@/lib/analytics/ucat-activation-event";

describe("buildUcatActivationCompletedEvent", () => {
  it("uses a stable insert id for one reviewed attempt", () => {
    const event = buildUcatActivationCompletedEvent({
      userId: "user-1",
      attemptType: "set_attempt",
      attemptId: "attempt-1",
      completionMethod: "automatic",
    });

    expect(event).toMatchObject({
      distinctId: "user-1",
      event: UCAT_ACTIVATION_EVENT,
      properties: {
        product: "ucat",
        activation_definition: UCAT_ACTIVATION_DEFINITION,
        attempt_type: "set_attempt",
        completion_method: "automatic",
        $insert_id: "ucat:activation:set_attempt:attempt-1",
      },
    });
  });
});
