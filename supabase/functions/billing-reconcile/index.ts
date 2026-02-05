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
    // Parse date range from request (default: last 7 days)
    const body = await req.json().catch(() => ({}));
    const daysBack = body.days_back || 7;
    const startDate = new Date();
    startDate.setUTCDate(startDate.getUTCDate() - daysBack);
    
    const reconciled: string[] = [];
    const errors: string[] = [];
    const skipped: string[] = [];
    
    // Query Stripe for invoices with session_invoice metadata from last N days
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
          const subtotalCents = invoice.subtotal || 0;
          const totalCents = invoice.total || 0;
          const amountDueCents = invoice.amount_due || 0;
          const amountPaidFromBalanceCents = Math.max(0, totalCents - amountDueCents);

          // Create DB record
          const { data: dbInvoice, error: insertErr } = await supabase
            .from('invoices')
            .insert({
              student_id: studentId,
              stripe_invoice_id: invoice.id,
              stripe_invoice_number: invoice.number,
              invoice_date: invoiceDate,
              subtotal_cents: subtotalCents || null,
              total_cents: totalCents || null,
              amount_due_cents: amountDueCents,
              amount_paid_cents: invoice.amount_paid || 0,
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
          const itemInserts = invoiceItems.data
            .filter(item => item.invoice === invoice.id)
            .map((item) => ({
              invoice_id: dbInvoice.id,
              sessions_students_id: item.metadata?.sessions_students_id || '',
              stripe_invoice_item_id: item.id,
              amount_cents: item.amount,
              description: item.description || '',
              is_subsidy: item.metadata?.is_subsidy === 'true',
              session_id: item.metadata?.session_id || '',
              student_id: studentId,
            }));
          
          if (itemInserts.length > 0) {
            const { error: itemsErr } = await supabase
              .from('invoice_items')
              .upsert(itemInserts, {
                onConflict: 'stripe_invoice_item_id',
                ignoreDuplicates: false,
              });
            
            if (itemsErr) {
              console.error(`[reconcile] Failed to upsert items for invoice ${invoice.id}:`, itemsErr);
              errors.push(`Invoice ${invoice.id}: Failed to upsert items`);
            }
          }
          
          reconciled.push(invoice.id);
          console.log(`[reconcile] Reconciled invoice ${invoice.id} for student ${studentId}`);
        } catch (err: any) {
          console.error(`[reconcile] Failed to reconcile invoice ${invoice.id}:`, err?.message || err);
          errors.push(`Invoice ${invoice.id}: ${err?.message || 'Reconciliation failed'}`);
        }
      }
      
      hasMore = invoices.has_more;
      if (hasMore && invoices.data.length > 0) {
        startingAfter = invoices.data[invoices.data.length - 1].id;
      } else {
        hasMore = false;
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
    console.error('[reconcile] error', e?.message || e);
    return json({ error: 'reconcile_error', message: e?.message || String(e) }, 500);
  }
});

