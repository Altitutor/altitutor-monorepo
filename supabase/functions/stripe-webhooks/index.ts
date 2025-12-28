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
  // Health check endpoint
  if (req.method === 'GET' || (req.method === 'POST' && req.url.includes('health'))) {
    return json({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      function: 'stripe-webhooks',
    });
  }

  const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY')?.trim();
  const STRIPE_WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET')?.trim();
  if (!STRIPE_SECRET_KEY || !STRIPE_WEBHOOK_SECRET) {
    console.error('[webhook] Missing Stripe environment variables', {
      hasSecretKey: !!STRIPE_SECRET_KEY,
      hasWebhookSecret: !!STRIPE_WEBHOOK_SECRET,
    });
    return json({ error: 'Stripe env not configured' }, 500);
  }
  
  // Validate webhook secret format - must start with whsec_
  if (!STRIPE_WEBHOOK_SECRET.startsWith('whsec_')) {
    console.error('[webhook] Invalid webhook secret format - must start with whsec_', {
      secretPrefix: STRIPE_WEBHOOK_SECRET.substring(0, 10),
      secretLength: STRIPE_WEBHOOK_SECRET.length,
    });
    return json({ 
      error: 'Invalid webhook secret format', 
      details: 'Webhook secret must start with whsec_. Please check your Supabase secrets match the Stripe Dashboard signing secret exactly.' 
    }, 500);
  }
  
  const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' });

  const sig = req.headers.get('stripe-signature') || '';
  if (!sig) {
    console.error('[webhook] Missing stripe-signature header');
    return json({ error: 'Missing stripe-signature header' }, 400);
  }

  // Read raw body as text - Stripe's constructEvent accepts string
  // Important: Don't parse as JSON before signature verification
  const rawBody = await req.text();
  
  let event: any;
  try {
    // Use constructEventAsync for Deno/Supabase Edge Functions
    // constructEvent() uses synchronous crypto which isn't allowed in Deno
    event = await stripe.webhooks.constructEventAsync(rawBody, sig, STRIPE_WEBHOOK_SECRET);
  } catch (err: any) {
    console.error('[webhook] Signature verification failed:', err?.message || err);
    return json({ error: 'invalid signature', details: err?.message || 'Unknown error' }, 400);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

  try {
    // Check for duplicate event (idempotency)
    const { data: existingEvent } = await supabase
      .from('stripe_webhook_events')
      .select('id, processed')
      .eq('stripe_event_id', event.id)
      .maybeSingle();

    if (existingEvent?.processed) {
      return json({ received: true, already_processed: true });
    }

    // Log the webhook event
    const { error: logErr } = await supabase.from('stripe_webhook_events').insert({
      stripe_event_id: event.id,
      event_type: event.type,
      event_data: event,
      processed: false
    });

    if (logErr) {
      console.error('[webhook] Failed to log event:', logErr);
      // Continue processing even if logging fails
    }

    switch (event.type) {
      case 'setup_intent.succeeded': {
        const si = event.data.object as any;
        const paymentMethodId = si.payment_method as string;
        const customerId = si.customer as string;
        const studentId = si.metadata?.student_id;

        if (!paymentMethodId || !customerId) {
          await supabase
            .from('stripe_webhook_events')
            .update({ processed: true, processed_at: new Date().toISOString(), error_message: 'Missing payment_method or customer' })
            .eq('stripe_event_id', event.id);
          return json({ received: true });
        }

        if (!studentId) {
          await supabase
            .from('stripe_webhook_events')
            .update({ processed: true, processed_at: new Date().toISOString(), error_message: 'Missing student_id in metadata' })
            .eq('stripe_event_id', event.id);
          return json({ received: true });
        }

        try {
          // Retrieve payment method details from Stripe
          const pm = await stripe.paymentMethods.retrieve(paymentMethodId);
          const card = (pm as any)?.card || {};

          // Check if student already has payment methods
          const { data: existingMethods, error: queryErr } = await supabase
            .from('student_payment_methods')
            .select('id')
            .eq('student_id', studentId);

          if (queryErr) {
            console.error('[webhook] Error querying existing payment methods:', queryErr);
          }

          const isFirstPaymentMethod = !existingMethods || existingMethods.length === 0;

          // Insert the new payment method
          const { error: insertErr } = await supabase
            .from('student_payment_methods')
            .insert({
              student_id: studentId,
              stripe_payment_method_id: paymentMethodId,
              is_default: isFirstPaymentMethod, // Set as default if it's the first one
              card_brand: card.brand || 'unknown',
              card_last4: card.last4 || '0000',
              card_exp_month: card.exp_month || 1,
              card_exp_year: card.exp_year || new Date().getFullYear() + 5,
              card_country: card.country || null,
            });

          if (insertErr) {
            console.error('[webhook] Failed to save payment method:', insertErr);
          }
        } catch (e: any) {
          console.error('[webhook] setup_intent handler error:', e?.message || e);
        }

        await supabase
          .from('stripe_webhook_events')
          .update({ processed: true, processed_at: new Date().toISOString() })
          .eq('stripe_event_id', event.id);
        return json({ received: true });
      }

      case 'payment_method.detached': {
        const pm = event.data.object as any;
        const paymentMethodId = pm.id as string;

        if (!paymentMethodId) {
          return json({ received: true });
        }

        try {
          // Get the payment method to check if it was default
          const { data: paymentMethod } = await supabase
            .from('student_payment_methods')
            .select('student_id, is_default')
            .eq('stripe_payment_method_id', paymentMethodId)
            .maybeSingle();

          // Delete the payment method
          const { error: deleteErr } = await supabase
            .from('student_payment_methods')
            .delete()
            .eq('stripe_payment_method_id', paymentMethodId);

          if (deleteErr) {
            console.error('[webhook] Failed to delete payment method:', deleteErr);
            return json({ received: true });
          }

          // If this was the default, promote another payment method to default
          if (paymentMethod?.is_default && paymentMethod?.student_id) {
            const { data: otherMethods } = await supabase
              .from('student_payment_methods')
              .select('id')
              .eq('student_id', paymentMethod.student_id)
              .limit(1);

            if (otherMethods && otherMethods.length > 0) {
              await supabase
                .from('student_payment_methods')
                .update({ is_default: true })
                .eq('id', otherMethods[0].id);
            }
          }
        } catch (e: any) {
          console.error('[webhook] payment_method.detached handler error:', e?.message || e);
        }

        await supabase
          .from('stripe_webhook_events')
          .update({ processed: true, processed_at: new Date().toISOString() })
          .eq('stripe_event_id', event.id);
        return json({ received: true });
      }

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

        // Legacy verification microcharge handling (deprecated - now using SetupIntent)
        // Kept for backward compatibility with old payment intents
        if (metadata?.type === 'verification') {
          console.warn('[webhook] Received legacy verification payment_intent - SetupIntent should be used instead');
          try {
            await stripe.refunds.create({ payment_intent: pi.id, reason: 'requested_by_customer' });
          } catch (e) {
            console.warn('[webhook] refund verification failed (non-fatal)', e?.message || e);
          }
          await supabase
            .from('stripe_webhook_events')
            .update({ processed: true, processed_at: new Date().toISOString() })
            .eq('stripe_event_id', event.id);
          return json({ received: true });
        }

        // Session charge success - match by PI ID (handles retries correctly)
        const { error: payErr } = await supabase
          .from('payment_attempts')
          .update({
            status: 'succeeded',
            stripe_charge_id: latestChargeId || null,
            charged_at: new Date().toISOString(),
            fee_cents,
            net_cents,
            receipt_url,
          })
          .eq('stripe_payment_intent_id', pi.id);
        if (payErr) console.error('[webhook] payment_attempts update error', payErr);
        
        await supabase
          .from('stripe_webhook_events')
          .update({ processed: true, processed_at: new Date().toISOString() })
          .eq('stripe_event_id', event.id);
        return json({ received: true });
      }

      case 'payment_intent.payment_failed': {
        const pi = event.data.object as any;
        const metadata = pi.metadata || {};
        const failure_code = pi.last_payment_error?.code || 'unknown_error';
        const failure_message = pi.last_payment_error?.message || 'payment_failed';
        
        // Update payment attempt by PI ID (handles retries correctly)
        const { error: updErr } = await supabase
          .from('payment_attempts')
          .update({ 
            status: 'failed',
            failure_code: failure_code,
            failure_message: failure_message 
          })
          .eq('stripe_payment_intent_id', pi.id);
        if (updErr) console.error('[webhook] payment_attempts fail update error', updErr);
        
        await supabase
          .from('stripe_webhook_events')
          .update({ processed: true, processed_at: new Date().toISOString() })
          .eq('stripe_event_id', event.id);
        return json({ received: true });
      }

      case 'charge.refunded': {
        const charge = event.data.object as any;
        
        // Update payment attempt to refunded status
        const { error: refundErr } = await supabase
          .from('payment_attempts')
          .update({ 
            status: 'refunded',
            refunded_at: new Date().toISOString()
          })
          .eq('stripe_charge_id', charge.id);
        
        if (refundErr) console.error('[webhook] refund update error', refundErr);
        
        await supabase
          .from('stripe_webhook_events')
          .update({ processed: true, processed_at: new Date().toISOString() })
          .eq('stripe_event_id', event.id);
        return json({ received: true });
      }

      case 'charge.dispute.created': {
        const dispute = event.data.object as any;
        const chargeId = dispute.charge as string;
        
        // Find payment attempt by stripe_charge_id
        const { data: paymentAttempt, error: findErr } = await supabase
          .from('payment_attempts')
          .select('id')
          .eq('stripe_charge_id', chargeId)
          .order('attempt_number', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        if (findErr) {
          console.error('[webhook] Error finding payment attempt for dispute:', findErr);
        } else if (paymentAttempt) {
          // Update payment attempt with dispute information
          const { error: updateErr } = await supabase
            .from('payment_attempts')
            .update({
              status: 'disputed',
              dispute_id: dispute.id,
              dispute_status: dispute.status,
              dispute_reason: dispute.reason,
              dispute_amount_cents: dispute.amount,
              dispute_currency: dispute.currency,
              dispute_created_at: new Date(dispute.created * 1000).toISOString(),
              dispute_updated_at: new Date().toISOString(),
            })
            .eq('id', paymentAttempt.id);
          
          if (updateErr) {
            console.error('[webhook] Error updating payment attempt with dispute:', updateErr);
          } else {
            console.log('[webhook] Dispute created for payment attempt:', paymentAttempt.id, 'dispute:', dispute.id);
          }
        } else {
          console.warn('[webhook] No payment attempt found for dispute charge:', chargeId);
        }
        
        await supabase
          .from('stripe_webhook_events')
          .update({ processed: true, processed_at: new Date().toISOString() })
          .eq('stripe_event_id', event.id);
        return json({ received: true });
      }

      case 'charge.dispute.updated': {
        const dispute = event.data.object as any;
        const chargeId = dispute.charge as string;
        
        // Find payment attempt by stripe_charge_id
        const { data: paymentAttempt, error: findErr } = await supabase
          .from('payment_attempts')
          .select('id')
          .eq('stripe_charge_id', chargeId)
          .order('attempt_number', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        if (findErr) {
          console.error('[webhook] Error finding payment attempt for dispute update:', findErr);
        } else if (paymentAttempt) {
          // Update dispute details
          const { error: updateErr } = await supabase
            .from('payment_attempts')
            .update({
              dispute_status: dispute.status,
              dispute_reason: dispute.reason,
              dispute_amount_cents: dispute.amount,
              dispute_updated_at: new Date().toISOString(),
            })
            .eq('id', paymentAttempt.id);
          
          if (updateErr) {
            console.error('[webhook] Error updating dispute:', updateErr);
          } else {
            console.log('[webhook] Dispute updated for payment attempt:', paymentAttempt.id);
          }
        } else {
          console.warn('[webhook] No payment attempt found for dispute update charge:', chargeId);
        }
        
        await supabase
          .from('stripe_webhook_events')
          .update({ processed: true, processed_at: new Date().toISOString() })
          .eq('stripe_event_id', event.id);
        return json({ received: true });
      }

      case 'charge.dispute.closed': {
        const dispute = event.data.object as any;
        const chargeId = dispute.charge as string;
        
        // Find payment attempt by stripe_charge_id
        const { data: paymentAttempt, error: findErr } = await supabase
          .from('payment_attempts')
          .select('id, status')
          .eq('stripe_charge_id', chargeId)
          .order('attempt_number', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        if (findErr) {
          console.error('[webhook] Error finding payment attempt for dispute closure:', findErr);
        } else if (paymentAttempt) {
          const disputeStatus = dispute.status; // 'won' or 'lost'
          const resolvedAt = new Date().toISOString();
          
          let updateData: any = {
            dispute_status: disputeStatus,
            dispute_resolved_at: resolvedAt,
            dispute_updated_at: resolvedAt,
          };
          
          // If dispute was won, restore payment to succeeded status
          // If lost, keep as disputed (or could change to dispute_lost if we add that status)
          if (disputeStatus === 'won') {
            updateData.status = 'succeeded';
            // Note: We don't update charged_at here as it should already be set
            console.log('[webhook] Dispute won - restoring payment to succeeded:', paymentAttempt.id);
          } else if (disputeStatus === 'lost') {
            // Keep status as 'disputed' - the dispute was lost
            console.log('[webhook] Dispute lost - keeping status as disputed:', paymentAttempt.id);
          }
          
          const { error: updateErr } = await supabase
            .from('payment_attempts')
            .update(updateData)
            .eq('id', paymentAttempt.id);
          
          if (updateErr) {
            console.error('[webhook] Error updating dispute closure:', updateErr);
          } else {
            console.log('[webhook] Dispute closed for payment attempt:', paymentAttempt.id, 'result:', disputeStatus);
          }
        } else {
          console.warn('[webhook] No payment attempt found for dispute closure charge:', chargeId);
        }
        
        await supabase
          .from('stripe_webhook_events')
          .update({ processed: true, processed_at: new Date().toISOString() })
          .eq('stripe_event_id', event.id);
        return json({ received: true });
      }

      case 'customer.source.expiring': {
        const source = event.data.object as any;
        const paymentMethodId = source.id;
        
        try {
          // Get student info for SMS notification
          const { data: pm } = await supabase
            .from('student_payment_methods')
            .select('student_id, is_default')
            .eq('stripe_payment_method_id', paymentMethodId)
            .maybeSingle();
          
          if (!pm || !pm.is_default) {
            await supabase
              .from('stripe_webhook_events')
              .update({ processed: true, processed_at: new Date().toISOString() })
              .eq('stripe_event_id', event.id);
            return json({ received: true });
          }
          
          // Get student's contact info
          const { data: contact } = await supabase
            .from('contacts')
            .select('id, phone_e164')
            .eq('student_id', pm.student_id)
            .maybeSingle();
          
          if (!contact?.phone_e164) {
            await supabase
              .from('stripe_webhook_events')
              .update({ processed: true, processed_at: new Date().toISOString() })
              .eq('stripe_event_id', event.id);
            return json({ received: true });
          }
          
          // Get owned number for SMS
          const { data: ownedNum } = await supabase
            .from('owned_numbers')
            .select('id')
            .eq('is_default', true)
            .maybeSingle();
          
          if (!ownedNum) {
            await supabase
              .from('stripe_webhook_events')
              .update({ processed: true, processed_at: new Date().toISOString() })
              .eq('stripe_event_id', event.id);
            return json({ received: true });
          }
          
          // Find or create conversation
          let convoId: string | undefined;
          const { data: existing } = await supabase
            .from('conversations')
            .select('id')
            .eq('contact_id', contact.id)
            .eq('owned_number_id', ownedNum.id)
            .maybeSingle();
          
          if (existing) {
            convoId = existing.id;
          } else {
            const { data: newConvo } = await supabase
              .from('conversations')
              .insert({ contact_id: contact.id, owned_number_id: ownedNum.id, status: 'OPEN' })
              .select('id')
              .single();
            convoId = newConvo?.id;
          }
          
          if (!convoId) {
            await supabase
              .from('stripe_webhook_events')
              .update({ processed: true, processed_at: new Date().toISOString() })
              .eq('stripe_event_id', event.id);
            return json({ received: true });
          }
          
          // Queue SMS
          const expMonth = source.exp_month;
          const expYear = source.exp_year;
          const body = `Your payment card ending in ${source.last4} expires ${expMonth}/${expYear}. Please update your payment method in the student portal to avoid payment issues.`;
          
          await supabase.from('messages').insert({
            conversation_id: convoId,
            body,
            direction: 'OUTGOING',
            status: 'QUEUED'
          });
          
          console.log('[webhook] Card expiry SMS queued for student', pm.student_id);
        } catch (e: any) {
          console.error('[webhook] customer.source.expiring handler error', e?.message || e);
        }
        
        await supabase
          .from('stripe_webhook_events')
          .update({ processed: true, processed_at: new Date().toISOString() })
          .eq('stripe_event_id', event.id);
        return json({ received: true });
      }

      default:
        // Mark event as processed for unknown/unhandled event types
        await supabase
          .from('stripe_webhook_events')
          .update({ processed: true, processed_at: new Date().toISOString() })
          .eq('stripe_event_id', event.id);
        return json({ received: true });
    }
  } catch (e: any) {
    console.error('[webhook] handler error', e?.message || e);
    
    // Log error to webhook events table
    await supabase
      .from('stripe_webhook_events')
      .update({ error_message: String(e?.message || e) })
      .eq('stripe_event_id', event.id);
    
    return json({ error: 'handler_error' }, 500);
  }
});



