import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import Stripe from 'npm:stripe@16.6.0';
import {
  generateInvoiceIdempotencyKey,
  generateInvoiceItemIdempotencyKey,
} from './utils.ts';
import { formatStripeErrorMessage, getStripeErrorDetails } from './stripe-errors.ts';

const LOG_PREFIX = '[billing-runner]';

/**
 * Create Stripe invoice items and return them with stripe_invoice_item_id
 */
interface InvoiceItemInput {
  sessions_students_id?: string;
  session_id?: string;
  student_id: string;
  amount_cents: number;
  description: string;
  is_subsidy?: boolean;
  is_fee?: boolean;
}

interface StripeInvoiceItemWithId extends InvoiceItemInput {
  stripe_invoice_item_id: string;
}

export async function hasAnyInvoiceItemForSessions(
  supabase: SupabaseClient,
  sessionsStudentsIds: string[]
): Promise<boolean> {
  if (sessionsStudentsIds.length === 0) return false;
  const { data, error } = await supabase
    .from('invoice_items')
    .select('id')
    .in('sessions_students_id', sessionsStudentsIds)
    .limit(1);
  if (error) throw error;
  return (data?.length ?? 0) > 0;
}

export async function createStripeInvoiceItems(
  stripe: Stripe,
  customerId: string,
  invoiceItems: InvoiceItemInput[],
  currency: string,
  studentId: string,
  invoiceDate: string,
  timestamp: number,
  invoiceId: string,
  /** Match invoice draft nonce when rebilling after void/archive. */
  lineItemIdempotencyNonce?: string
): Promise<{
  stripeInvoiceItems: StripeInvoiceItemWithId[];
  createdStripeItemIds: string[];
}> {
  const stripeInvoiceItems: StripeInvoiceItemWithId[] = [];
  const createdStripeItemIds: string[] = [];

  for (const item of invoiceItems) {
    const itemIdempotencyKey = generateInvoiceItemIdempotencyKey(
      item,
      studentId,
      invoiceDate,
      timestamp,
      lineItemIdempotencyNonce
    );

    const stripeItem = await stripe.invoiceItems.create(
      {
        customer: customerId,
        invoice: invoiceId,
        amount: item.amount_cents,
        currency: currency,
        description: item.description,
        metadata: {
          type: 'session_charge',
          student_id: studentId,
          session_id: item.session_id || '',
          sessions_students_id: item.sessions_students_id || '',
          is_subsidy: item.is_subsidy ? 'true' : 'false',
          is_fee: item.is_fee ? 'true' : 'false',
        },
      },
      { idempotencyKey: itemIdempotencyKey }
    );

    stripeInvoiceItems.push({
      ...item,
      stripe_invoice_item_id: stripeItem.id,
    });
    createdStripeItemIds.push(stripeItem.id);
  }

  return { stripeInvoiceItems, createdStripeItemIds };
}

/**
 * Rollback: Delete created Stripe invoice items
 */
export async function rollbackStripeInvoiceItems(
  stripe: Stripe,
  createdStripeItemIds: string[]
): Promise<void> {
  for (const itemId of createdStripeItemIds) {
    try {
      await stripe.invoiceItems.del(itemId);
    } catch (delErr) {
      console.error(
        `${LOG_PREFIX} Failed to delete invoice item ${itemId} during rollback:`,
        formatStripeErrorMessage(delErr, 'delete invoice item', { invoiceItemId: itemId })
      );
    }
  }
}

/**
 * Create draft invoice with send_invoice collection method.
 * Caller must add items (with invoice: draft.id) then call finalizeInvoice.
 */
export async function createDraftSendInvoiceInvoice(
  stripe: Stripe,
  customerId: string,
  invoiceDate: string,
  studentId: string,
  isStripeTestKey: boolean,
  isStripeLiveKey: boolean,
  timestamp: number,
  sessionsStudentsIds?: string[],
  stripeInvoiceCreateNonce?: string
): Promise<Stripe.Invoice> {
  const idempotencyKey = generateInvoiceIdempotencyKey(studentId, invoiceDate, {
    sessionsStudentsIds,
    timestamp,
    stripeInvoiceCreateNonce,
  });

  return await stripe.invoices.create(
    {
      customer: customerId,
      collection_method: 'send_invoice',
      days_until_due: 30, // Set 30 days payment window for manual invoices
      auto_advance: false,
      pending_invoice_items_behavior: 'exclude',
      description: `Invoice for sessions on ${invoiceDate}`,
      metadata: {
        type: 'session_invoice',
        student_id: studentId,
        invoice_date: invoiceDate,
        stripe_key_type: isStripeTestKey ? 'test' : isStripeLiveKey ? 'live' : 'unknown',
      },
    },
    { idempotencyKey }
  );
}

