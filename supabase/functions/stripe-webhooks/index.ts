// @ts-nocheck
// deno-lint-ignore-file no-explicit-any
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import Stripe from 'npm:stripe@16.6.0';
import { validateStripeEnv, validateSignatureHeader } from './shared/validation.ts';
import { shouldSkipEvent, getEventId, getEventType } from './shared/idempotency.ts';

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
  
  const envValidation = validateStripeEnv(STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET);
  if (!envValidation.valid) {
    console.error('[webhook] Stripe environment validation failed', {
      error: envValidation.error,
      hasSecretKey: !!STRIPE_SECRET_KEY,
      hasWebhookSecret: !!STRIPE_WEBHOOK_SECRET,
    });
    return json({ 
      error: envValidation.error === 'Invalid webhook secret format - must start with whsec_' 
        ? 'Invalid webhook secret format' 
        : 'Stripe env not configured',
      details: envValidation.error === 'Invalid webhook secret format - must start with whsec_'
        ? 'Webhook secret must start with whsec_. Please check your Supabase secrets match the Stripe Dashboard signing secret exactly.'
        : undefined
    }, 500);
  }
  
  const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' });

  const sig = req.headers.get('stripe-signature');
  const sigValidation = validateSignatureHeader(sig);
  if (!sigValidation.valid || !sig) {
    console.error('[webhook] Signature header validation failed:', sigValidation.error);
    return json({ error: sigValidation.error || 'Missing stripe-signature header' }, 400);
  }

  // Read raw body as text - Stripe's constructEvent accepts string
  // Important: Don't parse as JSON before signature verification
  const rawBody = await req.text();
  
  let event: any;
  try {
    // Use constructEventAsync for Deno/Supabase Edge Functions
    // constructEvent() uses synchronous crypto which isn't allowed in Deno
    event = await stripe.webhooks.constructEventAsync(rawBody, sig, STRIPE_WEBHOOK_SECRET!);
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
      .eq('stripe_event_id', getEventId(event))
      .maybeSingle();

    if (shouldSkipEvent(existingEvent)) {
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

      case 'customer.updated': {
        const customer = event.data.object as any;
        const customerId = customer.id;
        const defaultPmId = customer.invoice_settings?.default_payment_method as string | undefined;
        
        // Find student by stripe_customer_id
        const { data: billing } = await supabase
          .from('students_billing')
          .select('student_id')
          .eq('stripe_customer_id', customerId)
          .maybeSingle();
        
        if (!billing?.student_id) {
          await supabase
            .from('stripe_webhook_events')
            .update({ processed: true, processed_at: new Date().toISOString() })
            .eq('stripe_event_id', event.id);
          return json({ received: true });
        }
        
        try {
          // Note: Customer balance is now fetched on-demand from Stripe, not cached in DB
          
          // Update default payment method if provided
          if (defaultPmId) {
            // Unset all defaults for this student
            await supabase
              .from('student_payment_methods')
              .update({ is_default: false })
              .eq('student_id', billing.student_id);
            
            // Set the Stripe default as default in DB
            const { error: updateError } = await supabase
              .from('student_payment_methods')
              .update({ is_default: true })
              .eq('student_id', billing.student_id)
              .eq('stripe_payment_method_id', defaultPmId);
            
            if (updateError) {
              console.error('[webhook] Failed to sync default payment method:', updateError);
            }
          }
        } catch (e: any) {
          console.error('[webhook] customer.updated handler error:', e?.message || e);
        }
        
        await supabase
          .from('stripe_webhook_events')
          .update({ processed: true, processed_at: new Date().toISOString() })
          .eq('stripe_event_id', event.id);
        return json({ received: true });
      }

      case 'payment_method.updated': {
        const pm = event.data.object as any;
        const paymentMethodId = pm.id as string;
        
        if (!paymentMethodId || pm.type !== 'card' || !pm.card) {
          await supabase
            .from('stripe_webhook_events')
            .update({ processed: true, processed_at: new Date().toISOString() })
            .eq('stripe_event_id', event.id);
          return json({ received: true });
        }
        
        try {
          const card = pm.card || {};
          const { error: updateErr } = await supabase
            .from('student_payment_methods')
            .update({
              card_brand: card.brand || null,
              card_last4: card.last4 || null,
              card_exp_month: card.exp_month || null,
              card_exp_year: card.exp_year || null,
              card_country: card.country || null,
            })
            .eq('stripe_payment_method_id', paymentMethodId);
          
          if (updateErr) {
            console.error('[webhook] Failed to update payment method:', updateErr);
          }
        } catch (e: any) {
          console.error('[webhook] payment_method.updated handler error:', e?.message || e);
        }
        
        await supabase
          .from('stripe_webhook_events')
          .update({ processed: true, processed_at: new Date().toISOString() })
          .eq('stripe_event_id', event.id);
        return json({ received: true });
      }

      case 'invoice.created': {
        // Log invoice creation (optional, for tracking)
        const invoice = event.data.object as any;
        console.log('[webhook] Invoice created:', invoice.id, 'for customer:', invoice.customer);
        
        await supabase
          .from('stripe_webhook_events')
          .update({ processed: true, processed_at: new Date().toISOString() })
          .eq('stripe_event_id', event.id);
        return json({ received: true });
      }

      case 'invoice.finalized': {
        // Invoice finalized, ready to charge (optional, for tracking)
        const invoice = event.data.object as any;
        console.log('[webhook] Invoice finalized:', invoice.id);
        
        // Check current invoice status before updating
        // Don't overwrite 'paid' status if invoice was already paid
        const { data: currentInvoice } = await supabase
          .from('invoices')
          .select('status')
          .eq('stripe_invoice_id', invoice.id)
          .maybeSingle();
        
        // Only update finalized_at timestamp, don't overwrite status if already paid
        const updateData: any = {
          finalized_at: invoice.status_transitions?.finalized_at 
            ? new Date(invoice.status_transitions.finalized_at * 1000).toISOString()
            : new Date().toISOString(),
        };
        
        // Only update status if invoice is not already paid
        // This prevents invoice.finalized from overwriting 'paid' status set by invoice.paid
        if (currentInvoice?.status !== 'paid') {
          updateData.status = invoice.status;
        }
        
        await supabase
          .from('invoices')
          .update(updateData)
          .eq('stripe_invoice_id', invoice.id);
        
        await supabase
          .from('stripe_webhook_events')
          .update({ processed: true, processed_at: new Date().toISOString() })
          .eq('stripe_event_id', event.id);
        return json({ received: true });
      }

      case 'invoice.paid': {
        // CRITICAL: Invoice payment succeeded
        const invoice = event.data.object as any;
        
        let chargeId: string | null = null;
        let payment_intent_id: string | null = null;
        let fee_cents: number | null = null;
        let net_cents: number | null = null;
        let receipt_url: string | null = null;
        
        // Fetch invoice from Stripe with expanded fields to get charge/payment_intent IDs
        // Webhook payloads are minimal and don't include expanded fields or reliable subtotal/total
        // CRITICAL: Use fullInvoice for subtotal/total to correctly handle customer balance payments
        let fullInvoice: any = null;
        try {
          fullInvoice = await stripe.invoices.retrieve(invoice.id, {
            expand: ['latest_charge', 'payment_intent']
          });
          
          // Extract charge ID from latest_charge (can be string ID or expanded object)
          if (fullInvoice.latest_charge) {
            chargeId = typeof fullInvoice.latest_charge === 'string'
              ? fullInvoice.latest_charge
              : (fullInvoice.latest_charge as any)?.id || null;
          }
          
          // Extract payment intent ID from payment_intent (can be string ID or expanded object)
          if (fullInvoice.payment_intent) {
            payment_intent_id = typeof fullInvoice.payment_intent === 'string'
              ? fullInvoice.payment_intent
              : (fullInvoice.payment_intent as any)?.id || null;
          }
          
          // Retrieve charge details if we have charge ID
          if (chargeId) {
            try {
              const charge = await stripe.charges.retrieve(chargeId, { 
                expand: ['balance_transaction', 'payment_intent'] 
              });
              const bt: any = charge.balance_transaction;
              if (bt) {
                fee_cents = typeof bt.fee === 'number' ? bt.fee : null;
                net_cents = typeof bt.net === 'number' ? bt.net : null;
              }
              receipt_url = charge.receipt_url || null;
              
              // If payment_intent_id wasn't found from invoice, get it from charge
              if (!payment_intent_id && charge.payment_intent) {
                payment_intent_id = typeof charge.payment_intent === 'string'
                  ? charge.payment_intent
                  : (charge.payment_intent as any)?.id || null;
              }
            } catch (e: any) {
              console.error('[webhook] Error retrieving charge details:', e?.message || e);
            }
          }
        } catch (e: any) {
          console.error('[webhook] Error fetching invoice from Stripe:', e?.message || e);
          // Continue with update even if fetch fails - we'll just have null charge/payment_intent IDs
        }
        
        // Calculate amount paid from customer balance
        // Use fullInvoice if available (has reliable subtotal/total), otherwise fall back to webhook payload
        // When customer balance is applied: total > 0 but amount_due = 0
        const invoiceForAmounts = fullInvoice || invoice;
        const subtotalCents = invoiceForAmounts.subtotal ?? null;
        const totalCents = invoiceForAmounts.total ?? null;
        const amountDueCents = invoiceForAmounts.amount_due ?? 0;
        const amountPaidFromBalanceCents = totalCents !== null ? Math.max(0, totalCents - amountDueCents) : null;

        // Update invoice status to 'paid'
        const { error: payErr } = await supabase
          .from('invoices')
          .update({
            status: 'paid',
            stripe_charge_id: chargeId, // CRITICAL: For disputes
            stripe_payment_intent_id: payment_intent_id,
            subtotal_cents: subtotalCents,
            total_cents: totalCents,
            amount_paid_cents: invoiceForAmounts.amount_paid ?? invoiceForAmounts.amount_due ?? 0,
            amount_due_cents: amountDueCents,
            amount_paid_from_balance_cents: amountPaidFromBalanceCents,
            fee_cents,
            net_cents,
            receipt_url,
            hosted_invoice_url: invoice.hosted_invoice_url || null,
            invoice_pdf: invoice.invoice_pdf || null,
            paid_at: new Date().toISOString(),
          })
          .eq('stripe_invoice_id', invoice.id);
        
        if (payErr) console.error('[webhook] invoices update error', payErr);
        
        await supabase
          .from('stripe_webhook_events')
          .update({ processed: true, processed_at: new Date().toISOString() })
          .eq('stripe_event_id', event.id);
        return json({ received: true });
      }

      case 'invoice.payment_failed': {
        // CRITICAL: Invoice payment failed
        const invoice = event.data.object as any;
        const lastError = invoice.last_payment_error;
        const failure_code = lastError?.code || 'unknown_error';
        const failure_message = lastError?.message || 'payment_failed';
        
        // Update invoice status (remains 'open' for retries)
        // Store failure details in metadata
        const { error: updErr } = await supabase
          .from('invoices')
          .update({
            // Status remains 'open' for Stripe's automatic retries
            metadata: {
              last_payment_error: {
                code: failure_code,
                message: failure_message,
                type: lastError?.type || 'card_error',
              },
              last_failure_at: new Date().toISOString(),
            },
          })
          .eq('stripe_invoice_id', invoice.id);
        
        if (updErr) console.error('[webhook] invoices fail update error', updErr);
        
        await supabase
          .from('stripe_webhook_events')
          .update({ processed: true, processed_at: new Date().toISOString() })
          .eq('stripe_event_id', event.id);
        return json({ received: true });
      }

      case 'invoice.updated': {
        // MEDIUM: Handle status changes, updates to amounts, etc.
        const invoice = event.data.object as any;
        
        // Check current invoice status before updating
        // Don't downgrade status from 'paid' to lower statuses (e.g., 'open')
        const { data: currentInvoice } = await supabase
          .from('invoices')
          .select('status')
          .eq('stripe_invoice_id', invoice.id)
          .maybeSingle();
        
        // Fetch full invoice from Stripe API to get reliable subtotal/total values
        // Webhook payloads may not include these fields or may have them as null
        let fullInvoice: any = null;
        try {
          fullInvoice = await stripe.invoices.retrieve(invoice.id);
        } catch (e: any) {
          console.error('[webhook] Error fetching invoice from Stripe for invoice.updated:', e?.message || e);
          // Continue with webhook payload if fetch fails
        }
        
        // Calculate amount paid from customer balance
        // Use fullInvoice if available (has reliable subtotal/total), otherwise fall back to webhook payload
        const invoiceForAmounts = fullInvoice || invoice;
        const subtotalCents = invoiceForAmounts.subtotal ?? null;
        const totalCents = invoiceForAmounts.total ?? null;
        const amountDueCents = invoiceForAmounts.amount_due ?? 0;
        const amountPaidFromBalanceCents = totalCents !== null ? Math.max(0, totalCents - amountDueCents) : null;

        const updateData: any = {
          subtotal_cents: subtotalCents,
          total_cents: totalCents,
          amount_due_cents: amountDueCents,
          amount_paid_cents: invoiceForAmounts.amount_paid ?? 0,
          amount_paid_from_balance_cents: amountPaidFromBalanceCents,
          hosted_invoice_url: invoice.hosted_invoice_url || null,
          invoice_pdf: invoice.invoice_pdf || null,
        };
        
        // Only update status if it's not a downgrade from 'paid'
        // Valid transitions: draft -> open -> paid, but not paid -> open
        if (currentInvoice?.status === 'paid' && invoice.status !== 'paid') {
          // Don't overwrite 'paid' status with lower status
          console.log('[webhook] Skipping status update from paid to', invoice.status, 'for invoice:', invoice.id);
        } else {
          // Safe to update status
          updateData.status = invoice.status;
        }
        
        await supabase
          .from('invoices')
          .update(updateData)
          .eq('stripe_invoice_id', invoice.id);
        
        await supabase
          .from('stripe_webhook_events')
          .update({ processed: true, processed_at: new Date().toISOString() })
          .eq('stripe_event_id', event.id);
        return json({ received: true });
      }

      case 'invoice.voided': {
        const invoice = event.data.object as any;
        
        await supabase
          .from('invoices')
          .update({ status: 'void' })
          .eq('stripe_invoice_id', invoice.id);
        
        await supabase
          .from('stripe_webhook_events')
          .update({ processed: true, processed_at: new Date().toISOString() })
          .eq('stripe_event_id', event.id);
        return json({ received: true });
      }

      case 'invoice.marked_uncollectible': {
        const invoice = event.data.object as any;
        
        await supabase
          .from('invoices')
          .update({ status: 'uncollectible' })
          .eq('stripe_invoice_id', invoice.id);
        
        await supabase
          .from('stripe_webhook_events')
          .update({ processed: true, processed_at: new Date().toISOString() })
          .eq('stripe_event_id', event.id);
        return json({ received: true });
      }

      case 'charge.dispute.created': {
        // CRITICAL: Update invoice dispute fields
        const dispute = event.data.object as any;
        const chargeId = dispute.charge as string;
        
        // Find invoice by stripe_charge_id
        const { data: invoice, error: findErr } = await supabase
          .from('invoices')
          .select('id')
          .eq('stripe_charge_id', chargeId)
          .maybeSingle();
        
        if (findErr) {
          console.error('[webhook] Error finding invoice for dispute:', findErr);
        } else if (invoice) {
          // Update invoice with dispute information
          const { error: updateErr } = await supabase
            .from('invoices')
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
            .eq('id', invoice.id);
          
          if (updateErr) {
            console.error('[webhook] Error updating invoice with dispute:', updateErr);
          } else {
            console.log('[webhook] Dispute created for invoice:', invoice.id, 'dispute:', dispute.id);
          }
        } else {
          console.warn('[webhook] No invoice found for dispute charge:', chargeId);
        }
        
        await supabase
          .from('stripe_webhook_events')
          .update({ processed: true, processed_at: new Date().toISOString() })
          .eq('stripe_event_id', event.id);
        return json({ received: true });
      }

      case 'charge.dispute.updated': {
        // CRITICAL: Update invoice dispute status
        const dispute = event.data.object as any;
        const chargeId = dispute.charge as string;
        
        // Find invoice by stripe_charge_id
        const { data: invoice, error: findErr } = await supabase
          .from('invoices')
          .select('id')
          .eq('stripe_charge_id', chargeId)
          .maybeSingle();
        
        if (findErr) {
          console.error('[webhook] Error finding invoice for dispute update:', findErr);
        } else if (invoice) {
          // Update dispute details
          const { error: updateErr } = await supabase
            .from('invoices')
            .update({
              dispute_status: dispute.status,
              dispute_reason: dispute.reason,
              dispute_amount_cents: dispute.amount,
              dispute_updated_at: new Date().toISOString(),
            })
            .eq('id', invoice.id);
          
          if (updateErr) {
            console.error('[webhook] Error updating dispute:', updateErr);
          } else {
            console.log('[webhook] Dispute updated for invoice:', invoice.id);
          }
        } else {
          console.warn('[webhook] No invoice found for dispute update charge:', chargeId);
        }
        
        await supabase
          .from('stripe_webhook_events')
          .update({ processed: true, processed_at: new Date().toISOString() })
          .eq('stripe_event_id', event.id);
        return json({ received: true });
      }

      case 'charge.dispute.closed': {
        // CRITICAL: Update invoice dispute status, set dispute_resolved_at
        const dispute = event.data.object as any;
        const chargeId = dispute.charge as string;
        
        // Find invoice by stripe_charge_id
        const { data: invoice, error: findErr } = await supabase
          .from('invoices')
          .select('id, status')
          .eq('stripe_charge_id', chargeId)
          .maybeSingle();
        
        if (findErr) {
          console.error('[webhook] Error finding invoice for dispute closure:', findErr);
        } else if (invoice) {
          const disputeStatus = dispute.status; // 'won' or 'lost'
          const resolvedAt = new Date().toISOString();
          
          let updateData: any = {
            dispute_status: disputeStatus,
            dispute_resolved_at: resolvedAt,
            dispute_updated_at: resolvedAt,
          };
          
          // If dispute was won, restore invoice to paid status
          // If lost, keep as disputed
          if (disputeStatus === 'won') {
            updateData.status = 'paid';
            console.log('[webhook] Dispute won - restoring invoice to paid:', invoice.id);
          } else if (disputeStatus === 'lost') {
            // Keep status as 'disputed' - the dispute was lost
            console.log('[webhook] Dispute lost - keeping status as disputed:', invoice.id);
          }
          
          const { error: updateErr } = await supabase
            .from('invoices')
            .update(updateData)
            .eq('id', invoice.id);
          
          if (updateErr) {
            console.error('[webhook] Error updating dispute closure:', updateErr);
          } else {
            console.log('[webhook] Dispute closed for invoice:', invoice.id, 'result:', disputeStatus);
          }
        } else {
          console.warn('[webhook] No invoice found for dispute closure charge:', chargeId);
        }
        
        await supabase
          .from('stripe_webhook_events')
          .update({ processed: true, processed_at: new Date().toISOString() })
          .eq('stripe_event_id', event.id);
        return json({ received: true });
      }

      case 'credit_note.created': {
        // HIGH: Create credit_notes record for refunds
        const creditNote = event.data.object as any;
        const invoiceId = creditNote.invoice as string;
        
        // Find invoice by stripe_invoice_id
        const { data: invoice, error: findErr } = await supabase
          .from('invoices')
          .select('id')
          .eq('stripe_invoice_id', invoiceId)
          .maybeSingle();
        
        if (findErr) {
          console.error('[webhook] Error finding invoice for credit note:', findErr);
        } else if (invoice) {
          const { error: insertErr } = await supabase
            .from('credit_notes')
            .insert({
              invoice_id: invoice.id,
              stripe_credit_note_id: creditNote.id,
              amount_cents: creditNote.amount,
              currency: creditNote.currency,
              reason: creditNote.reason,
              status: creditNote.status,
              metadata: creditNote.metadata || {},
            });
          
          if (insertErr) {
            console.error('[webhook] Error creating credit note:', insertErr);
          } else {
            console.log('[webhook] Credit note created:', creditNote.id, 'for invoice:', invoice.id);
          }
        } else {
          console.warn('[webhook] No invoice found for credit note:', invoiceId);
        }
        
        await supabase
          .from('stripe_webhook_events')
          .update({ processed: true, processed_at: new Date().toISOString() })
          .eq('stripe_event_id', event.id);
        return json({ received: true });
      }

      case 'credit_note.updated': {
        // HIGH: Update credit_notes status
        const creditNote = event.data.object as any;
        
        await supabase
          .from('credit_notes')
          .update({
            status: creditNote.status,
            reason: creditNote.reason,
            updated_at: new Date().toISOString(),
          })
          .eq('stripe_credit_note_id', creditNote.id);
        
        await supabase
          .from('stripe_webhook_events')
          .update({ processed: true, processed_at: new Date().toISOString() })
          .eq('stripe_event_id', event.id);
        return json({ received: true });
      }

      case 'credit_note.voided': {
        // HIGH: Update credit_notes status to 'void'
        const creditNote = event.data.object as any;
        
        await supabase
          .from('credit_notes')
          .update({
            status: 'void',
            voided_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('stripe_credit_note_id', creditNote.id);
        
        await supabase
          .from('stripe_webhook_events')
          .update({ processed: true, processed_at: new Date().toISOString() })
          .eq('stripe_event_id', event.id);
        return json({ received: true });
      }

      case 'charge.refunded': {
        // HIGH: Track direct charge refunds (not via credit notes)
        const charge = event.data.object as any;
        const chargeId = charge.id;
        
        // Find invoice by stripe_charge_id
        const { data: invoice, error: findErr } = await supabase
          .from('invoices')
          .select('id')
          .eq('stripe_charge_id', chargeId)
          .maybeSingle();
        
        if (findErr) {
          console.error('[webhook] Error finding invoice for refunded charge:', findErr);
        } else if (invoice) {
          const { error: updateErr } = await supabase
            .from('invoices')
            .update({
              is_refunded: true,
              refunded_at: new Date().toISOString(),
            })
            .eq('id', invoice.id);
          
          if (updateErr) {
            console.error('[webhook] Error updating invoice refund status:', updateErr);
          } else {
            console.log('[webhook] Charge refunded for invoice:', invoice.id, 'charge:', chargeId);
          }
        } else {
          // Charge refunded but no invoice found - this is okay, might be a standalone charge
          console.log('[webhook] Charge refunded but no invoice found:', chargeId);
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



