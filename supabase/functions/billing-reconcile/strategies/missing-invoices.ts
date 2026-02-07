// @ts-nocheck
// deno-lint-ignore-file no-explicit-any
import Stripe from 'npm:stripe@16.6.0';
import type { StrategyResult } from '../shared/types.ts';
import { 
  calculateAmountPaidFromBalance,
  validateSessionsStudentsId,
  getErrorMessage 
} from '../shared/utils.ts';

/**
 * Strategy: Find invoices in Stripe that are missing from DB
 * Stripe-first approach - queries Stripe, checks DB, inserts if missing
 */
export async function reconcileMissingInvoices(
  stripe: Stripe,
  supabase: any,
  daysBack: number
): Promise<StrategyResult> {
  const reconciled: string[] = [];
  const errors: string[] = [];
  const skipped: string[] = [];
  const warnings: string[] = [];
  
  const startDate = new Date();
  startDate.setUTCDate(startDate.getUTCDate() - daysBack);
  const cutoffTimestamp = Math.floor(startDate.getTime() / 1000);
  
  let hasMore = true;
  let startingAfter: string | undefined = undefined;
  
  while (hasMore) {
    const invoices = await stripe.invoices.list({
      limit: 100,
      starting_after: startingAfter,
      created: { gte: cutoffTimestamp },
    });
    
    for (const invoice of invoices.data) {
      // Only process invoices with our metadata
      if (invoice.metadata?.type !== 'session_invoice' || !invoice.metadata?.student_id || !invoice.metadata?.invoice_date) {
        continue;
      }
      
      const studentId = invoice.metadata.student_id;
      const invoiceDate = invoice.metadata.invoice_date;
      
      // Check if DB record exists
      const { data: existingInvoice } = await supabase
        .from('invoices')
        .select('id')
        .eq('stripe_invoice_id', invoice.id)
        .maybeSingle();
      
      if (existingInvoice) {
        // Already reconciled
        continue;
      }
      
      // Skip draft invoices (not finalized yet)
      if (invoice.status === 'draft') {
        skipped.push(`Invoice ${invoice.id}: Draft status, skipping`);
        continue;
      }
      
      try {
        // Fetch invoice items
        const invoiceItems = await stripe.invoiceItems.list({
          invoice: invoice.id,
          limit: 100,
        });
        
        // Calculate amount paid from customer balance
        // Use null coalescing to properly handle null values (important for customer balance payments)
        const subtotalCents = invoice.subtotal ?? null;
        const totalCents = invoice.total ?? null;
        const amountDueCents = invoice.amount_due ?? 0;
        const amountPaidFromBalanceCents = calculateAmountPaidFromBalance(totalCents, amountDueCents);

        // Create DB record
        const { data: dbInvoice, error: insertErr } = await supabase
          .from('invoices')
          .insert({
            student_id: studentId,
            stripe_invoice_id: invoice.id,
            stripe_invoice_number: invoice.number,
            invoice_date: invoiceDate,
            subtotal_cents: subtotalCents,
            total_cents: totalCents,
            amount_due_cents: amountDueCents,
            amount_paid_cents: invoice.amount_paid ?? 0,
            amount_paid_from_balance_cents: amountPaidFromBalanceCents,
            currency: invoice.currency,
            status: invoice.status,
            collection_method: invoice.collection_method,
            auto_advance: invoice.auto_advance,
            hosted_invoice_url: invoice.hosted_invoice_url,
            invoice_pdf: invoice.invoice_pdf,
            finalized_at: invoice.status_transitions?.finalized_at 
              ? new Date(invoice.status_transitions.finalized_at * 1000).toISOString()
              : null,
            paid_at: invoice.status_transitions?.paid_at 
              ? new Date(invoice.status_transitions.paid_at * 1000).toISOString()
              : null,
            metadata: {
              reconciled: true,
              reconciled_at: new Date().toISOString(),
              reconciled_by: 'missing-invoices-strategy',
            },
          })
          .select('id')
          .single();
        
        if (insertErr) {
          // Check if it's a duplicate key error (race condition)
          if (insertErr.code === '23505') {
            // Another process created it, skip
            skipped.push(`Invoice ${invoice.id}: Duplicate key (already created)`);
            continue;
          }
          throw insertErr;
        }
        
        // Insert invoice items using upsert to handle duplicates
        // Validate sessions_students_id before inserting
        const itemInserts: any[] = [];
        const invalidItems: string[] = [];
        
        for (const item of invoiceItems.data.filter(item => item.invoice === invoice.id)) {
          const metadata = item.metadata || {};
          const sessionsStudentsId = metadata.sessions_students_id;
          const sessionId = metadata.session_id;
          
          // Validate sessions_students_id exists if provided
          const validation = await validateSessionsStudentsId(
            supabase,
            sessionsStudentsId,
            sessionId,
            studentId
          );
          
          if (!validation.valid) {
            invalidItems.push(`Item ${item.id}: ${validation.error}`);
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
              invalidItems.push(`Item ${item.id}: session_id ${sessionId} not found`);
              continue; // Skip this item
            }
          }
          
          itemInserts.push({
            invoice_id: dbInvoice.id,
            sessions_students_id: validation.sessions_students_id || '',
            stripe_invoice_item_id: item.id,
            amount_cents: item.amount,
            description: item.description || '',
            is_subsidy: metadata.is_subsidy === 'true',
            is_fee: metadata.is_fee === 'true',
            session_id: sessionId || null,
            student_id: studentId,
          });
        }
        
        if (invalidItems.length > 0) {
          const warningMsg = `Invoice ${invoice.id} has ${invalidItems.length} invalid items`;
          console.warn(`[missing-invoices] ${warningMsg}:`, invalidItems);
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
            console.error(`[missing-invoices] Failed to upsert items for invoice ${invoice.id}:`, itemsErr);
            errors.push(`Invoice ${invoice.id}: Failed to upsert items`);
          }
        }
        
        reconciled.push(invoice.id);
        console.log(`[missing-invoices] Reconciled invoice ${invoice.id} for student ${studentId}`);
      } catch (err: any) {
        console.error(`[missing-invoices] Failed to reconcile invoice ${invoice.id}:`, getErrorMessage(err));
        errors.push(`Invoice ${invoice.id}: ${getErrorMessage(err)}`);
      }
    }
    
    hasMore = invoices.has_more;
    if (hasMore && invoices.data.length > 0) {
      startingAfter = invoices.data[invoices.data.length - 1].id;
    } else {
      hasMore = false;
    }
  }
  
  return {
    strategy: 'missing-invoices',
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
