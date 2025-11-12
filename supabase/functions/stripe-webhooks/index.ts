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
  if (!STRIPE_SECRET_KEY || !STRIPE_WEBHOOK_SECRET) {
    console.error('[webhook] Missing Stripe environment variables', {
      hasSecretKey: !!STRIPE_SECRET_KEY,
      hasWebhookSecret: !!STRIPE_WEBHOOK_SECRET,
    });
    return json({ error: 'Stripe env not configured' }, 500);
  }
  const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' });

  const sig = req.headers.get('stripe-signature') || '';
  if (!sig) {
    console.error('[webhook] Missing stripe-signature header');
    return json({ error: 'Missing stripe-signature header' }, 400);
  }

  // Read raw body as array buffer first to ensure exact bytes
  const arrayBuffer = await req.arrayBuffer();
  const rawBody = new TextDecoder().decode(arrayBuffer);
  
  let event: any;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, STRIPE_WEBHOOK_SECRET);
    console.log('[webhook] Signature verified successfully', { eventType: event.type, eventId: event.id });
  } catch (err: any) {
    console.error('[webhook] signature verify failed', {
      error: err?.message || err,
      errorType: err?.type,
      hasSignature: !!sig,
      signatureLength: sig.length,
      bodyLength: rawBody.length,
      webhookSecretPrefix: STRIPE_WEBHOOK_SECRET?.substring(0, 6),
      webhookSecretLength: STRIPE_WEBHOOK_SECRET?.length,
    });
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
      console.log('[webhook] Event already processed:', event.id);
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

        console.log('[webhook] setup_intent.succeeded received', {
          paymentMethodId,
          customerId,
          studentId,
          setupIntentId: si.id,
          metadata: si.metadata,
        });

        if (!paymentMethodId || !customerId) {
          console.error('[webhook] missing payment_method or customer in setup_intent', {
            hasPaymentMethod: !!paymentMethodId,
            hasCustomer: !!customerId,
          });
          await supabase
            .from('stripe_webhook_events')
            .update({ processed: true, processed_at: new Date().toISOString(), error_message: 'Missing payment_method or customer' })
            .eq('stripe_event_id', event.id);
          return json({ received: true });
        }

        if (!studentId) {
          console.error('[webhook] missing student_id in setup_intent metadata', {
            metadata: si.metadata,
          });
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

          console.log('[webhook] Retrieved payment method details', {
            cardBrand: card.brand,
            cardLast4: card.last4,
            cardExpMonth: card.exp_month,
            cardExpYear: card.exp_year,
          });

          // Check if student already has payment methods
          const { data: existingMethods, error: queryErr } = await supabase
            .from('student_payment_methods')
            .select('id')
            .eq('student_id', studentId);

          if (queryErr) {
            console.error('[webhook] Error querying existing payment methods', queryErr);
          }

          const isFirstPaymentMethod = !existingMethods || existingMethods.length === 0;

          console.log('[webhook] Inserting payment method', {
            studentId,
            paymentMethodId,
            isFirstPaymentMethod,
            existingMethodsCount: existingMethods?.length || 0,
          });

          // Insert the new payment method
          const { data: insertedData, error: insertErr } = await supabase
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
            })
            .select();

          if (insertErr) {
            console.error('[webhook] student_payment_methods insert error', {
              error: insertErr,
              code: insertErr.code,
              message: insertErr.message,
              details: insertErr.details,
              hint: insertErr.hint,
            });
          } else {
            console.log('[webhook] payment method saved successfully', {
              insertedId: insertedData?.[0]?.id,
            });
          }
        } catch (e: any) {
          console.error('[webhook] setup_intent handler error', {
            error: e?.message || e,
            stack: e?.stack,
          });
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
          console.error('[webhook] missing payment_method id in payment_method.detached');
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
            console.error('[webhook] student_payment_methods delete error', deleteErr);
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

          console.log('[webhook] payment method detached successfully');
        } catch (e: any) {
          console.error('[webhook] payment_method.detached handler error', e?.message || e);
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
        await supabase
          .from('stripe_webhook_events')
          .update({ processed: true, processed_at: new Date().toISOString() })
          .eq('stripe_event_id', event.id);
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
        await supabase
          .from('stripe_webhook_events')
          .update({ processed: true, processed_at: new Date().toISOString() })
          .eq('stripe_event_id', event.id);
        return json({ received: true });
      }

      case 'charge.refunded': {
        const charge = event.data.object as any;
        
        // Update payment record to refunded status
        const { error: refundErr } = await supabase
          .from('payments')
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



