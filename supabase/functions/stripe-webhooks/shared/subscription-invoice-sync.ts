import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import Stripe from 'npm:stripe@16.6.0';

export type SyncSubscriptionInvoiceResult =
  | { ok: true; dbInvoiceId: string; inserted: boolean }
  | { ok: false; skipped: true; reason: string }
  | { ok: false; skipped?: false; reason: string; message?: string };

/** Session-runner invoices set Stripe invoice metadata.type = session_invoice */
export function isSessionInvoiceMetadata(
  metadata: Stripe.Metadata | null | undefined,
): boolean {
  return metadata?.type === 'session_invoice';
}

export function getStripeSubscriptionId(invoice: Stripe.Invoice): string | null {
  const sub = invoice.subscription;
  if (!sub) return null;
  return typeof sub === 'string' ? sub : sub.id;
}

function invoiceDateYmd(inv: Stripe.Invoice): string {
  const ts =
    inv.status_transitions?.finalized_at ??
    inv.status_transitions?.paid_at ??
    inv.created;
  return new Date(ts * 1000).toISOString().slice(0, 10);
}

/**
 * Stripe invoice.line lists may paginate; merge all pages into `invoice.lines.data`.
 */
export async function fillInvoiceLinesPagination(
  stripe: Stripe,
  inv: Stripe.Invoice,
): Promise<Stripe.Invoice> {
  const lines = inv.lines;
  if (!lines?.has_more) {
    return inv;
  }

  const all: Stripe.InvoiceLineItem[] = [...(lines.data ?? [])];
  let startingAfter = all[all.length - 1]?.id;
  while (startingAfter) {
    const page = await stripe.invoices.listLineItems(inv.id, {
      starting_after: startingAfter,
      limit: 100,
    });
    all.push(...page.data);
    if (!page.has_more) break;
    startingAfter = page.data[page.data.length - 1]?.id;
  }

  return {
    ...inv,
    lines: {
      ...lines,
      data: all,
      has_more: false,
    },
  };
}

export async function retrieveInvoiceWithLines(
  stripe: Stripe,
  invoiceId: string,
  extraExpand: string[] = [],
): Promise<Stripe.Invoice> {
  const expand = [...new Set(['lines.data', 'customer', 'subscription', ...extraExpand])];
  const inv = await stripe.invoices.retrieve(invoiceId, { expand });
  return fillInvoiceLinesPagination(stripe, inv);
}

/**
 * Upsert `invoices` + `invoice_items` for Stripe subscription invoices.
 * No-ops (skipped) for session-runner DB rows, session_invoice metadata, or non-subscription invoices.
 */