/**
 * Create draft invoice with automatic collection.
 * Caller must add items (with invoice: draft.id) then call finalizeInvoice with
 * autoAdvance enabled so Stripe can collect after finalization.
 */
export async function createDraftChargeAutomaticallyInvoice(
  stripe: Stripe,
  customerId: string,
  defaultPaymentMethodId: string,
  invoiceDate: string,
  studentId: string,
  isStripeTestKey: boolean,
  isStripeLiveKey: boolean,
  timestamp: number,
  sessionsStudentsIds?: string[],
  stripeInvoiceCreateNonce?: string
): Promise<Stripe.Invoice> {
  const idempotencyKey = generateInvoiceIdempotencyKey(studentId, invoiceDate, {
    sessionsStudentsIds,
    timestamp,
    stripeInvoiceCreateNonce,
  });

  // Keep the draft paused until line items are attached. Automatic collection is
  // enabled when the invoice is finalized in the auto-bill path.
  return await stripe.invoices.create(
    {
      customer: customerId,
      collection_method: 'charge_automatically',
      auto_advance: false,
      pending_invoice_items_behavior: 'exclude',
      default_payment_method: defaultPaymentMethodId,
      description: `Invoice for sessions on ${invoiceDate}`,
      metadata: {
        type: 'session_invoice',
        student_id: studentId,
        invoice_date: invoiceDate,
        stripe_key_type: isStripeTestKey ? 'test' : isStripeLiveKey ? 'live' : 'unknown',
      },
    },
    { idempotencyKey }
  );
}

/**
 * Finalize a draft invoice after items have been attached.
 * Idempotent: if the invoice is already finalized (e.g. retry after partial
 * success — Stripe invoice open but invoice_items not yet in DB, or idempotent
 * create replay with stale draft), returns the current invoice from Stripe.
 */
export async function finalizeInvoice(
  stripe: Stripe,
  invoiceId: string,
  options: { autoAdvance?: boolean } = {}
): Promise<Stripe.Invoice> {
  try {
    const finalizeParams =
      options.autoAdvance === undefined
        ? undefined
        : { auto_advance: options.autoAdvance };

    return await stripe.invoices.finalizeInvoice(invoiceId, finalizeParams);
  } catch (err: unknown) {
    const details = getStripeErrorDetails(err);
    const msg = (details.message || '').toLowerCase();
    if (
      details.isStripeError &&
      details.statusCode === 400 &&
      (msg.includes('already finalized') || msg.includes('re-finalize') || msg.includes('non-draft'))
    ) {
      return await stripe.invoices.retrieve(invoiceId);
    }
    throw err;
  }
}

/**
 * Delete a draft invoice (and its line items). Only draft invoices can be deleted.
 * Use for rollback when item creation or finalize fails.
 */
export async function deleteDraftInvoice(stripe: Stripe, invoiceId: string): Promise<void> {
  await stripe.invoices.del(invoiceId);
}

/**
 * Void an invoice
 */
export async function voidInvoice(stripe: Stripe, invoiceId: string): Promise<Stripe.Invoice> {
  return await stripe.invoices.voidInvoice(invoiceId);
}

/**
 * Create Stripe customer for student
 */
export async function createStripeCustomer(
  stripe: Stripe,
  studentId: string,
  email: string | undefined,
  name: string | undefined
): Promise<Stripe.Customer> {
  return await stripe.customers.create({
    email: email || undefined,
    name: name || undefined,
    metadata: {
      student_id: studentId,
      type: 'student',
    },
  });
}

/**
 * Save invoice to database
 */
