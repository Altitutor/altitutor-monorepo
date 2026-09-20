import { assertEquals, assertRejects } from "jsr:@std/assert";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import {
  releaseUcatCheckoutHold,
  settleFounderCheckout,
} from "./ucat-founder-offers.ts";

Deno.test("checkout expiry releases its own hold even before the session ID was saved", async () => {
  const filters: string[][] = [];
  const builder = {
    delete() {
      return this;
    },
    eq(column: string, value: string) {
      filters.push([column, value]);
      return this;
    },
    then(resolve: (value: { error: null }) => unknown) {
      return Promise.resolve({ error: null }).then(resolve);
    },
  };
  const client = { from: () => builder } as unknown as SupabaseClient;
  await releaseUcatCheckoutHold(client, {
    id: "session",
    metadata: { student_id: "student", ucat_checkout_hold_id: "hold" },
  });
  assertEquals(filters, [["id", "hold"], ["student_id", "student"]]);
});

Deno.test("checkout hold release failures propagate so the webhook can retry", async () => {
  const builder = {
    delete() {
      return this;
    },
    eq() {
      return this;
    },
    then(resolve: (value: { error: Error }) => unknown) {
      return Promise.resolve({ error: new Error("database unavailable") }).then(
        resolve,
      );
    },
  };
  const client = { from: () => builder } as unknown as SupabaseClient;
  await assertRejects(
    () => releaseUcatCheckoutHold(client, { id: "session" }),
    Error,
    "database unavailable",
  );
});

function database(claim: Record<string, unknown>) {
  const updates: Record<string, unknown>[] = [];
  const builder = {
    select() {
      return this;
    },
    eq() {
      return this;
    },
    single: () => Promise.resolve({ data: claim, error: null }),
    update(value: Record<string, unknown>) {
      updates.push(value);
      return this;
    },
    then(resolve: (value: { error: null }) => unknown) {
      return Promise.resolve({ error: null }).then(resolve);
    },
  };
  return {
    client: { from: () => builder } as unknown as SupabaseClient,
    updates,
  };
}
const input = {
  redemptionId: "redemption",
  studentId: "student",
  sessionId: "session",
  subscriptionId: "subscription",
  occurredAt: "2026-09-20T00:00:00Z",
};
Deno.test("founder checkout completion binds the original student, session and subscription", async () => {
  const db = database({
    id: "redemption",
    student_id: "student",
    checkout_session_id: null,
    status: "reserved",
  });
  await settleFounderCheckout(db.client, input);
  assertEquals(db.updates, [{
    status: "redeemed",
    checkout_session_id: "session",
    stripe_subscription_id: "subscription",
    redeemed_at: input.occurredAt,
  }]);
});
Deno.test("founder checkout rejects a session belonging to a different student", async () => {
  const db = database({
    student_id: "another",
    checkout_session_id: "session",
    status: "reserved",
  });
  await assertRejects(
    () => settleFounderCheckout(db.client, input),
    Error,
    "does not match",
  );
  assertEquals(db.updates.length, 0);
});
Deno.test("expired event cannot undo an already redeemed founder benefit", async () => {
  const db = database({
    id: "redemption",
    student_id: "student",
    checkout_session_id: "session",
    status: "redeemed",
  });
  await settleFounderCheckout(db.client, { ...input, expired: true });
  assertEquals(db.updates.length, 0);
});
Deno.test("expiry releases a reserved place without marking it redeemed", async () => {
  const db = database({
    id: "redemption",
    student_id: "student",
    checkout_session_id: "session",
    status: "reserved",
  });
  await settleFounderCheckout(db.client, { ...input, expired: true });
  assertEquals(db.updates, [{
    status: "expired",
    checkout_session_id: "session",
  }]);
});
