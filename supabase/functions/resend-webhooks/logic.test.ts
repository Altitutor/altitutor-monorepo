import { assertEquals, assertThrows } from "jsr:@std/assert";
import { parseTrackedResendEvent, posthogEventName } from "./logic.ts";

const delivered = {
  type: "email.delivered",
  created_at: "2026-07-30T01:02:03.000Z",
  data: {
    email_id: "email_123",
    to: ["Student@Example.com"],
    subject: "This must not be persisted",
    from: "Altitutor <hello@altitutor.com>",
    tags: {
      product: "ucat",
      template: "trial_ending",
      unsafe_extra: "not retained",
    },
  },
};

Deno.test("parses a tracked event without copying email content metadata", () => {
  assertEquals(parseTrackedResendEvent(delivered), {
    type: "email.delivered",
    occurredAt: "2026-07-30T01:02:03.000Z",
    providerMessageId: "email_123",
    recipientEmail: "student@example.com",
    metadata: {
      tag_product: "ucat",
      tag_template: "trial_ending",
    },
  });
});

Deno.test("stores only the click hostname, not the complete tracked URL", () => {
  const event = parseTrackedResendEvent({
    ...delivered,
    type: "email.clicked",
    data: {
      ...delivered.data,
      click: {
        link: "https://ucat.altitutor.com/progress?token=secret-value",
      },
    },
  });

  assertEquals(event?.metadata, {
    tag_product: "ucat",
    tag_template: "trial_ending",
    click_host: "ucat.altitutor.com",
  });
  assertEquals(posthogEventName("email.clicked"), "email clicked");
});

Deno.test("ignores signed event types that are outside the email event stream", () => {
  assertEquals(
    parseTrackedResendEvent({
      ...delivered,
      type: "contact.updated",
    }),
    null,
  );
});

Deno.test("rejects malformed tracked events", () => {
  assertThrows(
    () =>
      parseTrackedResendEvent({
        ...delivered,
        data: { to: ["student@example.com"] },
      }),
    Error,
    "Webhook email ID is required",
  );
});
