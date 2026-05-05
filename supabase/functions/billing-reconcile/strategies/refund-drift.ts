import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import Stripe from 'npm:stripe@16.6.0';
import type { StrategyResult, InvoiceReconciliationResult } from '../shared/types.ts';
import { getErrorMessage } from '../shared/utils.ts';

/**
 * Strategy: Detect and fix refund drift
 * Finds invoices where charges have been refunded but DB doesn't reflect this
 * Uses Stripe Events API to efficiently query charge.refunded events
 * 
 * Based on Stripe best practices:
 * - Query events by type and date range (more efficient than checking each charge)
 * - Handle pagination properly
 * - Match refund events to invoices by charge_id
 */
export async function reconcileRefundDrift(
  stripe: Stripe,
  supabase: SupabaseClient,
  daysBack: number,
  fixDrift: boolean = false
): Promise<StrategyResult> {
  const reconciled: string[] = [];
  const errors: string[] = [];
  const skipped: string[] = [];
  const warnings: string[] = [];
  const mismatches: InvoiceReconciliationResult[] = [];
  
  const endDate = new Date();
  const startDate = new Date();
  startDate.setUTCDate(startDate.getUTCDate() - daysBack);
  
  // Convert to Unix timestamps for Stripe Events API
  const startTimestamp = Math.floor(startDate.getTime() / 1000);
  const endTimestamp = Math.floor(endDate.getTime() / 1000);
  
  console.log(`[refund-drift] Querying charge.refunded events from ${startDate.toISOString()} to ${endDate.toISOString()}`);
  
  try {
    // Query Stripe Events API for charge.refunded events
    // This is much more efficient than checking each invoice's charge individually
    const refundEvents: Stripe.Event[] = [];
    let hasMore = true;
    let startingAfter: string | undefined = undefined;
    
    // Paginate through all refund events in the date range
    while (hasMore) {
      const eventsListParams: Stripe.EventListParams = {
        type: 'charge.refunded',
        created: {
          gte: startTimestamp,
          lte: endTimestamp,
        },
        limit: 100, // Stripe's max per page
      };
      
      if (startingAfter) {
        eventsListParams.starting_after = startingAfter;
      }
      
      const eventsResponse = await stripe.events.list(eventsListParams);
      refundEvents.push(...eventsResponse.data);
      
      // Check if there are more pages
      hasMore = eventsResponse.has_more;
      if (hasMore && eventsResponse.data.length > 0) {
        startingAfter = eventsResponse.data[eventsResponse.data.length - 1].id;
      }
    }
    
    console.log(`[refund-drift] Found ${refundEvents.length} charge.refunded events`);
    
    if (refundEvents.length === 0) {
      return {
        strategy: 'refund-drift',
        reconciled: [],
        errors: [],
        skipped: [],
        warnings: [],
        mismatches: [],
        date_range: {
          start: startDate.toISOString(),
          end: endDate.toISOString(),
        },
      };
    }
    
    // Extract charge IDs from refund events
    const refundedChargeIds = new Set<string>();
    const chargeIdToRefundTimestamp = new Map<string, number>();
    
    for (const event of refundEvents) {
      const charge = event.data.object as Stripe.Charge;
      if (charge.id) {
        refundedChargeIds.add(charge.id);
        // Use event created timestamp as refund timestamp (when refund was processed)
        // If charge has amount_refunded, we could also check charge.created + refund.created
        // but event.created is when the refund was completed, which is more accurate
        chargeIdToRefundTimestamp.set(charge.id, event.created);
      }
    }
    
    console.log(`[refund-drift] Found ${refundedChargeIds.size} unique refunded charges`);
    
    if (refundedChargeIds.size === 0) {
      return {
        strategy: 'refund-drift',
        reconciled: [],
        errors: [],
        skipped: [],
        warnings: [],
        mismatches: [],
        date_range: {
          start: startDate.toISOString(),
          end: endDate.toISOString(),
        },
      };
    }
    
    // Find invoices in DB that have these charge IDs but aren't marked as refunded
    const chargeIdsArray = Array.from(refundedChargeIds);
    
    // Query in batches to avoid SQL IN clause limits (PostgreSQL supports up to ~1000 items)
    const batchSize = 500;
    for (let i = 0; i < chargeIdsArray.length; i += batchSize) {
      const batch = chargeIdsArray.slice(i, i + batchSize);
      
      const { data: invoices, error: invoicesError } = await supabase
        .from('invoices')
        .select('id, stripe_invoice_id, stripe_charge_id, is_refunded, refunded_at')
        .in('stripe_charge_id', batch)
        .eq('status', 'paid')
        .is('deleted_at', null)
        .or('is_refunded.is.null,is_refunded.eq.false');
      
      if (invoicesError) {
        console.error(`[refund-drift] Error fetching invoices for batch ${i / batchSize + 1}:`, invoicesError);
        errors.push(`Error fetching invoices batch ${i / batchSize + 1}: ${getErrorMessage(invoicesError)}`);
        continue;
      }
      
      if (!invoices || invoices.length === 0) {
        continue;
      }
      
      console.log(`[refund-drift] Found ${invoices.length} invoices with refunded charges that need updating`);
      
      // Process each invoice
      for (const invoice of invoices) {
        if (!invoice.stripe_charge_id) {
          skipped.push(`Invoice ${invoice.stripe_invoice_id}: No charge ID`);
          continue;
        }
        
        // Double-check that this charge is actually refunded
        if (!refundedChargeIds.has(invoice.stripe_charge_id)) {
          skipped.push(`Invoice ${invoice.stripe_invoice_id}: Charge ${invoice.stripe_charge_id} not in refunded list`);
          continue;
        }
        
        const refundTimestamp = chargeIdToRefundTimestamp.get(invoice.stripe_charge_id);
        const refundedAt = refundTimestamp 
          ? new Date(refundTimestamp * 1000).toISOString()
          : new Date().toISOString(); // Fallback to now if timestamp missing
        
        // Record mismatch
        const mismatch: InvoiceReconciliationResult = {
          invoice_id: invoice.id,
          stripe_invoice_id: invoice.stripe_invoice_id,
          reconciled: false,
          changes: [{
            field: 'is_refunded',
            old_value: invoice.is_refunded || false,
            new_value: true,
          }, {
            field: 'refunded_at',
            old_value: invoice.refunded_at || null,
            new_value: refundedAt,
          }],
        };
        
        // Fix refund drift if requested
        if (fixDrift) {
          const { error: updateErr } = await supabase
            .from('invoices')
            .update({
              is_refunded: true,
              refunded_at: refundedAt,
            })
            .eq('id', invoice.id)
            .is('deleted_at', null);
          
          if (updateErr) {
            console.error(`[refund-drift] Failed to update refund status for invoice ${invoice.stripe_invoice_id}:`, updateErr);
            errors.push(`Invoice ${invoice.stripe_invoice_id}: Failed to update refund status - ${getErrorMessage(updateErr)}`);
            mismatch.errors = [`Failed to update refund status: ${getErrorMessage(updateErr)}`];
          } else {
            reconciled.push(invoice.stripe_invoice_id);
            mismatch.reconciled = true;
            console.log(`[refund-drift] Fixed refund drift for invoice ${invoice.stripe_invoice_id}: charge ${invoice.stripe_charge_id} was refunded`);
          }
        } else {
          warnings.push(
            `Invoice ${invoice.stripe_invoice_id}: Refund drift detected (charge ${invoice.stripe_charge_id} refunded but DB not updated) - not fixing`
          );
        }
        
        mismatches.push(mismatch);
      }
    }
    
    return {
      strategy: 'refund-drift',
      reconciled,
      errors,
      skipped,
      warnings,
      mismatches,
      date_range: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
      },
    };
  } catch (err: unknown) {
    console.error('[refund-drift] Top-level error:', err);
    const errorMessage = getErrorMessage(err);
    return {
      strategy: 'refund-drift',
      reconciled: [],
      errors: [`Top-level error: ${errorMessage}`],
      skipped: [],
      warnings: [],
      mismatches: [],
      date_range: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
      },
    };
  }
}
