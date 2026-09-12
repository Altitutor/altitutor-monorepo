import { expect } from "jsr:@std/expect";
import { describe, it } from "jsr:@std/testing/bdd";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import type Stripe from "npm:stripe@16.6.0";
import { applyQueuedReferralRewardToInvoice } from "../shared/ucat-referral-rewards.ts";

describe("UCAT referral invoice rewards", () => {
  it("recognises a subscription-cycle invoice using the Clover parent shape", async () => {
    const tables: string[] = [];
    const filters: Array<{ column: string; value: unknown }> = [];
    type Query = {
      select: () => Query;
      eq: (column: string, value: unknown) => Query;
      maybeSingle: () => Promise<{ data: null; error: null }>;
    };
    const query: Query = {
      select(): Query {
        return query;
      },
      eq(column: string, value: unknown): Query {
        filters.push({ column, value });
        return query;
      },
      maybeSingle(): Promise<{ data: null; error: null }> {
        return Promise.resolve({ data: null, error: null });
      },
    };
    const supabase = {
      from(table: string): Query {
        tables.push(table);
        return query;
      },
    } as unknown as SupabaseClient;

    const applied = await applyQueuedReferralRewardToInvoice({
      supabase,
      stripe: {} as Stripe,
      invoice: {
        billing_reason: "subscription_cycle",
        parent: {
          type: "subscription_details",
          subscription_details: { subscription: "sub_clover" },
        },
      } as unknown as Stripe.Invoice,
    });

    expect(applied).toBe(false);
    expect(tables).toEqual(["student_subscriptions", "subjects"]);
    expect(filters).toContainEqual({
      column: "stripe_subscription_id",
      value: "sub_clover",
    });
  });
});
