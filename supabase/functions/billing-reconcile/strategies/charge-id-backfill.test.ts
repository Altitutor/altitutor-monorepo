import { assertEquals } from "jsr:@std/assert@^1.0.15";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import Stripe from "npm:stripe@16.6.0";
import { reconcileChargeIdBackfill } from "./charge-id-backfill.ts";

function buildInvoices(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    id: `invoice-row-${index}`,
    stripe_invoice_id: `in_test_${index}`,
    stripe_charge_id: null,
    stripe_payment_intent_id: null,
  }));
}

function createSupabaseWithInvoices(
  invoices: ReturnType<typeof buildInvoices>,
): SupabaseClient {
  const query = {
    select: () => query,
    eq: () => query,
    is: () => query,
    not: () => query,
    gte: () => query,
    order: () => Promise.resolve({ data: invoices, error: null }),
  };

  return { from: () => query } as unknown as SupabaseClient;
}

Deno.test("report-only charge ID backfill stays bounded without Stripe retrievals", async () => {
  const invoices = buildInvoices(147);
  let retrieveCalls = 0;
  const stripe = {
    invoices: {
      retrieve: () => {
        retrieveCalls += 1;
        return Promise.resolve({});
      },
    },
  } as unknown as Stripe;

  const result = await reconcileChargeIdBackfill(
    stripe,
    createSupabaseWithInvoices(invoices),
    7,
    false,
  );

  assertEquals(retrieveCalls, 0);
  assertEquals(result.warnings.length, 147);
  assertEquals(result.mismatches?.length, 147);
  assertEquals(result.errors, []);
});

Deno.test("fix mode still retrieves and persists Stripe payment identifiers", async () => {
  const invoices = buildInvoices(1);
  const updates: unknown[] = [];
  const selectQuery = {
    select: () => selectQuery,
    eq: () => selectQuery,
    is: () => selectQuery,
    not: () => selectQuery,
    gte: () => selectQuery,
    order: () => Promise.resolve({ data: invoices, error: null }),
  };
  const updateQuery = {
    eq: () => updateQuery,
    is: () => Promise.resolve({ error: null }),
  };
  const supabase = {
    from: () => ({
      ...selectQuery,
      update: (value: unknown) => {
        updates.push(value);
        return updateQuery;
      },
    }),
  } as unknown as SupabaseClient;
  const stripe = {
    invoices: {
      retrieve: () =>
        Promise.resolve({
          charge: "ch_test_1",
          payment_intent: "pi_test_1",
        }),
    },
  } as unknown as Stripe;

  const result = await reconcileChargeIdBackfill(stripe, supabase, 7, true);

  assertEquals(updates, [{
    stripe_charge_id: "ch_test_1",
    stripe_payment_intent_id: "pi_test_1",
  }]);
  assertEquals(result.reconciled, ["in_test_0"]);
  assertEquals(result.errors, []);
});
