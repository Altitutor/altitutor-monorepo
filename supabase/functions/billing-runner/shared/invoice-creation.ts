// @ts-nocheck
// deno-lint-ignore-file no-explicit-any
import Stripe from 'npm:stripe@16.6.0';
import {
  generateInvoiceIdempotencyKey,
  generateInvoiceItemIdempotencyKey,
} from './utils.ts';

/**
 * Create Stripe invoice items and return them with stripe_invoice_item_id
 */
export async function createStripeInvoiceItems(
  stripe: Stripe,
  customerId: string,
  invoiceItems: any[],
  currency: string,
  studentId: string,
  invoiceDate: string,
  timestamp: number
): Promise<{
  stripeInvoiceItems: any[];
  createdStripeItemIds: string[];
}> {
  const stripeInvoiceItems: any[] = [];
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
      console.error(`[billing-runner] Failed to delete invoice item ${itemId} during rollback:`, delErr);
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
  timestamp: number
): Promise<Stripe.Invoice> {
  const idempotencyKey = generateInvoiceIdempotencyKey(studentId, invoiceDate, timestamp);

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
  timestamp: number
): Promise<Stripe.Invoice> {
  const idempotencyKey = generateInvoiceIdempotencyKey(studentId, invoiceDate, timestamp);

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
 * Attempt to pay an invoice
 */
export async function payInvoice(
  stripe: Stripe,
  invoiceId: string
): Promise<Stripe.Invoice> {
  return await stripe.invoices.pay(invoiceId);
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
  supabase: any,
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

  // Insert new invoice
  const { data: insertedInvoice, error: dbErr } = await supabase
    .from('invoices')
    .insert({
      student_id: studentId,
      stripe_invoice_id: finalizedInvoice.id,
      stripe_invoice_number: finalizedInvoice.number,
      invoice_date: invoiceDate,
      amount_due_cents: finalizedInvoice.amount_due,
      amount_paid_cents: finalizedInvoice.amount_paid || 0,
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
 * Save invoice items to database
 */
export async function saveInvoiceItemsToDatabase(
  supabase: any,
  invoiceId: string,
  stripeInvoiceItems: any[]
): Promise<void> {
  const itemInserts = stripeInvoiceItems.map((item) => ({
    invoice_id: invoiceId,
    sessions_students_id: item.sessions_students_id,
    stripe_invoice_item_id: item.stripe_invoice_item_id,
    amount_cents: item.amount_cents,
    description: item.description,
    is_subsidy: item.is_subsidy,
    session_id: item.session_id,
    student_id: item.student_id,
  }));

  const { error: itemsErr } = await supabase.from('invoice_items').insert(itemInserts);
  if (itemsErr) throw itemsErr;
}

/**
 * Update invoice payment status in database
 */
export async function updateInvoicePaymentStatus(
  supabase: any,
  invoiceId: string,
  paidInvoice: Stripe.Invoice
): Promise<void> {
  await supabase
    .from('invoices')
    .update({
      status: paidInvoice.status,
      amount_paid_cents: paidInvoice.amount_paid || 0,
      amount_due_cents: paidInvoice.amount_due,
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
  supabase: any,
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
