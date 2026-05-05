import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import Stripe from 'npm:stripe@16.6.0';
import type { StrategyResult } from '../shared/types.ts';
import { 
  fetchFullInvoice,
  calculateAmountPaidFromBalance,
  validateSessionsStudentsId,
  getErrorMessage 
} from '../shared/utils.ts';

/**
 * Strategy: Fix incomplete invoices in DB
 * DB-first approach - queries DB, checks what's missing, fetches from Stripe, updates
 */
export async function reconcileIncompleteInvoices(
  stripe: Stripe,
  supabase: SupabaseClient,
  daysBack: number,
  onlyMissingItems: boolean,
  onlyMissingTotals: boolean
): Promise<StrategyResult> {
  const reconciled: string[] = [];
  const errors: string[] = [];
  const skipped: string[] = [];
  const warnings: string[] = [];
  
  const startDate = new Date();
  startDate.setUTCDate(startDate.getUTCDate() - daysBack);
  const startDateStr = startDate.toISOString().split('T')[0];
  
  // Find invoices that need reconciliation
  const { data: invoices, error: invoicesError } = await supabase
    .from('invoices')
    .select('id, stripe_invoice_id, student_id, invoice_date, amount_due_cents, total_cents, subtotal_cents')
    .eq('billing_source', 'session_runner')
    .is('deleted_at', null)
    .gte('invoice_date', startDateStr)
    .order('invoice_date', { ascending: false });
  
  if (invoicesError) {
    console.error('[incomplete-invoices] Error fetching invoices:', invoicesError);
    return {
      strategy: 'incomplete-invoices',
      reconciled: [],
      errors: [`Error fetching invoices: ${getErrorMessage(invoicesError)}`],
      skipped: [],
      warnings: [],
      date_range: {
        start: startDate.toISOString(),
        end: new Date().toISOString(),
      },
    };
  }
  
  if (!invoices || invoices.length === 0) {
    return {
      strategy: 'incomplete-invoices',
      reconciled: [],
      errors: [],
      skipped: [],
      warnings: [],
      date_range: {
        start: startDate.toISOString(),
        end: new Date().toISOString(),
      },
    };
  }
  
  // Check which invoices need item reconciliation
  for (const invoice of invoices) {
    try {
      // Check if items are missing
      const { data: items, error: itemsError } = await supabase
        .from('invoice_items')
        .select('id')
        .eq('invoice_id', invoice.id)
        .is('deleted_at', null)
        .limit(1);
      
      if (itemsError) {
        console.error(`[incomplete-invoices] Error checking items for invoice ${invoice.stripe_invoice_id}:`, itemsError);
        errors.push(`Invoice ${invoice.stripe_invoice_id}: Error checking items - ${getErrorMessage(itemsError)}`);
        continue;
      }
      
      const hasItems = items && items.length > 0;
      const needsItems = onlyMissingItems && !hasItems && invoice.amount_due_cents > 0;
      const needsTotals = onlyMissingTotals && (!invoice.total_cents || !invoice.subtotal_cents);
      
      if (!needsItems && !needsTotals) {
        skipped.push(`Invoice ${invoice.stripe_invoice_id}: Already reconciled`);
        continue;
      }
      
      // Fetch full invoice from Stripe (always fetch full for reliable data)
      const stripeInvoice = await fetchFullInvoice(stripe, invoice.stripe_invoice_id);
      
      if (!stripeInvoice) {
        errors.push(`Invoice ${invoice.stripe_invoice_id}: Stripe invoice not found`);
        continue;
      }
      
      let reconciledThisInvoice = false;
      
      // Update subtotal/total if missing
      if (needsTotals) {
        const subtotalCents = stripeInvoice.subtotal ?? null;
        const totalCents = stripeInvoice.total ?? null;
        const amountDueCents = stripeInvoice.amount_due ?? 0;
        const amountPaidFromBalanceCents = calculateAmountPaidFromBalance(totalCents, amountDueCents);
        
        const { error: updateErr } = await supabase
          .from('invoices')
          .update({
            subtotal_cents: subtotalCents,
            total_cents: totalCents,
            amount_due_cents: amountDueCents,
            amount_paid_from_balance_cents: amountPaidFromBalanceCents,
          })
          .eq('id', invoice.id)
          .is('deleted_at', null);
        
        if (updateErr) {
          console.error(`[incomplete-invoices] Failed to update totals for invoice ${invoice.stripe_invoice_id}:`, updateErr);
          errors.push(`Invoice ${invoice.stripe_invoice_id}: Failed to update totals - ${getErrorMessage(updateErr)}`);
          continue;
        }
        reconciledThisInvoice = true;
      }
      
      // Backfill invoice items if missing
      if (needsItems) {
        // Use invoice lines data (already fetched above)
        const invoiceLines = stripeInvoice.lines?.data || [];
        
        if (invoiceLines.length === 0) {
          skipped.push(`Invoice ${invoice.stripe_invoice_id}: No line items in Stripe invoice`);
          continue;
        }
        
        // Map Stripe invoice line items to our format and validate foreign keys
        interface InvoiceItemInsert {
          invoice_id: string;
          sessions_students_id: string;
          stripe_invoice_item_id: string;
          amount_cents: number;
          description: string;
          is_subsidy: boolean;
          is_fee: boolean;
          session_id: string | null;
          student_id: string;
        }
        const itemInserts: InvoiceItemInsert[] = [];
        const invalidItems: string[] = [];
        
        for (const line of invoiceLines) {
          const lineItem = line as { invoice_item?: string; id?: string; metadata?: Record<string, unknown>; amount?: number; description?: string };
          const invoiceItemId = lineItem.invoice_item || lineItem.id;
          const metadata = lineItem.metadata || {};
          
          const sessionsStudentsId = metadata.sessions_students_id;
          const sessionId = metadata.session_id;
          
          // Validate sessions_students_id exists if provided
          const validation = await validateSessionsStudentsId(
            supabase,
            sessionsStudentsId,
            sessionId,
            invoice.student_id
          );
          
          if (!validation.valid) {
            invalidItems.push(`Item ${invoiceItemId}: ${validation.error}`);
            continue; // Skip this item
          }
          
          // Validate session_id exists if provided
          if (sessionId) {
            const { data: sessionCheck } = await supabase
              .from('sessions')
              .select('id')
              .eq('id', sessionId)
              .maybeSingle();
            
            if (!sessionCheck) {
              invalidItems.push(`Item ${invoiceItemId}: session_id ${sessionId} not found`);
              continue; // Skip this item
            }
          }
          
          itemInserts.push({
            invoice_id: invoice.id,
            sessions_students_id: validation.sessions_students_id,
            stripe_invoice_item_id: invoiceItemId,
            amount_cents: lineItem.amount || 0,
            description: lineItem.description || '',
            is_subsidy: metadata.is_subsidy === 'true' || metadata.is_subsidy === true,
            is_fee: metadata.is_fee === 'true' || metadata.is_fee === true,
            session_id: sessionId || null,
            student_id: invoice.student_id,
          });
        }
        
        if (invalidItems.length > 0) {
          const warningMsg = `Invoice ${invoice.stripe_invoice_id} has ${invalidItems.length} invalid items`;
          console.warn(`[incomplete-invoices] ${warningMsg}:`, invalidItems);
          warnings.push(`${warningMsg}: ${invalidItems.join('; ')}`);
        }
        
        if (itemInserts.length > 0) {
          const { error: itemsErr } = await supabase
            .from('invoice_items')
            .upsert(itemInserts, {
              onConflict: 'stripe_invoice_item_id',
              ignoreDuplicates: false,
            });
          
          if (itemsErr) {
            console.error(`[incomplete-invoices] Failed to upsert items for invoice ${invoice.stripe_invoice_id}:`, itemsErr);
            errors.push(`Invoice ${invoice.stripe_invoice_id}: Failed to upsert items - ${getErrorMessage(itemsErr)}`);
            continue;
          }
          
          reconciledThisInvoice = true;
          if (invalidItems.length > 0) {
            console.log(`[incomplete-invoices] Reconciled invoice ${invoice.stripe_invoice_id} with ${itemInserts.length} items (${invalidItems.length} skipped)`);
          } else {
            console.log(`[incomplete-invoices] Reconciled invoice ${invoice.stripe_invoice_id}`);
          }
        } else {
          skipped.push(`Invoice ${invoice.stripe_invoice_id}: No valid line items to insert (${invalidItems.length} invalid)`);
        }
      }
      
      // Only add to reconciled if we actually did something
      if (reconciledThisInvoice) {
        reconciled.push(invoice.stripe_invoice_id);
      }
    } catch (err: unknown) {
      console.error(`[incomplete-invoices] Failed to reconcile invoice ${invoice.stripe_invoice_id}:`, getErrorMessage(err));
      errors.push(`Invoice ${invoice.stripe_invoice_id}: ${getErrorMessage(err)}`);
    }
  }
  
  return {
    strategy: 'incomplete-invoices',
    reconciled,
    errors,
    skipped,
    warnings,
    date_range: {
      start: startDate.toISOString(),
      end: new Date().toISOString(),
    },
  };
}
