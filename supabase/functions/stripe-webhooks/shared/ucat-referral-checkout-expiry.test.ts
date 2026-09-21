import { assertEquals, assertRejects } from "jsr:@std/assert";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { releaseExpiredReferralCheckout } from "./ucat-referral-checkout-expiry.ts";

function database(error: Error | null = null) {
  const calls: unknown[] = [];
  const query = {
    update(value: unknown) {
      calls.push(value);
      return this;
    },
    eq(column: string, value: string) {
      calls.push([column, value]);
      return this;
    },
    then(resolve: (value: { error: Error | null }) => unknown) {
      return Promise.resolve({ error }).then(resolve);
    },
  };
  return {
    calls,
    client: {
      from(table: string) {
        calls.push(table);
        return query;
      },
    } as unknown as SupabaseClient,
  };
}
for (const earned of [false, true]) {
  Deno.test(`expired ${earned ? "earned" : "recipient"} gift releases only its pending session`, async () => {
    const db = database();
    await releaseExpiredReferralCheckout(db.client, {
      id: "old-session",
      metadata: {
        student_id: "student",
        ucat_referral_gift_id: "gift",
        ucat_referral_gift_kind: earned ? "earned_referrer" : "recipient",
      },
    });
    assertEquals(
      db.calls,
      earned
        ? [
          "ucat_referral_access_gifts",
          { status: "available", stripe_checkout_session_id: null },
          ["id", "gift"],
          ["student_id", "student"],
          ["stripe_checkout_session_id", "old-session"],
          ["status", "checkout_pending"],
        ]
        : [
          "ucat_referrals",
          { gift_status: "pending", referred_checkout_session_id: null },
          ["id", "gift"],
          ["referred_student_id", "student"],
          ["referred_checkout_session_id", "old-session"],
          ["gift_status", "checkout_pending"],
        ],
    );
  });
}
Deno.test("expiry ignores sessions without referral ownership metadata", async () => {
  const db = database();
  await releaseExpiredReferralCheckout(db.client, {
    id: "session",
    metadata: { ucat_referral_gift_id: "gift" },
  });
  assertEquals(db.calls, []);
});
Deno.test("expiry propagates failures so Stripe retries cleanup", async () => {
  const db = database(new Error("database unavailable"));
  await assertRejects(
    () =>
      releaseExpiredReferralCheckout(db.client, {
        id: "session",
        metadata: { student_id: "student", ucat_referral_gift_id: "gift" },
      }),
    Error,
    "database unavailable",
  );
});
