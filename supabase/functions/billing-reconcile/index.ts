// @ts-nocheck
// deno-lint-ignore-file no-explicit-any
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import Stripe from 'npm:stripe@16.6.0';

function json(resp: any, status = 200) {
  return new Response(JSON.stringify(resp), { 
    status, 
    headers: { 'Content-Type': 'application/json' } 
  });
}

Deno.serve(async (req: Request) => {
  const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY')?.trim();
  if (!STRIPE_SECRET_KEY) return json({ error: 'Stripe key not configured' }, 500);
  
  const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' });
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

  try {
    // Find stuck payment attempts (processing/pending > 24 hours old)
    const { data: stuckAttempts, error: queryErr } = await supabase
      .from('payment_attempts')
      .select('*')
      .in('status', ['pending', 'processing'])
      .lt('created_at', new Date(Date.now() - 24 * 3600 * 1000).toISOString());
    
    if (queryErr) throw queryErr;
    
    let reconciled = 0;
    let stillStuck = 0;
    
    for (const attempt of stuckAttempts || []) {
      if (!attempt.stripe_payment_intent_id) {
        // No PI created - mark as failed
        await supabase.from('payment_attempts')
          .update({ 
            status: 'failed',
            failure_code: 'payment_intent_not_created',
            failure_message: 'Payment intent was never created (system error)' 
          })
          .eq('id', attempt.id);
        reconciled++;
        continue;
      }
      
      try {
        // Retrieve PI from Stripe
        const pi = await stripe.paymentIntents.retrieve(attempt.stripe_payment_intent_id);
        
        if (pi.status === 'succeeded') {
          // Webhook was missed - update to succeeded
          const charge = pi.latest_charge ? 
            await stripe.charges.retrieve(pi.latest_charge as string, { expand: ['balance_transaction'] }) : null;
          const bt: any = charge?.balance_transaction;
          
          await supabase.from('payment_attempts')
            .update({
              status: 'succeeded',
              stripe_charge_id: charge?.id || null,
              charged_at: new Date().toISOString(),
              fee_cents: bt?.fee || null,
              net_cents: bt?.net || null,
              receipt_url: charge?.receipt_url || null,
            })
            .eq('id', attempt.id);
          reconciled++;
        } else if (['requires_payment_method', 'canceled', 'requires_capture'].includes(pi.status)) {
          // Should be marked as failed
          const failureCode = pi.last_payment_error?.code || pi.status;
          const failureMessage = pi.last_payment_error?.message || `Payment intent status: ${pi.status}`;
          
          await supabase.from('payment_attempts')
            .update({
              status: 'failed',
              failure_code: failureCode,
              failure_message: failureMessage,
            })
            .eq('id', attempt.id);
          reconciled++;
        } else if (pi.status === 'processing') {
          // Still legitimately processing - leave it
          stillStuck++;
        }
      } catch (e: any) {
        console.error(`[reconcile] Failed to reconcile attempt ${attempt.id}:`, e?.message || e);
      }
    }
    
    return json({ 
      ok: true, 
      reconciled,
      stillStuck,
      total: stuckAttempts?.length || 0 
    });
  } catch (e: any) {
    console.error('[reconcile] error', e?.message || e);
    return json({ error: 'reconcile_error', message: e?.message || String(e) }, 500);
  }
});







