// @ts-nocheck
// deno-lint-ignore-file no-explicit-any
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import Stripe from 'npm:stripe@16.6.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(resp: any, status = 200) {
  try {
    const body = JSON.stringify(resp);
    return new Response(body, { 
      status, 
      headers: { 
        'Content-Type': 'application/json',
        ...corsHeaders 
      } 
    });
  } catch (e: any) {
    console.error('[reconcile-items] Failed to serialize response:', e?.message || e);
    return new Response(JSON.stringify({ 
      error: 'serialization_error', 
      message: 'Failed to serialize response',
      original_status: status 
    }), { 
      status: 500, 
      headers: { 
        'Content-Type': 'application/json',
        ...corsHeaders 
      } 
    });
  }
}

/**
 * Reconciliation function to backfill missing invoice items from Stripe
 * Finds invoices that have amount_due_cents > 0 but no line items, or
 * invoices with missing subtotal/total, and syncs them from Stripe
 */
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  
  const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY')?.trim();
  if (!STRIPE_SECRET_KEY) return json({ error: 'Stripe key not configured' }, 500);
  
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  
  // Verify service role auth
  const authHeader = req.headers.get('authorization');
  const apiKey = req.headers.get('apikey');
  const bearerToken = authHeader?.startsWith('Bearer ') 
    ? authHeader.substring(7).trim() 
    : authHeader;
  
  if (apiKey !== supabaseServiceKey && bearerToken !== supabaseServiceKey) {
    return json({ error: 'Unauthorized' }, 401);
  }
  
  const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' });
  const supabase = createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } });
  
  try {
    // Parse request body for filters
    let body: any = {};
    try {
      const bodyText = await req.text();
      if (bodyText) {
        body = JSON.parse(bodyText);
      }
    } catch (parseErr) {
      // Body parsing failed, use defaults
      console.warn('[reconcile-items] Failed to parse request body, using defaults');
    }
    
    const daysBack = body.days_back || 30;
    const onlyMissingItems = body.only_missing_items !== false; // Default true
    const onlyMissingTotals = body.only_missing_totals !== false; // Default true
    
    const startDate = new Date();
    startDate.setUTCDate(startDate.getUTCDate() - daysBack);
    
    const reconciled: string[] = [];
    const errors: string[] = [];
    const skipped: string[] = [];
    
    // Find invoices that need reconciliation
    const startDateStr = startDate.toISOString().split('T')[0];
    
    const { data: invoices, error: invoicesError } = await supabase
      .from('invoices')
      .select('id, stripe_invoice_id, student_id, invoice_date, amount_due_cents, total_cents, subtotal_cents')
      .gte('invoice_date', startDateStr)
      .order('invoice_date', { ascending: false });
    
    if (invoicesError) {
      console.error('[reconcile-items] Error fetching invoices:', invoicesError);
      const errorMsg = invoicesError?.message || (typeof invoicesError === 'string' ? invoicesError : 'Unknown query error');
      const errorCode = invoicesError?.code || 'unknown';
      return json({ 
        error: 'query_error', 
        message: errorMsg,
        code: errorCode
      }, 500);
    }
    
    if (!invoices || invoices.length === 0) {
      return json({
        ok: true,
        reconciled: 0,
        errors: 0,
        skipped: 0,
        message: 'No invoices found to reconcile',
      });
    }
    
    // Check which invoices need item reconciliation
    for (const invoice of invoices) {
      try {
        // Check if items are missing
        const { data: items, error: itemsError } = await supabase
          .from('invoice_items')
          .select('id')
          .eq('invoice_id', invoice.id)
          .limit(1);
        
        if (itemsError) {
          console.error(`[reconcile-items] Error checking items for invoice ${invoice.stripe_invoice_id}:`, itemsError);
          errors.push(`Invoice ${invoice.stripe_invoice_id}: Error checking items`);
          continue;
        }
        
        const hasItems = items && items.length > 0;
        const needsItems = onlyMissingItems && !hasItems && invoice.amount_due_cents > 0;
        const needsTotals = onlyMissingTotals && (!invoice.total_cents || !invoice.subtotal_cents);
        
        if (!needsItems && !needsTotals) {
          skipped.push(`Invoice ${invoice.stripe_invoice_id}: Already reconciled`);
          continue;
        }
        
        // Fetch invoice from Stripe
        let stripeInvoice;
        try {
          stripeInvoice = await stripe.invoices.retrieve(invoice.stripe_invoice_id, {
            expand: ['lines.data.price.product'],
          });
        } catch (stripeErr: any) {
          console.error(`[reconcile-items] Failed to retrieve Stripe invoice ${invoice.stripe_invoice_id}:`, stripeErr?.message || stripeErr);
          errors.push(`Invoice ${invoice.stripe_invoice_id}: Failed to retrieve from Stripe - ${stripeErr?.message || 'Unknown error'}`);
          continue;
        }
        
        if (!stripeInvoice) {
          errors.push(`Invoice ${invoice.stripe_invoice_id}: Stripe invoice not found`);
          continue;
        }
        
        // Update subtotal/total if missing
        if (needsTotals) {
          const subtotalCents = stripeInvoice.subtotal ?? null;
          const totalCents = stripeInvoice.total ?? null;
          const amountDueCents = stripeInvoice.amount_due ?? 0;
          const amountPaidFromBalanceCents = totalCents !== null ? Math.max(0, totalCents - amountDueCents) : null;
          
          const { error: updateErr } = await supabase
            .from('invoices')
            .update({
              subtotal_cents: subtotalCents,
              total_cents: totalCents,
              amount_due_cents: amountDueCents,
              amount_paid_from_balance_cents: amountPaidFromBalanceCents,
            })
            .eq('id', invoice.id);
          
          if (updateErr) {
            console.error(`[reconcile-items] Failed to update totals for invoice ${invoice.stripe_invoice_id}:`, updateErr);
            errors.push(`Invoice ${invoice.stripe_invoice_id}: Failed to update totals`);
            continue;
          }
        }
        
        // Backfill invoice items if missing
        if (needsItems) {
          // Use invoice lines data (already fetched above)
          const invoiceLines = stripeInvoice.lines?.data || [];
          
          if (invoiceLines.length === 0) {
            skipped.push(`Invoice ${invoice.stripe_invoice_id}: No line items in Stripe invoice`);
            continue;
          }
          
          // Map Stripe invoice line items to our format
          const itemInserts = invoiceLines
            .map((line) => {
              // Handle both InvoiceLineItem and InvoiceItem types
              const lineItem = line as any;
              const invoiceItemId = lineItem.invoice_item || lineItem.id;
              const metadata = lineItem.metadata || {};
              
              return {
                invoice_id: invoice.id,
                sessions_students_id: metadata.sessions_students_id || '',
                stripe_invoice_item_id: invoiceItemId,
                amount_cents: lineItem.amount || 0,
                description: lineItem.description || '',
                is_subsidy: metadata.is_subsidy === 'true' || metadata.is_subsidy === true,
                session_id: metadata.session_id || '',
                student_id: invoice.student_id,
              };
            })
            .filter(item => item.stripe_invoice_item_id); // Only include items with valid IDs
          
          if (itemInserts.length > 0) {
            const { error: itemsErr } = await supabase
              .from('invoice_items')
              .upsert(itemInserts, {
                onConflict: 'stripe_invoice_item_id',
                ignoreDuplicates: false,
              });
            
            if (itemsErr) {
              console.error(`[reconcile-items] Failed to upsert items for invoice ${invoice.stripe_invoice_id}:`, itemsErr);
              errors.push(`Invoice ${invoice.stripe_invoice_id}: Failed to upsert items - ${itemsErr.message || 'Unknown error'}`);
              continue;
            }
          } else {
            skipped.push(`Invoice ${invoice.stripe_invoice_id}: No valid line items to insert`);
          }
        }
        
        reconciled.push(invoice.stripe_invoice_id);
        console.log(`[reconcile-items] Reconciled invoice ${invoice.stripe_invoice_id}`);
      } catch (err: any) {
        console.error(`[reconcile-items] Failed to reconcile invoice ${invoice.stripe_invoice_id}:`, err?.message || err);
        errors.push(`Invoice ${invoice.stripe_invoice_id}: ${err?.message || 'Reconciliation failed'}`);
      }
    }
    
    return json({
      ok: true,
      reconciled: reconciled.length,
      errors: errors.length,
      skipped: skipped.length,
      reconciled_ids: reconciled,
      errors_list: errors.length > 0 ? errors : undefined,
      skipped_list: skipped.length > 0 ? skipped : undefined,
      date_range: {
        start: startDate.toISOString(),
        end: new Date().toISOString(),
      },
    });
  } catch (e: any) {
    console.error('[reconcile-items] Top-level error:', e);
    const errorMessage = e?.message || (typeof e === 'string' ? e : String(e) || 'Unknown error');
    const errorType = e?.name || (e?.constructor?.name) || 'Error';
    const errorStack = e?.stack ? String(e.stack).substring(0, 500) : undefined;
    
    return json({ 
      error: 'reconcile_error', 
      message: errorMessage,
      type: errorType,
      stack: errorStack
    }, 500);
  }
});
