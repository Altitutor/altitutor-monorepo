/**
 * Opt-in integration exercise: real Stripe sandbox + dedicated Dev DB fixtures.
 * Run from the repository root with the admin-web development env file:
 * deno run --config supabase/functions/deno.json --no-check --allow-env --allow-net --allow-read --allow-write=/tmp \
 *   --env-file=/path/to/admin-web/.env.local supabase/scripts/test-paid-invoice-sandbox.ts
 * --no-check matches Edge deployment; the full handler has existing type debt.
 * Optional first argument: a file URL for a baseline webhook entry point.
 * Never uses a live key. Does not deploy a function or change existing students.
 */
import Stripe from "npm:stripe@16.6.0";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { assert, assertEquals } from "jsr:@std/assert@1";
import {
  createDraftChargeAutomaticallyInvoice,
  createStripeInvoiceItems,
  finalizeInvoice,
  saveInvoiceItemsToDatabase,
  saveInvoiceToDatabase,
} from "../functions/billing-runner/shared/invoice-creation.ts";
import { retrievePaidInvoiceWithLines } from "../functions/stripe-webhooks/shared/invoice-retrieval.ts";
import { syncSubscriptionInvoiceFromStripe } from "../functions/stripe-webhooks/shared/subscription-invoice-sync.ts";

const devUrl = "https://ysfslbdcacpbemodkwtl.supabase.co";
const key = Deno.env.get("STRIPE_SECRET_KEY")?.trim() ?? "";
assert(
  key.startsWith("sk_test_") || key.startsWith("rk_test_"),
  "Sandbox key required",
);
assertEquals(Deno.env.get("NEXT_PUBLIC_SUPABASE_URL"), devUrl);
const dbKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
assert(dbKey, "Development service role required");
const stripe = new Stripe(key, { apiVersion: "2024-06-20" });
assertEquals((await stripe.accounts.retrieve()).id, "acct_1SMTeBKMw7Xacevs");
const db = createClient(devUrl, dbKey, { auth: { persistSession: false } });
const runId = `alti573_${Date.now()}`;
const manifestPath = `/tmp/${runId}.json`;
const fixtures: {
  studentId: string;
  customerId?: string;
  invoiceId?: string;
}[] = [];
const results: Record<string, unknown>[] = [];
const saveManifest = () =>
  Deno.writeTextFile(
    manifestPath,
    JSON.stringify({ runId, fixtures, results }, null, 2),
  );
const signingSecret = `whsec_${crypto.randomUUID()}`;
Deno.env.set("SUPABASE_URL", devUrl);
Deno.env.set("STRIPE_WEBHOOK_SECRET", signingSecret);
Deno.env.set("SENTRY_DSN", "");
Deno.env.set("POSTHOG_PROJECT_TOKEN", "");
Deno.env.set("POSTHOG_API_KEY", "");

// Run the unmodified candidate entry point through its real HTTP/signature path.
const originalServe = Deno.serve;
let server: Deno.HttpServer | undefined;
Deno.serve = ((handler: Deno.ServeHandler) => {
  server = originalServe(
    { hostname: "127.0.0.1", port: 18735, onListen() {} },
    handler,
  );
  return server;
}) as typeof Deno.serve;
await import(
  Deno.args[0] ??
    new URL("../functions/stripe-webhooks/index.ts", import.meta.url).href
);
Deno.serve = originalServe;

const errorMessages: string[] = [];
const originalError = console.error;
console.error = (...args: unknown[]) => {
  errorMessages.push(args.map(String).join(" "));
  originalError(...args);
};

async function deliver(event: Record<string, unknown>) {
  const payload = JSON.stringify(event);
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = await Stripe.createSubtleCryptoProvider()
    .computeHMACSignatureAsync(
      `${timestamp}.${payload}`,
      signingSecret,
    );
  const header = `t=${timestamp},v1=${signature}`;
  const response = await fetch("http://127.0.0.1:18735", {
    method: "POST",
    headers: { "stripe-signature": header },
    body: payload,
  });
  assertEquals(response.status, 200);
  return await response.json();
}

async function readInvoice(id: string) {
  const { data, error } = await db.from("invoices").select("*").eq(
    "stripe_invoice_id",
    id,
  ).single();
  assertEquals(error, null);
  return data;
}

async function readItems(id: string) {
  const { data, error } = await db.from("invoice_items").select("*").eq(
    "invoice_id",
    id,
  ).order("id");
  assertEquals(error, null);
  return data;
}