export async function saveInvoiceToDatabase(
  supabase: SupabaseClient,
  studentId: string,
  finalizedInvoice: Stripe.Invoice,
  invoiceDate: string
): Promise<{ id: string; status: string }> {
  // Check if DB record already exists (idempotency/race condition protection)
  const { data: existingInvoice } = await supabase
    .from('invoices')
    .select('id, status')
    .eq('stripe_invoice_id', finalizedInvoice.id)
    .is('deleted_at', null)
    .maybeSingle();

  if (existingInvoice) {
    return existingInvoice;
  }

  // Calculate amount paid from customer balance
  // If total > amount_due, the difference was paid from customer balance
  // Note: subtotal/total may be null if invoice was paid immediately from balance
  // In that case, webhook will update these values when invoice.paid event fires
  const subtotalCents = finalizedInvoice.subtotal ?? null;
  const totalCents = finalizedInvoice.total ?? null;
  const amountDueCents = finalizedInvoice.amount_due ?? 0;
  const amountPaidFromBalanceCents = totalCents !== null ? Math.max(0, totalCents - amountDueCents) : null;

  // Insert new invoice
  const { data: insertedInvoice, error: dbErr } = await supabase
    .from('invoices')
    .insert({
      student_id: studentId,
      billing_source: 'session_runner',
      stripe_invoice_id: finalizedInvoice.id,
      stripe_invoice_number: finalizedInvoice.number,
      invoice_date: invoiceDate,
      subtotal_cents: subtotalCents,
      total_cents: totalCents,
      amount_due_cents: amountDueCents,
      amount_paid_cents: finalizedInvoice.amount_paid || 0,
      amount_paid_from_balance_cents: amountPaidFromBalanceCents,
      currency: finalizedInvoice.currency,
      status: finalizedInvoice.status,
      collection_method: finalizedInvoice.collection_method,
      auto_advance: finalizedInvoice.auto_advance,
      hosted_invoice_url: finalizedInvoice.hosted_invoice_url,
      invoice_pdf: finalizedInvoice.invoice_pdf,
      finalized_at: finalizedInvoice.status_transitions?.finalized_at
        ? new Date(finalizedInvoice.status_transitions.finalized_at * 1000).toISOString()
        : null,
    })
    .select('id, status')
    .single();

  if (dbErr) {
    // Duplicate key: usually another worker inserted the same stripe_invoice_id first.
    // Never return null here — that triggered void in Stripe without surfacing the DB error.
    if (dbErr.code === '23505') {
      const { data: raceInvoice } = await supabase
        .from('invoices')
        .select('id, status')
        .eq('stripe_invoice_id', finalizedInvoice.id)
        .is('deleted_at', null)
        .maybeSingle();

      if (raceInvoice) {
        return raceInvoice;
      }

      throw new Error(
        `Invoice insert duplicate key but no row found for stripe_invoice_id=${finalizedInvoice.id} ` +
          `(student_id=${studentId}, invoice_date=${invoiceDate}). Postgres: ${dbErr.message}`
      );
    }
    throw dbErr;
  }

  if (!insertedInvoice) {
    throw new Error(
      `Invoice insert returned no row for stripe_invoice_id=${finalizedInvoice.id} (student_id=${studentId})`
    );
  }

  return insertedInvoice;
}

/**
 * Save invoice items to database using upsert to handle race conditions
 * Uses stripe_invoice_item_id as unique key to prevent duplicates
 */
export async function saveInvoiceItemsToDatabase(
  supabase: SupabaseClient,
  invoiceId: string,
  stripeInvoiceItems: StripeInvoiceItemWithId[]
): Promise<void> {
  if (!stripeInvoiceItems || stripeInvoiceItems.length === 0) {
    return; // Nothing to save
  }

  const itemInserts = stripeInvoiceItems.map((item) => ({
    invoice_id: invoiceId,
    sessions_students_id: item.sessions_students_id,
    stripe_invoice_item_id: item.stripe_invoice_item_id,
    amount_cents: item.amount_cents,
    description: item.description,
    is_subsidy: item.is_subsidy || false,
    is_fee: item.is_fee || false,
    session_id: item.session_id,
    student_id: item.student_id,
  }));

  // Use upsert with conflict resolution on stripe_invoice_item_id
  // This ensures items are saved even if invoice already exists (race condition)
  // and prevents duplicates if called multiple times
  const { error: itemsErr } = await supabase
    .from('invoice_items')
    .upsert(itemInserts, {
      onConflict: 'stripe_invoice_item_id',
      ignoreDuplicates: false, // Update if exists (shouldn't happen, but safe)
    });

  if (itemsErr) {
    console.error(
      `${LOG_PREFIX} Failed to save invoice items:`,
      formatStripeErrorMessage(itemsErr, 'save invoice items to database', { invoiceId })
    );
    throw itemsErr;
  }
}

/**
 * Soft-delete invoice rows so partial unique indexes release slots (re-billing / reconciliation).
 */
export async function softDeleteInvoiceAndItems(
  supabase: SupabaseClient,
  invoiceDbId: string
): Promise<void> {
  const now = new Date().toISOString();
  const { error: itemsErr } = await supabase
    .from('invoice_items')
    .update({ deleted_at: now })
    .eq('invoice_id', invoiceDbId)
    .is('deleted_at', null);
  if (itemsErr) throw itemsErr;

  const { error: invErr } = await supabase
    .from('invoices')
    .update({ deleted_at: now })
    .eq('id', invoiceDbId)
    .is('deleted_at', null);
  if (invErr) throw invErr;
}

