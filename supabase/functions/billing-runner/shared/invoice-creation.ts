import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import Stripe from 'npm:stripe@16.6.0';
import {
  generateInvoiceIdempotencyKey,
  generateInvoiceItemIdempotencyKey,
} from './utils.ts';
import { formatStripeErrorMessage } from './stripe-errors.ts';

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

export async function createStripeInvoiceItems(
  stripe: Stripe,
  customerId: string,
  invoiceItems: InvoiceItemInput[],
  currency: string,
  studentId: string,
  invoiceDate: string,
  timestamp: number
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
      timestamp
    );

    const stripeItem = await stripe.invoiceItems.create(
      {
        customer: customerId,
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
 * Create invoice with send_invoice collection method
 */
export async function createSendInvoiceInvoice(
  stripe: Stripe,
  customerId: string,
  invoiceDate: string,
  studentId: string,
  isStripeTestKey: boolean,
  isStripeLiveKey: boolean,
  timestamp: number,
  sessionsStudentsIds?: string[]
): Promise<Stripe.Invoice> {
  const idempotencyKey = generateInvoiceIdempotencyKey(studentId, invoiceDate, {
    sessionsStudentsIds,
    timestamp,
  });

  const invoice = await stripe.invoices.create(
    {
      customer: customerId,
      collection_method: 'send_invoice',
      days_until_due: 30, // Set 30 days payment window for manual invoices
      auto_advance: false,
      pending_invoice_items_behavior: 'include',
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

  // Finalize invoice (sends email)
  return await stripe.invoices.finalizeInvoice(invoice.id);
}

/**
 * Create invoice with automatic collection
 */
export async function createChargeAutomaticallyInvoice(
  stripe: Stripe,
  customerId: string,
  defaultPaymentMethodId: string,
  invoiceDate: string,
  studentId: string,
  isStripeTestKey: boolean,
  isStripeLiveKey: boolean,
  timestamp: number,
  sessionsStudentsIds?: string[]
): Promise<Stripe.Invoice> {
  const idempotencyKey = generateInvoiceIdempotencyKey(studentId, invoiceDate, {
    sessionsStudentsIds,
    timestamp,
  });

  const invoice = await stripe.invoices.create(
    {
      customer: customerId,
      collection_method: 'charge_automatically',
      auto_advance: true,
      pending_invoice_items_behavior: 'include',
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

  // Finalize invoice (triggers automatic charge)
  return await stripe.invoices.finalizeInvoice(invoice.id);
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
): Promise<{ id: string; status: string } | null> {
  // Check if DB record already exists (idempotency/race condition protection)
  const { data: existingInvoice } = await supabase
    .from('invoices')
    .select('id, status')
    .eq('stripe_invoice_id', finalizedInvoice.id)
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
    // Check for duplicate key error (race condition)
    if (dbErr.code === '23505') {
      // Another process created it, fetch and return
      const { data: raceInvoice } = await supabase
        .from('invoices')
        .select('id, status')
        .eq('stripe_invoice_id', finalizedInvoice.id)
        .single();
      return raceInvoice || null;
    }
    throw dbErr;
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
    // If we hit a unique violation (e.g. from the sessions_students_id partial
    // unique index), treat it as "session already billed" and log a warning
    // instead of failing the entire billing flow. Stripe idempotency will have
    // ensured we are not creating a truly new charge in this case.
    if (itemsErr.code === '23505') {
      console.warn(
        `${LOG_PREFIX} Unique constraint violation while saving invoice items (likely already billed session).`,
        formatStripeErrorMessage(itemsErr, 'save invoice items unique violation', { invoiceId })
      );
      return;
    }

    console.error(
      `${LOG_PREFIX} Failed to save invoice items:`,
      formatStripeErrorMessage(itemsErr, 'save invoice items to database', { invoiceId })
    );
    throw itemsErr;
  }
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
