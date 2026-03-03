import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import Stripe from 'npm:stripe@16.6.0';
import type { StrategyResult, InvoiceReconciliationResult } from '../shared/types.ts';
import { 
  fetchFullInvoice,
  calculateAmountPaidFromBalance,
  getErrorMessage 
} from '../shared/utils.ts';

/**
 * Strategy: Detect and fix invoice amount mismatches
 * Finds invoices where DB amounts don't match Stripe amounts
 */
export async function reconcileAmountsMismatch(
  stripe: Stripe,
  supabase: SupabaseClient,
  daysBack: number,
  fixMismatch: boolean = false
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
    .select('id, stripe_invoice_id, student_id, invoice_date, subtotal_cents, total_cents, amount_due_cents, amount_paid_cents, amount_paid_from_balance_cents')
    .gte('invoice_date', startDateStr)
    .order('invoice_date', { ascending: false });
  
  if (invoicesError) {
    console.error('[amounts-mismatch] Error fetching invoices:', invoicesError);
    return {
      strategy: 'amounts-mismatch',
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
      strategy: 'amounts-mismatch',
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
      
      // Compare amounts (use null coalescing for proper null handling)
      const stripeSubtotal = stripeInvoice.subtotal ?? null;
      const stripeTotal = stripeInvoice.total ?? null;
      const stripeAmountDue = stripeInvoice.amount_due ?? 0;
      const stripeAmountPaid = stripeInvoice.amount_paid ?? 0;
      const stripeAmountPaidFromBalance = calculateAmountPaidFromBalance(stripeTotal, stripeAmountDue);
      
      const dbSubtotal = invoice.subtotal_cents;
      const dbTotal = invoice.total_cents;
      const dbAmountDue = invoice.amount_due_cents;
      const dbAmountPaid = invoice.amount_paid_cents;
      const dbAmountPaidFromBalance = invoice.amount_paid_from_balance_cents;
      
      // Check for mismatches
      const changes: { field: string; old_value: unknown; new_value: unknown }[] = [];
      
      if (dbSubtotal !== stripeSubtotal) {
        changes.push({ field: 'subtotal_cents', old_value: dbSubtotal, new_value: stripeSubtotal });
      }
      if (dbTotal !== stripeTotal) {
        changes.push({ field: 'total_cents', old_value: dbTotal, new_value: stripeTotal });
      }
      if (dbAmountDue !== stripeAmountDue) {
        changes.push({ field: 'amount_due_cents', old_value: dbAmountDue, new_value: stripeAmountDue });
      }
      if (dbAmountPaid !== stripeAmountPaid) {
        changes.push({ field: 'amount_paid_cents', old_value: dbAmountPaid, new_value: stripeAmountPaid });
      }
      if (dbAmountPaidFromBalance !== stripeAmountPaidFromBalance) {
        changes.push({ 
          field: 'amount_paid_from_balance_cents', 
          old_value: dbAmountPaidFromBalance, 
          new_value: stripeAmountPaidFromBalance 
        });
      }
      
      // If no mismatches, skip
      if (changes.length === 0) {
        continue;
      }
      
      // Record mismatch
      const mismatch: InvoiceReconciliationResult = {
        invoice_id: invoice.id,
        stripe_invoice_id: invoice.stripe_invoice_id,
        reconciled: false,
        changes,
      };
      
      // Fix amounts mismatch if requested
      if (fixMismatch) {
        const updateData: Record<string, unknown> = {};
        changes.forEach(change => {
          updateData[change.field] = change.new_value;
        });
        
        const { error: updateErr } = await supabase
          .from('invoices')
          .update(updateData)
          .eq('id', invoice.id);
        
        if (updateErr) {
          console.error(`[amounts-mismatch] Failed to update amounts for invoice ${invoice.stripe_invoice_id}:`, updateErr);
          errors.push(`Invoice ${invoice.stripe_invoice_id}: Failed to update amounts - ${getErrorMessage(updateErr)}`);
          mismatch.errors = [`Failed to update amounts: ${getErrorMessage(updateErr)}`];
        } else {
          reconciled.push(invoice.stripe_invoice_id);
          mismatch.reconciled = true;
          console.log(`[amounts-mismatch] Fixed amounts mismatch for invoice ${invoice.stripe_invoice_id}`);
        }
      } else {
        warnings.push(
          `Invoice ${invoice.stripe_invoice_id}: Amount mismatch detected - not fixing`
        );
      }
      
      mismatches.push(mismatch);
    } catch (err: unknown) {
      console.error(`[amounts-mismatch] Failed to check amounts for invoice ${invoice.stripe_invoice_id}:`, getErrorMessage(err));
      errors.push(`Invoice ${invoice.stripe_invoice_id}: ${getErrorMessage(err)}`);
    }
  }
  
  return {
    strategy: 'amounts-mismatch',
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
