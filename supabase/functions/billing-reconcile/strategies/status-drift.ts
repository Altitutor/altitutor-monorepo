// @ts-nocheck
// deno-lint-ignore-file no-explicit-any
import Stripe from 'npm:stripe@16.6.0';
import type { StrategyResult, InvoiceReconciliationResult } from '../shared/types.ts';
import { 
  fetchFullInvoice,
  isValidStatusTransition,
  getErrorMessage 
} from '../shared/utils.ts';

/**
 * Strategy: Detect and fix invoice status drift
 * Finds invoices where DB status doesn't match Stripe status
 * Based on Stripe docs: paid is terminal but can be changed back to open
 */
export async function reconcileStatusDrift(
  stripe: Stripe,
  supabase: any,
  daysBack: number,
  fixDrift: boolean = false
): Promise<StrategyResult> {
  const reconciled: string[] = [];
  const errors: string[] = [];
  const skipped: string[] = [];
  const warnings: string[] = [];
  const mismatches: InvoiceReconciliationResult[] = [];
  
  const startDate = new Date();
  startDate.setUTCDate(startDate.getUTCDate() - daysBack);
  const startDateStr = startDate.toISOString().split('T')[0];
  
  // Find invoices in DB
  const { data: invoices, error: invoicesError } = await supabase
    .from('invoices')
    .select('id, stripe_invoice_id, student_id, invoice_date, status')
    .gte('invoice_date', startDateStr)
    .order('invoice_date', { ascending: false });
  
  if (invoicesError) {
    console.error('[status-drift] Error fetching invoices:', invoicesError);
    return {
      strategy: 'status-drift',
      reconciled: [],
      errors: [`Error fetching invoices: ${getErrorMessage(invoicesError)}`],
      skipped: [],
      warnings: [],
      mismatches: [],
      date_range: {
        start: startDate.toISOString(),
        end: new Date().toISOString(),
      },
    };
  }
  
  if (!invoices || invoices.length === 0) {
    return {
      strategy: 'status-drift',
      reconciled: [],
      errors: [],
      skipped: [],
      warnings: [],
      mismatches: [],
      date_range: {
        start: startDate.toISOString(),
        end: new Date().toISOString(),
      },
    };
  }
  
  for (const invoice of invoices) {
    try {
      // Fetch full invoice from Stripe
      const stripeInvoice = await fetchFullInvoice(stripe, invoice.stripe_invoice_id);
      
      if (!stripeInvoice) {
        errors.push(`Invoice ${invoice.stripe_invoice_id}: Stripe invoice not found`);
        continue;
      }
      
      const dbStatus = invoice.status;
      const stripeStatus = stripeInvoice.status;
      
      // Check if status matches
      if (dbStatus === stripeStatus) {
        continue; // Status matches, skip
      }
      
      // Check if status transition is valid
      if (!isValidStatusTransition(dbStatus, stripeStatus)) {
        warnings.push(
          `Invoice ${invoice.stripe_invoice_id}: Invalid status transition from ${dbStatus} to ${stripeStatus}`
        );
        continue;
      }
      
      // Record mismatch
      const mismatch: InvoiceReconciliationResult = {
        invoice_id: invoice.id,
        stripe_invoice_id: invoice.stripe_invoice_id,
        reconciled: false,
        changes: [{
          field: 'status',
          old_value: dbStatus,
          new_value: stripeStatus,
        }],
      };
      
      // Fix status drift if requested
      if (fixDrift) {
        const { error: updateErr } = await supabase
          .from('invoices')
          .update({
            status: stripeStatus,
            // Update paid_at if transitioning to paid
            paid_at: stripeStatus === 'paid' && dbStatus !== 'paid'
              ? (stripeInvoice.status_transitions?.paid_at 
                  ? new Date(stripeInvoice.status_transitions.paid_at * 1000).toISOString()
                  : new Date().toISOString())
              : undefined,
          })
          .eq('id', invoice.id);
        
        if (updateErr) {
          console.error(`[status-drift] Failed to update status for invoice ${invoice.stripe_invoice_id}:`, updateErr);
          errors.push(`Invoice ${invoice.stripe_invoice_id}: Failed to update status - ${getErrorMessage(updateErr)}`);
          mismatch.errors = [`Failed to update status: ${getErrorMessage(updateErr)}`];
        } else {
          reconciled.push(invoice.stripe_invoice_id);
          mismatch.reconciled = true;
          console.log(`[status-drift] Fixed status drift for invoice ${invoice.stripe_invoice_id}: ${dbStatus} -> ${stripeStatus}`);
        }
      } else {
        warnings.push(
          `Invoice ${invoice.stripe_invoice_id}: Status drift detected (DB: ${dbStatus}, Stripe: ${stripeStatus}) - not fixing`
        );
      }
      
      mismatches.push(mismatch);
    } catch (err: any) {
      console.error(`[status-drift] Failed to check status for invoice ${invoice.stripe_invoice_id}:`, getErrorMessage(err));
      errors.push(`Invoice ${invoice.stripe_invoice_id}: ${getErrorMessage(err)}`);
    }
  }
  
  return {
    strategy: 'status-drift',
    reconciled,
    errors,
    skipped,
    warnings,
    mismatches,
    date_range: {
      start: startDate.toISOString(),
      end: new Date().toISOString(),
    },
  };
}
