// @ts-nocheck
// deno-lint-ignore-file no-explicit-any
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import Stripe from 'npm:stripe@16.6.0';

function json(resp: any, status = 200) {
  return new Response(JSON.stringify(resp), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY')?.trim();
  const STRIPE_WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET')?.trim();
  if (!STRIPE_SECRET_KEY || !STRIPE_WEBHOOK_SECRET) return json({ error: 'Stripe env not configured' }, 500);
  const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' });

  const sig = req.headers.get('stripe-signature') || '';
  const rawBody = await req.text();
  let event: any;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, STRIPE_WEBHOOK_SECRET);
  } catch (err: any) {
    console.error('[webhook] signature verify failed', err?.message || err);
    return json({ error: 'invalid signature' }, 400);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

  try {
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const pi = event.data.object as any;
        const metadata = pi.metadata || {};
        const latestChargeId = pi.latest_charge as string | undefined;
        let fee_cents: number | null = null;
        let net_cents: number | null = null;
        let receipt_url: string | null = null;
        if (latestChargeId) {
          const charge = await stripe.charges.retrieve(latestChargeId, { expand: ['balance_transaction'] });
          const bt: any = charge.balance_transaction;
          if (bt) {
            fee_cents = typeof bt.fee === 'number' ? bt.fee : null;
            net_cents = typeof bt.net === 'number' ? bt.net : null;
          }
          receipt_url = charge.receipt_url || null;
        }

        // Verification microcharge: refund and mark verified
        if (metadata?.type === 'verification') {
          try {
            await stripe.refunds.create({ payment_intent: pi.id, reason: 'requested_by_customer' });
          } catch (e) {
            console.warn('[webhook] refund verification failed (non-fatal)', e?.message || e);
          }

          // Save default payment method and card meta
          const paymentMethodId = pi.payment_method as string | undefined;
          if (paymentMethodId) {
            try {
              const pm = await stripe.paymentMethods.retrieve(paymentMethodId);
              const card = (pm as any)?.card || {};
              const updates: any = {
                default_payment_method_id: paymentMethodId,
                card_brand: card.brand || null,
                card_last4: card.last4 || null,
                card_country: card.country || null,
                verified_at: new Date().toISOString(),
              };
              const { error: upErr } = await supabase
                .from('students_billing')
                .update(updates)
                .eq('stripe_customer_id', pi.customer);
              if (upErr) console.error('[webhook] students_billing update error', upErr);
            } catch (e) {
              console.error('[webhook] fetch PM failed', e?.message || e);
            }
          }
          return json({ received: true });
        }

        // Session charge success
        if (metadata?.sessions_students_id) {
          const updates: any = {
            status: 'succeeded',
            stripe_payment_intent_id: pi.id,
            stripe_charge_id: latestChargeId || null,
            charged_at: new Date().toISOString(),
            fee_cents,
            net_cents,
            receipt_url,
          };
          const { error: payErr } = await supabase
            .from('payments')
            .update(updates)
            .eq('sessions_students_id', metadata.sessions_students_id);
          if (payErr) console.error('[webhook] payments update error', payErr);
        }
        return json({ received: true });
      }

      case 'payment_intent.payment_failed': {
        const pi = event.data.object as any;
        const metadata = pi.metadata || {};
        const failure_message = pi.last_payment_error?.message || 'payment_failed';
        if (metadata?.sessions_students_id) {
          const { error: updErr } = await supabase
            .from('payments')
            .update({ status: 'failed', failure_message })
            .eq('sessions_students_id', metadata.sessions_students_id);
          if (updErr) console.error('[webhook] payments fail update error', updErr);
        }
        return json({ received: true });
      }

      default:
        return json({ received: true });
    }
  } catch (e: any) {
    console.error('[webhook] handler error', e?.message || e);
    return json({ error: 'handler_error' }, 500);
  }
});