export async function syncSubscriptionInvoiceFromStripe(
  supabase: SupabaseClient,
  stripe: Stripe,
  invoiceOrId: Stripe.Invoice | string,
): Promise<SyncSubscriptionInvoiceResult> {
  let invoice: Stripe.Invoice;

  try {
    if (typeof invoiceOrId === 'string') {
      invoice = await retrieveInvoiceWithLines(stripe, invoiceOrId);
    } else {
      invoice = await fillInvoiceLinesPagination(stripe, invoiceOrId);
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, reason: 'stripe_error', message: msg };
  }

  if (isSessionInvoiceMetadata(invoice.metadata)) {
    return { ok: false, skipped: true, reason: 'session_metadata' };
  }

  const subscriptionId = getStripeSubscriptionId(invoice);
  if (!subscriptionId) {
    return { ok: false, skipped: true, reason: 'not_subscription' };
  }

  const { data: existing, error: exErr } = await supabase
    .from('invoices')
    .select('id, billing_source')
    .eq('stripe_invoice_id', invoice.id)
    .maybeSingle();

  if (exErr) {
    return { ok: false, reason: 'db_error', message: exErr.message };
  }

  if (existing?.billing_source === 'session_runner') {
    return { ok: false, skipped: true, reason: 'session_runner_row' };
  }

  const customerId =
    typeof invoice.customer === 'string'
      ? invoice.customer
      : invoice.customer?.id ?? null;
  if (!customerId) {
    return { ok: false, reason: 'no_customer', message: 'Missing invoice.customer' };
  }

  const { data: billing, error: billErr } = await supabase
    .from('students_billing')
    .select('student_id')
    .eq('stripe_customer_id', customerId)
    .maybeSingle();

  if (billErr) {
    return { ok: false, reason: 'db_error', message: billErr.message };
  }
  if (!billing?.student_id) {
    console.warn(
      '[webhook] subscription invoice: no students_billing for customer',
      customerId,
      invoice.id,
    );
    return { ok: false, reason: 'no_student' };
  }

  const { data: subRow, error: subErr } = await supabase
    .from('student_subscriptions')
    .select('id, student_id')
    .eq('stripe_subscription_id', subscriptionId)
    .maybeSingle();

  if (subErr) {
    return { ok: false, reason: 'db_error', message: subErr.message };
  }

  let studentId = billing.student_id;
  const studentSubscriptionId: string | null = subRow?.id ?? null;
  if (subRow && subRow.student_id !== billing.student_id) {
    console.warn(
      '[webhook] subscription invoice: student_subscriptions.student_id differs from students_billing; using subscription row',
      { invoiceId: invoice.id, subscriptionId },
    );
    studentId = subRow.student_id;
  }

  const subtotalCents = invoice.subtotal ?? null;
  const totalCents = invoice.total ?? null;
  const amountDueCents = invoice.amount_due ?? 0;
  const amountPaidFromBalanceCents =
    totalCents !== null ? Math.max(0, totalCents - amountDueCents) : null;

  const now = new Date().toISOString();
  const finalizedAt = invoice.status_transitions?.finalized_at
    ? new Date(invoice.status_transitions.finalized_at * 1000).toISOString()
    : null;
  const paidAt = invoice.status_transitions?.paid_at
    ? new Date(invoice.status_transitions.paid_at * 1000).toISOString()
    : null;

  const row = {
    student_id: studentId,
    billing_source: 'subscription' as const,
    student_subscription_id: studentSubscriptionId,
    stripe_invoice_id: invoice.id,
    stripe_invoice_number: invoice.number,
    invoice_date: invoiceDateYmd(invoice),
    subtotal_cents: subtotalCents,
    total_cents: totalCents,
    amount_due_cents: amountDueCents,
    amount_paid_cents: invoice.amount_paid ?? 0,
    amount_paid_from_balance_cents: amountPaidFromBalanceCents,
    currency: invoice.currency,
    status: invoice.status ?? 'draft',
    collection_method: invoice.collection_method,
    auto_advance: invoice.auto_advance,
    hosted_invoice_url: invoice.hosted_invoice_url,
    invoice_pdf: invoice.invoice_pdf,
    finalized_at: finalizedAt,
    paid_at: paidAt,
    updated_at: now,
  };

  let dbInvoiceId: string;
  let inserted: boolean;

  if (existing) {
    const { error: updErr } = await supabase.from('invoices').update(row).eq('id', existing.id);
    if (updErr) {
      return { ok: false, reason: 'db_error', message: updErr.message };
    }
    dbInvoiceId = existing.id;
    inserted = false;
  } else {
    const { data: ins, error: insErr } = await supabase
      .from('invoices')
      .insert(row)
      .select('id')
      .single();

    if (insErr) {
      if (insErr.code === '23505') {
        const { data: race } = await supabase
          .from('invoices')
          .select('id, billing_source')
          .eq('stripe_invoice_id', invoice.id)
          .maybeSingle();

        if (race?.billing_source === 'session_runner') {
          return { ok: false, skipped: true, reason: 'session_runner_row' };
        }
        if (!race?.id) {
          return { ok: false, reason: 'db_error', message: insErr.message };
        }

        const { error: raceUpdErr } = await supabase.from('invoices').update(row).eq('id', race.id);
        if (raceUpdErr) {
          return { ok: false, reason: 'db_error', message: raceUpdErr.message };
        }
        dbInvoiceId = race.id;
        inserted = false;
      } else {
        return { ok: false, reason: 'db_error', message: insErr.message };
      }
    } else {
      dbInvoiceId = ins!.id;
      inserted = true;
    }
  }

  const lineData = invoice.lines?.data ?? [];
  const itemRows = lineData.map((line) => {
    const desc = line.description?.trim() || 'Subscription line';

    const isFee = line.type === 'application_fee';

    return {
      invoice_id: dbInvoiceId,
      sessions_students_id: null as string | null,
      session_id: null as string | null,
      stripe_invoice_item_id: line.id,
      amount_cents: line.amount,
      description: desc,
      is_subsidy: false,
      is_fee: isFee,
      student_id: studentId,
    };
  });

  if (itemRows.length > 0) {
    const { error: upErr } = await supabase.from('invoice_items').upsert(itemRows, {
      onConflict: 'stripe_invoice_item_id',
    });
    if (upErr) {
      console.error('[webhook] subscription invoice_items upsert:', upErr);
      return { ok: false, reason: 'db_error', message: upErr.message };
    }
  }

  const desiredIds = new Set(lineData.map((l) => l.id));
  const { data: dbItems, error: listErr } = await supabase
    .from('invoice_items')
    .select('id, stripe_invoice_item_id')
    .eq('invoice_id', dbInvoiceId);

  if (!listErr && dbItems) {
    for (const it of dbItems) {
      if (!desiredIds.has(it.stripe_invoice_item_id)) {
        const { error: delErr } = await supabase.from('invoice_items').delete().eq('id', it.id);
        if (delErr) {
          console.error('[webhook] subscription invoice_items delete orphan:', delErr);
        }
      }
    }
  }

  return { ok: true, dbInvoiceId, inserted };
}