async function waitForHostedPaidEvent(invoiceId: string) {
  for (let i = 0; i < 30; i++) {
    const { data, error } = await db.from("stripe_webhook_events")
      .select("stripe_event_id,event_data,processed")
      .eq("event_type", "invoice.paid").eq(
        "event_data->data->object->>id",
        invoiceId,
      );
    assertEquals(error, null);
    const event = data?.find((row) => row.processed);
    if (event) return event.event_data as Record<string, unknown>;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(
    `Hosted Dev webhook did not process ${invoiceId} within 30 seconds`,
  );
}

try {
  for (
    const scenario of [
      { name: "card", total: 10000, balance: 0, lines: 1 },
      { name: "partial_balance", total: 10000, balance: 3000, lines: 1 },
      { name: "full_balance", total: 10000, balance: 10000, lines: 1 },
      { name: "zero", total: 0, balance: 0, lines: 1 },
      { name: "paginated", total: 12000, balance: 0, lines: 12 },
    ]
  ) {
    console.log(`START ${scenario.name}`);
    const studentId = crypto.randomUUID();
    const fixture: typeof fixtures[number] = { studentId };
    fixtures.push(fixture);
    await saveManifest();
    const student = await db.from("students").insert({
      id: studentId,
      first_name: "ALTI-573",
      last_name: `${runId}_${scenario.name}`,
      account_class: "internal_test",
    });
    assertEquals(student.error, null);
    const customer = await stripe.customers.create({
      name: `${runId}_${scenario.name}`,
      balance: -scenario.balance,
      metadata: { test_run: runId },
    });
    assertEquals(customer.livemode, false);
    fixture.customerId = customer.id;
    await saveManifest();
    const pm = await stripe.paymentMethods.attach("pm_card_visa", {
      customer: customer.id,
    });
    const draft = await createDraftChargeAutomaticallyInvoice(
      stripe,
      customer.id,
      pm.id,
      "2099-01-01",
      studentId,
      true,
      false,
      Date.now(),
      undefined,
      `${runId}_${scenario.name}`,
    );
    fixture.invoiceId = draft.id;
    await saveManifest();
    const { stripeInvoiceItems } = await createStripeInvoiceItems(
      stripe,
      customer.id,
      Array.from({ length: scenario.lines }, (_, i) => ({
        // These isolated lines have no session rows. Distinct amounts avoid the
        // runner's intentional same-amount non-session-item idempotency key.
        student_id: studentId,
        amount_cents: i === scenario.lines - 1
          ? scenario.total / scenario.lines -
            (scenario.lines - 1) * (scenario.lines - 2) / 2
          : scenario.total / scenario.lines + i,
        description: `${runId} ${scenario.name} line ${i}`,
      })),
      "aud",
      studentId,
      "2099-01-01",
      Date.now(),
      draft.id,
      runId,
    );
    const finalized = await finalizeInvoice(stripe, draft.id, {
      autoAdvance: true,
    });
    const saved = await saveInvoiceToDatabase(
      db,
      studentId,
      finalized,
      "2099-01-01",
    );
    await saveInvoiceItemsToDatabase(db, saved.id, stripeInvoiceItems);
    if (finalized.status !== "paid") await stripe.invoices.pay(draft.id);
    const hostedEvent = await waitForHostedPaidEvent(draft.id);
    const full = await retrievePaidInvoiceWithLines(stripe, draft.id);
    assertEquals(full.status, "paid");
    assertEquals(full.livemode, false);
    assertEquals(full.total, scenario.total);
    assertEquals(full.amount_paid, scenario.total - scenario.balance);
    assertEquals(full.lines.data.length, scenario.lines);
    assertEquals(full.lines.has_more, false);
    const itemsBefore = await readItems(saved.id);
    assertEquals(itemsBefore?.length, scenario.lines);

    // Prove this candidate, not the already deployed webhook, fills these fields.
    const reset = await db.from("invoices").update({
      status: "open",
      subtotal_cents: null,
      total_cents: null,
      stripe_charge_id: null,
      stripe_payment_intent_id: null,
      amount_paid_cents: 0,
      amount_paid_from_balance_cents: 0,
      fee_cents: null,
      net_cents: null,
      receipt_url: null,
    }).eq("id", saved.id);
    assertEquals(reset.error, null);
    const event = { ...hostedEvent, id: `evt_${runId}_${scenario.name}` };
    assertEquals(await deliver(event), { received: true });
    const paid = await readInvoice(draft.id);
    assertEquals(paid.status, "paid");
    assertEquals(paid.billing_source, "session_runner");
    assertEquals(paid.student_subscription_id, null);
    assertEquals(paid.total_cents, scenario.total);
    assertEquals(paid.amount_paid_cents, scenario.total - scenario.balance);
    assertEquals(paid.amount_paid_from_balance_cents, scenario.balance);
    assertEquals(await readItems(saved.id), itemsBefore);
    const idOf = (value: string | { id: string } | null) =>
      typeof value === "string" ? value : value?.id ?? null;
    assertEquals(paid.stripe_charge_id, idOf(full.charge));
    assertEquals(paid.stripe_payment_intent_id, idOf(full.payment_intent));
    if (scenario.total > scenario.balance) {
      assert(paid.stripe_charge_id, "Card payment must retain charge ID");
      const charge = await stripe.charges.retrieve(paid.stripe_charge_id, {
        expand: ["balance_transaction"],
      });
      const transaction = charge
        .balance_transaction as Stripe.BalanceTransaction;
      assertEquals(paid.fee_cents, transaction.fee);
      assertEquals(paid.net_cents, transaction.net);
      // Stripe rotates the signed receipt URL between retrievals.
      assert(paid.receipt_url && charge.receipt_url);
      assertEquals(
        new URL(paid.receipt_url).origin,
        new URL(charge.receipt_url).origin,
      );
      assert(new URL(paid.receipt_url).pathname.startsWith("/receipts/"));
    }
    assertEquals(await deliver(event), {
      received: true,
      already_processed: true,
    });
    assertEquals(await readInvoice(draft.id), paid);
    assertEquals(await readItems(saved.id), itemsBefore);

    // Missing identifiers in the payload must be recovered by the fixed retrieval.
    const fallbackEvent = {
      ...event,
      id: `${event.id}_fallback`,
      data: {
        object: {
          ...full,
          charge: null,
          payment_intent: null,
          subtotal: null,
          total: null,
        },
      },
    };
    assertEquals(await deliver(fallbackEvent), { received: true });
    const recovered = await readInvoice(draft.id);
    assertEquals(recovered.stripe_charge_id, paid.stripe_charge_id);
    assertEquals(
      recovered.stripe_payment_intent_id,
      paid.stripe_payment_intent_id,
    );
    assertEquals(recovered.total_cents, scenario.total);
    assertEquals(await readItems(saved.id), itemsBefore);

    // Exercise both existing ownership guards, even with misleading subscription data.
    assertEquals(
      await syncSubscriptionInvoiceFromStripe(db, stripe, {
        ...full,
        subscription: "sub_guard_fixture",
      }),
      { ok: false, skipped: true, reason: "session_metadata" },
    );
    assertEquals(
      await syncSubscriptionInvoiceFromStripe(db, stripe, {
        ...full,
        metadata: {},
        subscription: "sub_guard_fixture",
      }),
      { ok: false, skipped: true, reason: "session_runner_row" },
    );
    assertEquals(await readItems(saved.id), itemsBefore);
    assertEquals(
      (await readInvoice(draft.id)).billing_source,
      "session_runner",
    );
    const charges = await stripe.charges.list({
      customer: customer.id,
      limit: 100,
    });
    assertEquals(
      charges.data.length,
      scenario.total > scenario.balance ? 1 : 0,
    );
    assertEquals(
      errorMessages,
      [],
      "Candidate handler must not log a hidden processing failure",
    );
    results.push({
      scenario: scenario.name,
      invoiceId: draft.id,
      status: "PASS",
      total: scenario.total,
      amountPaid: paid.amount_paid_cents,
      balanceApplied: paid.amount_paid_from_balance_cents,
      charges: charges.data.length,
      lines: scenario.lines,
      eventApiVersion: hostedEvent.api_version,
    });
    await saveManifest();
    console.log(
      `PASS ${scenario.name}: paid amounts, charge details, replay, fallback, and runner ownership`,
    );
  }
} finally {
  console.error = originalError;
  await server?.shutdown();
  await saveManifest();
  // Keep sandbox invoice/event evidence; remove only this run's isolated DB rows.
  for (const fixture of fixtures) {
    if (fixture.invoiceId) {
      const invoice = await db.from("invoices").select("id").eq(
        "stripe_invoice_id",
        fixture.invoiceId,
      ).maybeSingle();
      if (invoice.data) {
        assertEquals(
          (await db.from("invoice_items").delete().eq(
            "invoice_id",
            invoice.data.id,
          )).error,
          null,
        );
        assertEquals(
          (await db.from("invoices").delete().eq("id", invoice.data.id)).error,
          null,
        );
      }
    }
    assertEquals(
      (await db.from("students").delete().eq("id", fixture.studentId)).error,
      null,
    );
    if (fixture.customerId) await stripe.customers.del(fixture.customerId);
  }
  console.log(
    `Evidence: ${manifestPath}; isolated students/invoice rows cleaned up`,
  );
}
console.log(`PASS all ${results.length} sandbox payment scenarios`);
