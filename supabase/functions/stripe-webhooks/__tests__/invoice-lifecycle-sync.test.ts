import { describe, it } from "jsr:@std/testing/bdd";
import { expect } from "jsr:@std/expect";
import type Stripe from "npm:stripe@16.6.0";
import {
  type InvoiceLifecycleUpdate,
  synchronizePersistedInvoice,
} from "../shared/invoice-lifecycle-sync.ts";

function stripeInvoice(
  status: Stripe.Invoice.Status,
  overrides: Partial<Stripe.Invoice> = {},
): Stripe.Invoice {
  return {
    id: "in_session_123",
    object: "invoice",
    status,
    created: 1_788_867_011,
    subtotal: 7_500,
    total: 7_500,
    amount_due: status === "paid" ? 0 : 7_500,
    amount_paid: 0,
    currency: "aud",
    number: "AT-0001",
    collection_method: "charge_automatically",
    auto_advance: false,
    hosted_invoice_url: "https://invoice.stripe.test/in_session_123",
    invoice_pdf: "https://invoice.stripe.test/in_session_123.pdf",
    metadata: { type: "session_invoice" },
    status_transitions: {
      finalized_at: 1_788_867_011,
      paid_at: status === "paid" ? 1_788_867_011 : null,
      marked_uncollectible_at: null,
      voided_at: null,
    },
    ...overrides,
  } as Stripe.Invoice;
}

describe("persisted invoice lifecycle synchronization", () => {
  it("persists current Stripe state instead of an older webhook snapshot", async () => {
    const webhookSnapshot = stripeInvoice("draft");
    const currentStripeInvoice = stripeInvoice("paid");
    const persisted: InvoiceLifecycleUpdate[] = [];

    await synchronizePersistedInvoice({
      stripeInvoiceId: webhookSnapshot.id,
      retrieveInvoice: () => Promise.resolve(currentStripeInvoice),
      persistInvoice: (_invoiceId, update) => {
        persisted.push(update);
        return Promise.resolve({ matched: true });
      },
    });

    expect(persisted[0]?.status).toBe("paid");
  });

  it("cannot overwrite paid when an earlier draft synchronization finishes later", async () => {
    let persistedStatus: Stripe.Invoice.Status = "draft";
    const persistInvoice = (
      _invoiceId: string,
      update: InvoiceLifecycleUpdate,
      allowedCurrentStatuses: Stripe.Invoice.Status[],
    ) => {
      if (allowedCurrentStatuses.includes(persistedStatus)) {
        persistedStatus = update.status;
      }
      return Promise.resolve({ matched: true });
    };

    await synchronizePersistedInvoice({
      stripeInvoiceId: "in_session_123",
      retrieveInvoice: () => Promise.resolve(stripeInvoice("paid")),
      persistInvoice,
    });
    await synchronizePersistedInvoice({
      stripeInvoiceId: "in_session_123",
      retrieveInvoice: () => Promise.resolve(stripeInvoice("draft")),
      persistInvoice,
    });

    expect(persistedStatus).toBe("paid");
  });

  it("retries a session invoice webhook when the runner has not persisted its row yet", async () => {
    const currentStripeInvoice = stripeInvoice("paid");

    await expect(synchronizePersistedInvoice({
      stripeInvoiceId: currentStripeInvoice.id,
      retrieveInvoice: () => Promise.resolve(currentStripeInvoice),
      persistInvoice: () => Promise.resolve({ matched: false }),
    })).rejects.toThrow(
      "Session invoice in_session_123 is not persisted yet",
    );
  });

  it("does not retry a deliberately removed terminal session invoice", async () => {
    const currentStripeInvoice = stripeInvoice("void");

    await expect(synchronizePersistedInvoice({
      stripeInvoiceId: currentStripeInvoice.id,
      retrieveInvoice: () => Promise.resolve(currentStripeInvoice),
      persistInvoice: () => Promise.resolve({ matched: false }),
    })).resolves.toEqual({
      invoice: currentStripeInvoice,
      persistence: { matched: false },
    });
  });

  it("persists the complete authoritative lifecycle including immediate balance payment", async () => {
    const persisted: InvoiceLifecycleUpdate[] = [];

    await synchronizePersistedInvoice({
      stripeInvoiceId: "in_session_123",
      retrieveInvoice: () => Promise.resolve(stripeInvoice("paid")),
      persistInvoice: (_invoiceId, update) => {
        persisted.push(update);
        return Promise.resolve({ matched: true });
      },
    });

    expect(persisted[0]).toEqual({
      status: "paid",
      stripe_invoice_number: "AT-0001",
      subtotal_cents: 7_500,
      total_cents: 7_500,
      amount_due_cents: 0,
      amount_paid_cents: 0,
      amount_paid_from_balance_cents: 7_500,
      currency: "aud",
      collection_method: "charge_automatically",
      auto_advance: false,
      hosted_invoice_url: "https://invoice.stripe.test/in_session_123",
      invoice_pdf: "https://invoice.stripe.test/in_session_123.pdf",
      finalized_at: "2026-09-08T11:30:11.000Z",
      paid_at: "2026-09-08T11:30:11.000Z",
    });
  });
});
