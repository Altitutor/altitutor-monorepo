import { describe, it } from "jsr:@std/testing/bdd";
import { expect } from "jsr:@std/expect";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import type Stripe from "npm:stripe@16.6.0";
import { saveInvoiceToDatabase } from "../invoice-creation.ts";

function immediatelyPaidInvoice(): Stripe.Invoice {
  return {
    id: "in_session_paid_from_balance",
    object: "invoice",
    status: "paid",
    number: "AT-0002",
    subtotal: 7_500,
    total: 7_500,
    amount_due: 0,
    amount_paid: 0,
    currency: "aud",
    collection_method: "charge_automatically",
    auto_advance: false,
    hosted_invoice_url: "https://invoice.stripe.test/paid",
    invoice_pdf: "https://invoice.stripe.test/paid.pdf",
    status_transitions: {
      finalized_at: 1_788_867_011,
      paid_at: 1_788_867_011,
      marked_uncollectible_at: null,
      voided_at: null,
    },
  } as Stripe.Invoice;
}

describe("saveInvoiceToDatabase", () => {
  it("persists paid_at when Stripe finalizes an invoice already paid from balance", async () => {
    const insertedRows: Array<Record<string, unknown>> = [];
    const existingQuery = {
      select: () => existingQuery,
      eq: () => existingQuery,
      is: () => existingQuery,
      maybeSingle: () => Promise.resolve({ data: null }),
    };
    const insertedResult = {
      select: () => insertedResult,
      single: () =>
        Promise.resolve({
          data: { id: "invoice-row-id", status: "paid" },
          error: null,
        }),
    };
    const insertQuery = {
      insert: (row: Record<string, unknown>) => {
        insertedRows.push(row);
        return insertedResult;
      },
    };
    let invoicesQueryCount = 0;
    const supabase = {
      from: (table: string) => {
        expect(table).toBe("invoices");
        invoicesQueryCount += 1;
        return invoicesQueryCount === 1 ? existingQuery : insertQuery;
      },
    } as unknown as SupabaseClient;

    await saveInvoiceToDatabase(
      supabase,
      "student-id",
      immediatelyPaidInvoice(),
      "2026-09-09",
    );

    expect(insertedRows[0]?.paid_at).toBe("2026-09-08T11:30:11.000Z");
  });
});
