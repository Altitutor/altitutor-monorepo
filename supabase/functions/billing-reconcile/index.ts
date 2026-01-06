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
  return new Response(JSON.stringify(resp), { 
    status, 
    headers: { 
      'Content-Type': 'application/json',
      ...corsHeaders 
    } 
  });
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  
  const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY')?.trim();
  if (!STRIPE_SECRET_KEY) return json({ error: 'Stripe key not configured' }, 500);
  
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  
  // Parse request body for date range override (optional)
  let dateRangeDays = 7; // Default: last 7 days
  if (req.method === 'POST') {
    try {
      const bodyText = await req.text();
      if (bodyText) {
        const requestBody = JSON.parse(bodyText);
        if (requestBody.days && typeof requestBody.days === 'number') {
          dateRangeDays = Math.min(Math.max(1, requestBody.days), 30); // Clamp between 1 and 30 days
        }
      }
    } catch {
      // Body parsing failed, continue with defaults
    }
  }
  
  // Check authentication (service role only)
  try {
    const authHeader = req.headers.get('authorization');
    const apiKey = req.headers.get('apikey');
    const bearerToken = authHeader?.startsWith('Bearer ') 
      ? authHeader.substring(7).trim() 
      : authHeader;
    
    if (apiKey !== supabaseServiceKey && bearerToken !== supabaseServiceKey) {
      return json({ error: 'Unauthorized: Reconciliation can only be triggered by service role' }, 403);
    }
  } catch (authErr: any) {
    return json({ error: 'Authentication error', message: authErr?.message }, 401);
  }

  const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' });
  const supabase = createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } });

  try {
    // Calculate date range (last N days)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setUTCDate(startDate.getUTCDate() - dateRangeDays);
    
    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];

    console.log(`[reconcile] Starting reconciliation for invoices from ${startDateStr} to ${endDateStr}`);

    const reconciled: string[] = [];
    const errors: string[] = [];
    let hasMore = true;
    let startingAfter: string | undefined = undefined;

    // Query Stripe for invoices
    // Note: Stripe API doesn't support filtering by metadata in list(), so we filter in code
    // We'll fetch invoices from the last 30 days to ensure we catch all relevant invoices
    const queryStartDate = new Date();
    queryStartDate.setUTCDate(queryStartDate.getUTCDate() - 30); // Query last 30 days from Stripe
    
    while (hasMore) {
      const params: any = {
        limit: 100,
        created: { gte: Math.floor(queryStartDate.getTime() / 1000) }, // Unix timestamp
      };
      
      if (startingAfter) {
        params.starting_after = startingAfter;
      }

      const stripeInvoices = await stripe.invoices.list(params);
      
      if (!stripeInvoices.data || stripeInvoices.data.length === 0) {
        hasMore = false;
        break;
      }

      // Filter invoices by metadata.type = 'session_invoice' and invoice_date within date range
      const relevantInvoices = stripeInvoices.data.filter((inv) => {
        // Only process session invoices
        if (inv.metadata?.type !== 'session_invoice') return false;
        
        const invoiceDate = inv.metadata?.invoice_date;
        if (!invoiceDate) return false;
        
        // Filter by invoice_date metadata within our target date range
        return invoiceDate >= startDateStr && invoiceDate <= endDateStr;
      });

      // Process each invoice
      for (const stripeInvoice of relevantInvoices) {
        try {
          const studentId = stripeInvoice.metadata?.student_id;
          const invoiceDate = stripeInvoice.metadata?.invoice_date;

          if (!studentId || !invoiceDate) {
            console.warn(`[reconcile] Skipping invoice ${stripeInvoice.id}: missing student_id or invoice_date metadata`);
            continue;
          }

          // Check if DB record exists
          const { data: existingInvoice } = await supabase
            .from('invoices')
            .select('id')
            .eq('stripe_invoice_id', stripeInvoice.id)
            .maybeSingle();

          if (existingInvoice) {
            // Invoice already exists in DB, skip
            continue;
          }

          console.log(`[reconcile] Found orphaned invoice ${stripeInvoice.id} for student ${studentId} on ${invoiceDate}`);

          // Fetch invoice items from Stripe
          const stripeItems = await stripe.invoiceItems.list({
            invoice: stripeInvoice.id,
          });

          // Create DB record
          const { data: reconciledInvoice, error: reconcileErr } = await supabase
            .from('invoices')
            .insert({
              student_id: studentId,
              stripe_invoice_id: stripeInvoice.id,
              stripe_invoice_number: stripeInvoice.number,
              invoice_date: invoiceDate,
              amount_due_cents: stripeInvoice.amount_due,
              amount_paid_cents: stripeInvoice.amount_paid || 0,
              currency: stripeInvoice.currency,
              status: stripeInvoice.status,
              collection_method: stripeInvoice.collection_method,
              auto_advance: stripeInvoice.auto_advance,
              hosted_invoice_url: stripeInvoice.hosted_invoice_url,
              invoice_pdf: stripeInvoice.invoice_pdf,
              finalized_at: stripeInvoice.status_transitions?.finalized_at 
                ? new Date(stripeInvoice.status_transitions.finalized_at * 1000).toISOString()
                : null,
              paid_at: stripeInvoice.status_transitions?.paid_at 
                ? new Date(stripeInvoice.status_transitions.paid_at * 1000).toISOString()
                : null,
            })
            .select('id')
            .single();

          if (reconcileErr) {
            console.error(`[reconcile] Failed to create invoice record for ${stripeInvoice.id}:`, reconcileErr);
            errors.push(`Invoice ${stripeInvoice.id}: ${reconcileErr.message}`);
            continue;
          }

          // Insert invoice items
          const itemInserts = stripeItems.data.map((item) => ({
            invoice_id: reconciledInvoice.id,
            sessions_students_id: item.metadata?.sessions_students_id || '',
            stripe_invoice_item_id: item.id,
            amount_cents: item.amount,
            description: item.description || '',
            is_subsidy: item.metadata?.is_subsidy === 'true',
            session_id: item.metadata?.session_id || '',
            student_id: studentId,
          }));

          const { error: itemsErr } = await supabase
            .from('invoice_items')
            .insert(itemInserts);

          if (itemsErr) {
            console.error(`[reconcile] Failed to create invoice items for ${stripeInvoice.id}:`, itemsErr);
            errors.push(`Invoice ${stripeInvoice.id}: Failed to create items - ${itemsErr.message}`);
            // Don't remove the invoice record - it's partially reconciled
            continue;
          }

          reconciled.push(stripeInvoice.id);
          console.log(`[reconcile] Successfully reconciled invoice ${stripeInvoice.id}`);
        } catch (invoiceErr: any) {
          console.error(`[reconcile] Error processing invoice ${stripeInvoice.id}:`, invoiceErr?.message || invoiceErr);
          errors.push(`Invoice ${stripeInvoice.id}: ${invoiceErr?.message || 'Processing failed'}`);
        }
      }

      // Check if there are more pages
      hasMore = stripeInvoices.has_more;
      if (hasMore && stripeInvoices.data.length > 0) {
        startingAfter = stripeInvoices.data[stripeInvoices.data.length - 1].id;
      } else {
        hasMore = false;
      }
    }

    return json({ 
      ok: true, 
      reconciled: reconciled.length,
      errors: errors.length > 0 ? errors : undefined,
      dateRange: { start: startDateStr, end: endDateStr },
      message: `Reconciled ${reconciled.length} orphaned invoice(s)${errors.length > 0 ? ` with ${errors.length} error(s)` : ''}`
    });
  } catch (e: any) {
    console.error('[reconcile] error', e?.message || e);
    return json({ error: 'reconcile_error', message: e?.message || String(e) }, 500);
  }
});

