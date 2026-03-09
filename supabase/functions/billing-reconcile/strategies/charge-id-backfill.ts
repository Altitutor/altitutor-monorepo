import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import Stripe from 'npm:stripe@16.6.0';
import type { StrategyResult, InvoiceReconciliationResult } from '../shared/types.ts';
import { getErrorMessage } from '../shared/utils.ts';

/**
 * Strategy: Backfill stripe_charge_id (and stripe_payment_intent_id) for paid invoices that are missing them.
 * Queries DB for paid invoices with null stripe_charge_id, fetches each from Stripe (Invoice.charge and
 * Invoice.payment_intent are returned by the API for paid invoices), then updates the DB.
 *
 * Stripe docs: Invoice object includes `charge` (string) and `payment_intent` (string) for paid invoices.
 * No expand needed. We throttle requests (delay every N invoices) to stay under rate limits.
 */
const DELAY_EVERY_N_INVOICES = 20;
const DELAY_MS = 200;

export async function reconcileChargeIdBackfill(
  stripe: Stripe,
  supabase: SupabaseClient,
  daysBack: number,
  fixBackfill: boolean = false
): Promise<StrategyResult> {
  const reconciled: string[] = [];
  const errors: string[] = [];
  const skipped: string[] = [];
  const warnings: string[] = [];
  const mismatches: InvoiceReconciliationResult[] = [];

  const endDate = new Date();
  const startDate = new Date();
  startDate.setUTCDate(startDate.getUTCDate() - daysBack);
  const startDateStr = startDate.toISOString().split('T')[0];

  const { data: invoices, error: invoicesError } = await supabase
    .from('invoices')
    .select('id, stripe_invoice_id, stripe_charge_id, stripe_payment_intent_id')
    .eq('status', 'paid')
    .is('stripe_charge_id', null)
    .not('stripe_invoice_id', 'is', null)
    .gte('invoice_date', startDateStr)
    .order('invoice_date', { ascending: false });

  if (invoicesError) {
    console.error('[charge-id-backfill] Error fetching invoices:', invoicesError);
    return {
      strategy: 'charge-id-backfill',
      reconciled: [],
      errors: [`Error fetching invoices: ${getErrorMessage(invoicesError)}`],
      skipped: [],
      warnings: [],
      mismatches: [],
      date_range: { start: startDate.toISOString(), end: endDate.toISOString() },
    };
  }

  if (!invoices || invoices.length === 0) {
    return {
      strategy: 'charge-id-backfill',
      reconciled: [],
      errors: [],
      skipped: [],
      warnings: [],
      mismatches: [],
      date_range: { start: startDate.toISOString(), end: endDate.toISOString() },
    };
  }

  console.log(`[charge-id-backfill] Found ${invoices.length} paid invoice(s) missing stripe_charge_id`);

  for (let i = 0; i < invoices.length; i++) {
    const invoice = invoices[i];

    if (i > 0 && i % DELAY_EVERY_N_INVOICES === 0) {
      await new Promise((r) => setTimeout(r, DELAY_MS));
    }

    try {
      const stripeInvoice = await stripe.invoices.retrieve(invoice.stripe_invoice_id);
      const raw = stripeInvoice as { charge?: string | null; payment_intent?: string | null };
      const chargeId = typeof raw.charge === 'string' ? raw.charge : null;
      const paymentIntentId = typeof raw.payment_intent === 'string' ? raw.payment_intent : null;

      if (!chargeId && !paymentIntentId) {
        skipped.push(`${invoice.stripe_invoice_id}: No charge or payment_intent on Stripe (e.g. customer balance only)`);
        continue;
      }

      const changes: { field: string; old_value: unknown; new_value: unknown }[] = [];
      if (chargeId) changes.push({ field: 'stripe_charge_id', old_value: invoice.stripe_charge_id, new_value: chargeId });
      if (paymentIntentId) changes.push({ field: 'stripe_payment_intent_id', old_value: invoice.stripe_payment_intent_id, new_value: paymentIntentId });

      mismatches.push({
        invoice_id: invoice.id,
        stripe_invoice_id: invoice.stripe_invoice_id,
        reconciled: false,
        changes,
      });

      if (fixBackfill) {
        const { error: updateErr } = await supabase
          .from('invoices')
          .update({
            ...(chargeId != null && { stripe_charge_id: chargeId }),
            ...(paymentIntentId != null && { stripe_payment_intent_id: paymentIntentId }),
          })
          .eq('id', invoice.id);

        if (updateErr) {
          errors.push(`Invoice ${invoice.stripe_invoice_id}: ${getErrorMessage(updateErr)}`);
          const last = mismatches[mismatches.length - 1];
          if (last) last.errors = [getErrorMessage(updateErr)];
        } else {
          reconciled.push(invoice.stripe_invoice_id);
          const last = mismatches[mismatches.length - 1];
          if (last) last.reconciled = true;
          console.log(`[charge-id-backfill] Backfilled charge_id for ${invoice.stripe_invoice_id}`);
        }
      } else {
        warnings.push(
          `Invoice ${invoice.stripe_invoice_id}: Missing charge_id (charge: ${chargeId ?? 'null'}, pi: ${paymentIntentId ?? 'null'}) - not fixing`
        );
      }
    } catch (err: unknown) {
      const msg = getErrorMessage(err);
      console.error(`[charge-id-backfill] ${invoice.stripe_invoice_id}:`, msg);
      errors.push(`Invoice ${invoice.stripe_invoice_id}: ${msg}`);
    }
  }

  return {
    strategy: 'charge-id-backfill',
    reconciled,
    errors,
    skipped,
    warnings,
    mismatches,
    date_range: { start: startDate.toISOString(), end: endDate.toISOString() },
  };
}