/**
 * After Stripe finalize + DB invoice insert, if persisting invoice_items fails:
 * align Stripe (void/open cleanup) and soft-delete the DB invoice row.
 */
export async function rollbackFailedSessionInvoicePersist(
  stripe: Stripe,
  supabase: SupabaseClient,
  stripeInvoiceId: string,
  dbInvoiceId: string,
  context: { studentId: string }
): Promise<void> {
  try {
    const inv = await stripe.invoices.retrieve(stripeInvoiceId);
    if (inv.status === 'draft') {
      await deleteDraftInvoice(stripe, stripeInvoiceId);
    } else if (inv.status === 'open' || inv.status === 'uncollectible') {
      try {
        await voidInvoice(stripe, stripeInvoiceId);
      } catch (voidErr: unknown) {
        console.error(
          `${LOG_PREFIX} rollbackFailedSessionInvoicePersist: voidInvoice failed`,
          formatStripeErrorMessage(voidErr, 'void invoice rollback', {
            studentId: context.studentId,
            invoiceId: stripeInvoiceId,
          })
        );
      }
    } else if (inv.status === 'paid') {
      console.error(
        `${LOG_PREFIX} CRITICAL: Invoice ${stripeInvoiceId} is paid; cannot void after failed item persist. ` +
          `Manual reconciliation required. student=${context.studentId} dbInvoice=${dbInvoiceId}`
      );
    }
  } catch (retrieveErr: unknown) {
    console.error(
      `${LOG_PREFIX} rollbackFailedSessionInvoicePersist: retrieve failed`,
      formatStripeErrorMessage(retrieveErr, 'retrieve invoice for rollback', {
        studentId: context.studentId,
        invoiceId: stripeInvoiceId,
      })
    );
  }

  await softDeleteInvoiceAndItems(supabase, dbInvoiceId);
}

/**
 * Update invoice payment status in database
 * Extracts charge ID and payment intent ID from paid invoice for refund tracking
 * Following Stripe best practices: store charge ID for refund/dispute tracking
 */
export async function updateInvoicePaymentStatus(
  supabase: SupabaseClient,
  invoiceId: string,
  paidInvoice: Stripe.Invoice
): Promise<void> {
  // Extract charge ID from latest_charge (can be string ID or expanded object)
  // This is critical for refund tracking - charge.refunded webhooks need this to find invoices
  let chargeId: string | null = null;
  if (paidInvoice.latest_charge) {
    const lc = paidInvoice.latest_charge;
    chargeId = typeof lc === 'string' ? lc : (lc && typeof lc === 'object' && 'id' in lc ? (lc as { id: string }).id : null);
  }
  
  // Extract payment intent ID from payment_intent (can be string ID or expanded object)
  let payment_intent_id: string | null = null;
  if (paidInvoice.payment_intent) {
    const pi = paidInvoice.payment_intent;
    payment_intent_id = typeof pi === 'string' ? pi : (pi && typeof pi === 'object' && 'id' in pi ? (pi as { id: string }).id : null);
  }
  
  // Use null coalescing to properly handle null values (important for customer balance payments)
  const subtotalCents = paidInvoice.subtotal ?? null;
  const totalCents = paidInvoice.total ?? null;
  const amountDueCents = paidInvoice.amount_due ?? 0;
  const amountPaidFromBalanceCents = totalCents !== null ? Math.max(0, totalCents - amountDueCents) : null;

  await supabase
    .from('invoices')
    .update({
      status: paidInvoice.status,
      stripe_charge_id: chargeId, // CRITICAL: For refund tracking and dispute handling
      stripe_payment_intent_id: payment_intent_id,
      subtotal_cents: subtotalCents,
      total_cents: totalCents,
      amount_paid_cents: paidInvoice.amount_paid ?? 0,
      amount_due_cents: amountDueCents,
      amount_paid_from_balance_cents: amountPaidFromBalanceCents,
      paid_at:
        paidInvoice.status === 'paid'
          ? new Date(paidInvoice.status_transitions?.paid_at * 1000).toISOString()
          : null,
    })
    .eq('id', invoiceId);
}

/**
 * Update invoice with payment error in database
 */
export async function updateInvoicePaymentError(
  supabase: SupabaseClient,
  invoiceId: string,
  errorMessage: string
): Promise<void> {
  await supabase
    .from('invoices')
    .update({
      status: 'open',
      metadata: {
        payment_error: errorMessage,
        payment_attempted_at: new Date().toISOString(),
      },
    })
    .eq('id', invoiceId);
}
