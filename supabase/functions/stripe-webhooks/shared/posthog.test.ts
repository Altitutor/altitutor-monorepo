import { assertEquals } from "jsr:@std/assert";
import {
  buildUcatSubscriptionPosthogBody,
  isUcatPaidAcquisitionConversion,
  isUcatSubscriptionRenewal,
} from "./posthog.ts";

Deno.test("buildUcatSubscriptionPosthogBody uses stable provider deduplication", async () => {
  const input = {
    token: "test-token",
    eventName: "subscription_renewed",
    providerEventId: "evt_123",
    occurredAt: "2026-08-31T00:00:00.000Z",
    authUserId: "user-1",
    studentId: "student-1",
    accountClass: "external",
    properties: { amount_paid_cents: 4_000 },
  } as const;
  const body = await buildUcatSubscriptionPosthogBody(input);

  assertEquals(body.distinct_id, "user-1");
  assertEquals(body.uuid, (await buildUcatSubscriptionPosthogBody(input)).uuid);
  assertEquals(body.properties.amount_paid_cents, 4_000);
  assertEquals(body.properties.account_class, "external");
});

Deno.test("paid acquisition requires the first positive subscription payment", () => {
  assertEquals(isUcatPaidAcquisitionConversion(1_500, 0), true);
  assertEquals(isUcatPaidAcquisitionConversion(0, 0), false);
  assertEquals(isUcatPaidAcquisitionConversion(1_500, 1), false);
});

Deno.test("renewal requires a positive recurring-cycle invoice", () => {
  assertEquals(isUcatSubscriptionRenewal("subscription_cycle", 4_000), true);
  assertEquals(isUcatSubscriptionRenewal("subscription_create", 4_000), false);
  assertEquals(isUcatSubscriptionRenewal("subscription_cycle", 0), false);
});
