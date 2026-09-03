import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serveWithSentry } from "../_shared/sentry.ts";
import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";
import Stripe from "npm:stripe@16.6.0";
import {
  validateStripeEnv,
  validateSignatureHeader,
} from "./shared/validation.ts";
import {
  shouldSkipEvent,
  getEventId,
  getEventType,
} from "./shared/idempotency.ts";
import {
  syncSubscriptionInvoiceFromStripe,
  retrieveInvoiceWithLines,
} from "./shared/subscription-invoice-sync.ts";
import { forfeitPracticeDayCreditsForStudent } from "./shared/forfeit-practice-day-credits.ts";
import { sendUcatTrialReminder } from "./shared/ucat-trial-reminder.ts";
import {
  applyQueuedReferralRewardToInvoice,
  markReferralRewardRedeemed,
  maybeQualifyPaidUcatReferral,
  requeueReferralReward,
  resolveCustomerCardFingerprint,
} from "./shared/ucat-referral-rewards.ts";
import {
  notifyUcatBillingAccessEnded,
  notifyUcatInvoiceFinalizationFailed,
  notifyUcatInvoicePaymentFailed,
  markUcatBillingAccessEndedEmailSent,
  resolveUcatBillingAccessEndedNotificationsForStudent,
  resolveUcatBillingRecoveryNotificationsForStudent,
  resolveUcatInvoiceFinalizationFailedNotification,
  resolveUcatInvoicePaymentFailedNotification,
} from "./shared/ucat-notifications.ts";
import {
  clearSubscriptionBillingRecovery,
  recordSubscriptionBillingRecovery,
  stripeTimestampToIso,
  updateSubscriptionBillingRetryTime,
} from "./shared/billing-recovery.ts";
import { sendUcatBillingAccessEndedEmail } from "./shared/ucat-billing-email.ts";
import {
  captureUcatSubscriptionPosthogEvent,
  isUcatPaidAcquisitionConversion,
  isUcatSubscriptionRenewal,
} from "./shared/posthog.ts";

function json(resp: unknown, status = 200) {
  return new Response(JSON.stringify(resp), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function getUcatSubjectId(
  supabase: SupabaseClient,
): Promise<string | null> {
  const { data } = await supabase
    .from("subjects")
    .select("id")
    .eq("name", "UCAT")
    .maybeSingle();
  return data?.id ?? null;
}

const ACTIVE_SUBSCRIPTION_STATUSES = new Set([
  "active",
  "trialing",
  "past_due",
]);

async function queueUcatTransactionalEmail(
  supabase: SupabaseClient,
  input: {
    studentId: string;
    template:
      | "subscription_activated"
      | "subscription_cancellation_scheduled"
      | "subscription_cancellation_reversed"
      | "subscription_canceled";
    eventKey: string;
    payload?: Record<string, unknown>;
  },
): Promise<void> {
  const { error } = await supabase.rpc(
    "queue_ucat_student_transactional_email",
    {
      p_student_id: input.studentId,
      p_template_key: input.template,
      p_event_key: input.eventKey,
      p_payload: {
        action_path: input.template === "subscription_activated"
          ? "/study-plan"
          : "/settings/plan/subscription",
        ...(input.payload ?? {}),
      },
    },
  );
  if (error) {
    throw new Error(
      `Could not queue ${input.template} email: ${error.message}`,
    );
  }
}

async function handleUcatFailedBillingTerminalState(
  supabase: SupabaseClient,
  stripe: Stripe,
  input: {
    studentId: string;
    subjectId: string;
    stripeSubscriptionId: string;
    planTier: string | null;
    wasInRecovery: boolean;
  },
): Promise<void> {
  if (!input.wasInRecovery) return;

  const ucatSubjectId = await getUcatSubjectId(supabase);
  if (!ucatSubjectId || input.subjectId !== ucatSubjectId) return;

  await forfeitPracticeDayCreditsForStudent(supabase, stripe, input.studentId);

  await resolveUcatBillingRecoveryNotificationsForStudent(
    supabase,
    input.studentId,
  );

  const terminalNotification = await notifyUcatBillingAccessEnded(supabase, {
    studentId: input.studentId,
    stripeSubscriptionId: input.stripeSubscriptionId,
  });

  if (!terminalNotification || terminalNotification.emailSentAt) return;
  const emailSent = await sendUcatBillingAccessEndedEmail(supabase, {
    studentId: input.studentId,
    planTier: input.planTier,
    stripeSubscriptionId: input.stripeSubscriptionId,
  });
  if (emailSent) {
    await markUcatBillingAccessEndedEmailSent(supabase, {
      notificationId: terminalNotification.notificationId,
      metadata: terminalNotification.metadata,
    });
  }
}

function subscriptionPeriodFields(subscription: {
  current_period_start?: number;
  current_period_end?: number;
  items?: {
    data?: Array<{
      current_period_start?: number;
      current_period_end?: number;
    }>;
  };
}): { current_period_start: string | null; current_period_end: string | null } {
  const item = subscription.items?.data?.[0];
  const start =
    subscription.current_period_start ?? item?.current_period_start ?? null;
  const end =
    subscription.current_period_end ?? item?.current_period_end ?? null;
  return {
    current_period_start:
      start != null ? new Date(start * 1000).toISOString() : null,
    current_period_end: end != null ? new Date(end * 1000).toISOString() : null,
  };
}

function subscriptionCancelFields(subscription: {
  status?: string;
  cancel_at_period_end?: boolean;
  cancel_at?: number | null;
  current_period_end?: number;
  items?: { data?: Array<{ current_period_end?: number }> };
}): { cancel_at_period_end: boolean; cancel_at: string | null } {
  const cancelAtPeriodEnd = subscription.cancel_at_period_end ?? false;
  const status = subscription.status ?? "active";
  const stillActive = ACTIVE_SUBSCRIPTION_STATUSES.has(status);

  if (subscription.cancel_at) {
    const cancelAtMs = subscription.cancel_at * 1000;
    const isScheduled = stillActive && cancelAtMs > Date.now();
    return {
      cancel_at_period_end: cancelAtPeriodEnd || isScheduled,
      cancel_at: new Date(cancelAtMs).toISOString(),
    };
  }

  if (cancelAtPeriodEnd) {
    const periodEnd =
      subscription.current_period_end ??
      subscription.items?.data?.[0]?.current_period_end;
    if (periodEnd) {
      return {
        cancel_at_period_end: true,
        cancel_at: new Date(periodEnd * 1000).toISOString(),
      };
    }
  }

  return { cancel_at_period_end: cancelAtPeriodEnd, cancel_at: null };
}

type UcatPlanFields = {
  plan_tier: "unlimited" | null;
  billing_interval: "week" | "month" | "year" | null;
};

async function resolveUcatPlanFields(
  supabase: SupabaseClient,
  priceId: string | null,
  productId: string | null,
  metadata?: Record<string, string> | null,
): Promise<UcatPlanFields> {
  const metaTier = metadata?.ucat_plan_tier;
  const metaInterval = metadata?.ucat_billing_interval;
  if (
    metaTier === "unlimited" &&
    (metaInterval === "week" ||
      metaInterval === "month" ||
      metaInterval === "year")
  ) {
    return { plan_tier: metaTier, billing_interval: metaInterval };
  }

  if (priceId) {
    const { data } = await supabase
      .from("ucat_plan_prices")
      .select("plan_tier, billing_interval")
      .eq("stripe_price_id", priceId)
      .maybeSingle();
    if (data?.plan_tier === "unlimited") {
      const interval = data.billing_interval;
      if (interval === "week" || interval === "month" || interval === "year") {
        return { plan_tier: data.plan_tier, billing_interval: interval };
      }
      return { plan_tier: data.plan_tier, billing_interval: null };
    }
  }

  if (productId) {
    const { data: config } = await supabase
      .from("ucat_subscription_config")
      .select("unlimited_stripe_product_id")
      .limit(1)
      .maybeSingle();
    if (config?.unlimited_stripe_product_id === productId) {
      return { plan_tier: "unlimited", billing_interval: null };
    }
  }

  return { plan_tier: null, billing_interval: null };
}

serveWithSentry("stripe-webhooks", async (req: Request, sentry) => {
  // Health check endpoint
  if (
    req.method === "GET" ||
    (req.method === "POST" && req.url.includes("health"))
  ) {
    return json({
      status: "ok",
      timestamp: new Date().toISOString(),
      function: "stripe-webhooks",
    });
  }

  const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")?.trim();
  const STRIPE_WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET")?.trim();

  const envValidation = validateStripeEnv(
    STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET,
  );
  if (!envValidation.valid) {
    console.error("[webhook] Stripe environment validation failed", {
      error: envValidation.error,
      hasSecretKey: !!STRIPE_SECRET_KEY,
      hasWebhookSecret: !!STRIPE_WEBHOOK_SECRET,
    });
    return json(
      {
        error:
          envValidation.error ===
          "Invalid webhook secret format - must start with whsec_"
            ? "Invalid webhook secret format"
            : "Stripe env not configured",
        details:
          envValidation.error ===
          "Invalid webhook secret format - must start with whsec_"
            ? "Webhook secret must start with whsec_. Please check your Supabase secrets match the Stripe Dashboard signing secret exactly."
            : undefined,
      },
      500,
    );
  }

  const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" });

  const sig = req.headers.get("stripe-signature");
  const sigValidation = validateSignatureHeader(sig);
  if (!sigValidation.valid || !sig) {
    console.error(
      "[webhook] Signature header validation failed:",
      sigValidation.error,
    );
    return json(
      { error: sigValidation.error || "Missing stripe-signature header" },
      400,
    );
  }

  // Read raw body as text - Stripe's constructEvent accepts string
  // Important: Don't parse as JSON before signature verification
  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    // Use constructEventAsync for Deno/Supabase Edge Functions
    // constructEvent() uses synchronous crypto which isn't allowed in Deno
    event = await stripe.webhooks.constructEventAsync(
      rawBody,
      sig,
      STRIPE_WEBHOOK_SECRET!,
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[webhook] Signature verification failed:", msg);
    return json(
      {
        error: "invalid signature",
        details: err instanceof Error ? err.message : "Unknown error",
      },
      400,
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
  });

  try {
    // Check for duplicate event (idempotency)
    const { data: existingEvent } = await supabase
      .from("stripe_webhook_events")
      .select("id, processed")
      .eq("stripe_event_id", getEventId(event))
      .maybeSingle();

    if (shouldSkipEvent(existingEvent)) {
      return json({ received: true, already_processed: true });
    }

    // Log the webhook event
    const { error: logErr } = await supabase
      .from("stripe_webhook_events")
      .insert({
        stripe_event_id: event.id,
        event_type: event.type,
        event_data: event,
        processed: false,
      });

    if (logErr) {
      console.error("[webhook] Failed to log event:", logErr);
      // Continue processing even if logging fails
    }

    switch (event.type) {
      case "setup_intent.succeeded": {
        const si = event.data.object as {
          payment_method?: string;
          customer?: string;
          metadata?: { student_id?: string };
        };
        const paymentMethodId = si.payment_method as string;
        const customerId = si.customer as string;
        const studentId = si.metadata?.student_id;

        if (!paymentMethodId || !customerId) {
          await supabase
            .from("stripe_webhook_events")
            .update({
              processed: true,
              processed_at: new Date().toISOString(),
              error_message: "Missing payment_method or customer",
            })
            .eq("stripe_event_id", event.id);
          return json({ received: true });
        }

        if (!studentId) {
          await supabase
            .from("stripe_webhook_events")
            .update({
              processed: true,
              processed_at: new Date().toISOString(),
            })
            .eq("stripe_event_id", event.id);
          return json({ received: true });
        }

        try {
          // Retrieve payment method details from Stripe
          const pm = await stripe.paymentMethods.retrieve(paymentMethodId);
          const card =
            (pm && typeof pm === "object" && "card" in pm
              ? (
                  pm as {
                    card?: {
                      brand?: string;
                      last4?: string;
                      exp_month?: number;
                      exp_year?: number;
                      country?: string;
                      fingerprint?: string;
                    };
                  }
                ).card
              : null) || {};

          // Check if student already has payment methods
          const { data: existingMethods, error: queryErr } = await supabase
            .from("student_payment_methods")
            .select("id")
            .eq("student_id", studentId);

          if (queryErr) {
            console.error(
              "[webhook] Error querying existing payment methods:",
              queryErr,
            );
          }

          const isFirstPaymentMethod =
            !existingMethods || existingMethods.length === 0;

          // Insert the new payment method
          const { error: insertErr } = await supabase
            .from("student_payment_methods")
            .insert({
              student_id: studentId,
              stripe_payment_method_id: paymentMethodId,
              is_default: isFirstPaymentMethod, // Set as default if it's the first one
              card_brand: card.brand || "unknown",
              card_last4: card.last4 || "0000",
              card_exp_month: card.exp_month || 1,
              card_exp_year: card.exp_year || new Date().getFullYear() + 5,
              card_country: card.country || null,
              card_fingerprint: card.fingerprint || null,
            });

          if (insertErr) {
            console.error(
              "[webhook] Failed to save payment method:",
              insertErr,
            );
          }

          const { data: trialSubscription } = await supabase
            .from("student_subscriptions")
            .select("stripe_subscription_id")
            .eq("student_id", studentId)
            .eq("status", "trialing")
            .maybeSingle();
          if (trialSubscription?.stripe_subscription_id) {
            await maybeQualifyPaidUcatReferral({
              supabase,
              stripe,
              referredStudentId: studentId,
              subscriptionId: trialSubscription.stripe_subscription_id,
              customerId,
              currentFingerprint: card.fingerprint || null,
            });
          }
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : String(e);
          console.error("[webhook] setup_intent handler error:", msg);
        }

        await supabase
          .from("stripe_webhook_events")
          .update({ processed: true, processed_at: new Date().toISOString() })
          .eq("stripe_event_id", event.id);
        return json({ received: true });
      }

      case "payment_method.detached": {
        const pm = event.data.object as { id?: string };
        const paymentMethodId = pm.id as string;

        if (!paymentMethodId) {
          return json({ received: true });
        }

        try {
          // Get the payment method to check if it was default
          const { data: paymentMethod } = await supabase
            .from("student_payment_methods")
            .select("student_id, is_default")
            .eq("stripe_payment_method_id", paymentMethodId)
            .maybeSingle();

          // Delete the payment method
          const { error: deleteErr } = await supabase
            .from("student_payment_methods")
            .delete()
            .eq("stripe_payment_method_id", paymentMethodId);

          if (deleteErr) {
            console.error(
              "[webhook] Failed to delete payment method:",
              deleteErr,
            );
            return json({ received: true });
          }

          // If this was the default, promote another payment method to default
          if (paymentMethod?.is_default && paymentMethod?.student_id) {
            const { data: otherMethods } = await supabase
              .from("student_payment_methods")
              .select("id")
              .eq("student_id", paymentMethod.student_id)
              .limit(1);

            if (otherMethods && otherMethods.length > 0) {
              await supabase
                .from("student_payment_methods")
                .update({ is_default: true })
                .eq("id", otherMethods[0].id);
            }
          }
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : String(e);
          console.error(
            "[webhook] payment_method.detached handler error:",
            msg,
          );
        }

        await supabase
          .from("stripe_webhook_events")
          .update({ processed: true, processed_at: new Date().toISOString() })
          .eq("stripe_event_id", event.id);
        return json({ received: true });
      }

      case "customer.updated": {
        const customer = event.data.object as {
          id: string;
          invoice_settings?: { default_payment_method?: string };
        };
        const customerId = customer.id;
        const defaultPmId = customer.invoice_settings
          ?.default_payment_method as string | undefined;

        // Find student by stripe_customer_id
        const { data: billing } = await supabase
          .from("students_billing")
          .select("student_id")
          .eq("stripe_customer_id", customerId)
          .maybeSingle();

        if (!billing?.student_id) {
          await supabase
            .from("stripe_webhook_events")
            .update({ processed: true, processed_at: new Date().toISOString() })
            .eq("stripe_event_id", event.id);
          return json({ received: true });
        }

        try {
          // Note: Customer balance is now fetched on-demand from Stripe, not cached in DB

          // Update default payment method if provided
          if (defaultPmId) {
            // Unset all defaults for this student
            await supabase
              .from("student_payment_methods")
              .update({ is_default: false })
              .eq("student_id", billing.student_id);

            // Set the Stripe default as default in DB
            const { error: updateError } = await supabase
              .from("student_payment_methods")
              .update({ is_default: true })
              .eq("student_id", billing.student_id)
              .eq("stripe_payment_method_id", defaultPmId);

            if (updateError) {
              console.error(
                "[webhook] Failed to sync default payment method:",
                updateError,
              );
            }
          }
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : String(e);
          console.error("[webhook] customer.updated handler error:", msg);
        }

        await supabase
          .from("stripe_webhook_events")
          .update({ processed: true, processed_at: new Date().toISOString() })
          .eq("stripe_event_id", event.id);
        return json({ received: true });
      }

      case "payment_method.updated": {
        const pm = event.data.object as {
          id?: string;
          type?: string;
          card?: {
            brand?: string;
            last4?: string;
            exp_month?: number;
            exp_year?: number;
            country?: string;
          };
        };
        const paymentMethodId = pm.id as string;

        if (!paymentMethodId || pm.type !== "card" || !pm.card) {
          await supabase
            .from("stripe_webhook_events")
            .update({ processed: true, processed_at: new Date().toISOString() })
            .eq("stripe_event_id", event.id);
          return json({ received: true });
        }

        try {
          const card = pm.card || {};
          const { error: updateErr } = await supabase
            .from("student_payment_methods")
            .update({
              card_brand: card.brand || null,
              card_last4: card.last4 || null,
              card_exp_month: card.exp_month || null,
              card_exp_year: card.exp_year || null,
              card_country: card.country || null,
            })
            .eq("stripe_payment_method_id", paymentMethodId);

          if (updateErr) {
            console.error(
              "[webhook] Failed to update payment method:",
              updateErr,
            );
          }
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : String(e);
          console.error("[webhook] payment_method.updated handler error:", msg);
        }

        await supabase
          .from("stripe_webhook_events")
          .update({ processed: true, processed_at: new Date().toISOString() })
          .eq("stripe_event_id", event.id);
        return json({ received: true });
      }

      case "invoice.created": {
        const invoice = event.data.object as Stripe.Invoice;
        const referralRewardApplied = await applyQueuedReferralRewardToInvoice({
          supabase,
          stripe,
          invoice,
        });
        console.log(
          "[webhook] Invoice created:",
          invoice.id,
          "for customer:",
          invoice.customer,
          referralRewardApplied ? "with referral reward" : "",
        );

        await supabase
          .from("stripe_webhook_events")
          .update({ processed: true, processed_at: new Date().toISOString() })
          .eq("stripe_event_id", event.id);
        return json({ received: true });
      }

      case "invoice.finalized": {
        // Invoice finalized, ready to charge (optional, for tracking)
        const invoice = event.data.object as {
          id: string;
          status?: string;
          status_transitions?: { finalized_at?: number };
        };
        console.log("[webhook] Invoice finalized:", invoice.id);

        const subSync = await syncSubscriptionInvoiceFromStripe(
          supabase,
          stripe,
          invoice.id,
        );
        if (!subSync.ok && !("skipped" in subSync && subSync.skipped)) {
          console.error(
            "[webhook] subscription invoice sync (finalized):",
            subSync,
          );
        }

        // Check current invoice status before updating
        // Don't overwrite 'paid' status if invoice was already paid
        const { data: currentInvoice } = await supabase
          .from("invoices")
          .select("status")
          .eq("stripe_invoice_id", invoice.id)
          .is("deleted_at", null)
          .maybeSingle();

        // Only update finalized_at timestamp, don't overwrite status if already paid
        const updateData: Record<string, unknown> = {
          finalized_at: invoice.status_transitions?.finalized_at
            ? new Date(
                invoice.status_transitions.finalized_at * 1000,
              ).toISOString()
            : new Date().toISOString(),
        };

        // Only update status if invoice is not already paid
        // This prevents invoice.finalized from overwriting 'paid' status set by invoice.paid
        if (currentInvoice?.status !== "paid") {
          updateData.status = invoice.status;
        }

        await supabase
          .from("invoices")
          .update(updateData)
          .eq("stripe_invoice_id", invoice.id)
          .is("deleted_at", null);

        await resolveUcatInvoiceFinalizationFailedNotification(
          supabase,
          invoice.id,
        );

        await supabase
          .from("stripe_webhook_events")
          .update({ processed: true, processed_at: new Date().toISOString() })
          .eq("stripe_event_id", event.id);
        return json({ received: true });
      }

      case "invoice.paid": {
        // CRITICAL: Invoice payment succeeded
        const invoice = event.data.object as {
          id: string;
          hosted_invoice_url?: string;
          invoice_pdf?: string;
          charge?: string | { id: string };
          payment_intent?: string | { id: string };
          subtotal?: number | null;
          total?: number | null;
          amount_due?: number;
          amount_paid?: number;
          currency?: string;
        };

        // Extract charge/payment_intent from payload first (Stripe sends these on invoice.paid)
        const idFrom = (
          v: string | { id: string } | null | undefined,
        ): string | null =>
          v == null
            ? null
            : typeof v === "string"
              ? v
              : "id" in v
                ? (v as { id: string }).id
                : null;

        let chargeId: string | null = idFrom(invoice.charge);
        let payment_intent_id: string | null = idFrom(invoice.payment_intent);
        let fee_cents: number | null = null;
        let net_cents: number | null = null;
        let receipt_url: string | null = null;

        // Fallback: fetch from Stripe if payload didn't include charge/payment_intent
        // Also needed for reliable subtotal/total (customer balance, etc.)
        let fullInvoice: Stripe.Invoice | null = null;
        let paidSubscriptionContext: {
          dbInvoiceId: string;
          studentId: string;
          stripeSubscriptionId: string;
        } | null = null;
        try {
          fullInvoice = await retrieveInvoiceWithLines(stripe, invoice.id, [
            "latest_charge",
            "payment_intent",
          ]);

          const paidSync = await syncSubscriptionInvoiceFromStripe(
            supabase,
            stripe,
            fullInvoice,
          );
          if (!paidSync.ok && !("skipped" in paidSync && paidSync.skipped)) {
            console.error(
              "[webhook] subscription invoice sync (paid):",
              paidSync,
            );
          }
          if (paidSync.ok) {
            paidSubscriptionContext = {
              dbInvoiceId: paidSync.dbInvoiceId,
              studentId: paidSync.studentId,
              stripeSubscriptionId: paidSync.stripeSubscriptionId,
            };
          }

          if (!chargeId && fullInvoice.latest_charge) {
            const lc = fullInvoice.latest_charge;
            chargeId =
              typeof lc === "string"
                ? lc
                : lc && typeof lc === "object" && "id" in lc
                  ? (lc as { id: string }).id
                  : null;
          }
          if (
            !chargeId &&
            (fullInvoice as { charge?: string | { id: string } }).charge
          ) {
            chargeId = idFrom(
              (fullInvoice as { charge?: string | { id: string } }).charge,
            );
          }
          if (!payment_intent_id && fullInvoice.payment_intent) {
            const pi = fullInvoice.payment_intent;
            payment_intent_id =
              typeof pi === "string"
                ? pi
                : pi && typeof pi === "object" && "id" in pi
                  ? (pi as { id: string }).id
                  : null;
          }
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : String(e);
          console.error("[webhook] Error fetching invoice from Stripe:", msg);
          // We may already have chargeId/payment_intent_id from payload
        }

        // Retrieve charge details if we have charge ID (for fee_cents, net_cents, receipt_url)
        if (chargeId) {
          try {
            const charge = await stripe.charges.retrieve(chargeId, {
              expand: ["balance_transaction", "payment_intent"],
            });
            const bt = charge.balance_transaction as {
              fee?: number;
              net?: number;
            } | null;
            if (bt) {
              fee_cents = typeof bt.fee === "number" ? bt.fee : null;
              net_cents = typeof bt.net === "number" ? bt.net : null;
            }
            receipt_url = charge.receipt_url || null;
            if (!payment_intent_id && charge.payment_intent) {
              const cpi = charge.payment_intent;
              payment_intent_id =
                typeof cpi === "string"
                  ? cpi
                  : cpi && typeof cpi === "object" && "id" in cpi
                    ? (cpi as { id: string }).id
                    : null;
            }
          } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            console.error("[webhook] Error retrieving charge details:", msg);
          }
        }

        // Calculate amount paid from customer balance
        // Use fullInvoice if available (has reliable subtotal/total), otherwise fall back to webhook payload
        // When customer balance is applied: total > 0 but amount_due = 0
        const invoiceForAmounts = fullInvoice || invoice;
        const subtotalCents = invoiceForAmounts.subtotal ?? null;
        const totalCents = invoiceForAmounts.total ?? null;
        const amountDueCents = invoiceForAmounts.amount_due ?? 0;
        const amountPaidFromBalanceCents =
          totalCents !== null ? Math.max(0, totalCents - amountDueCents) : null;

        // Update invoice status to 'paid'
        const { error: payErr } = await supabase
          .from("invoices")
          .update({
            status: "paid",
            stripe_charge_id: chargeId, // CRITICAL: For disputes
            stripe_payment_intent_id: payment_intent_id,
            subtotal_cents: subtotalCents,
            total_cents: totalCents,
            amount_paid_cents:
              invoiceForAmounts.amount_paid ??
              invoiceForAmounts.amount_due ??
              0,
            amount_due_cents: amountDueCents,
            amount_paid_from_balance_cents: amountPaidFromBalanceCents,
            fee_cents,
            net_cents,
            receipt_url,
            hosted_invoice_url: invoice.hosted_invoice_url || null,
            invoice_pdf: invoice.invoice_pdf || null,
            paid_at: new Date().toISOString(),
          })
          .eq("stripe_invoice_id", invoice.id)
          .is("deleted_at", null);

        if (payErr) console.error("[webhook] invoices update error", payErr);

        await resolveUcatInvoicePaymentFailedNotification(supabase, invoice.id);
        await resolveUcatInvoiceFinalizationFailedNotification(
          supabase,
          invoice.id,
        );
        await clearSubscriptionBillingRecovery(supabase, invoice.id);

        await markReferralRewardRedeemed(supabase, invoice.id);

        if (paidSubscriptionContext) {
          const { data: subscriptionRow } = await supabase
            .from("student_subscriptions")
            .select("id, plan_tier, billing_interval")
            .eq(
              "stripe_subscription_id",
              paidSubscriptionContext.stripeSubscriptionId,
            )
            .maybeSingle();
          const amountPaidCents = invoiceForAmounts.amount_paid ?? 0;
          let priorPositiveSubscriptionPayments: number | null =
            amountPaidCents > 0 ? null : 0;
          if (amountPaidCents > 0) {
            const { count, error: priorPaymentsError } = await supabase
              .from("invoices")
              .select("id", { count: "exact", head: true })
              .eq("student_id", paidSubscriptionContext.studentId)
              .eq("billing_source", "subscription")
              .eq("status", "paid")
              .gt("amount_paid_cents", 0)
              .neq("id", paidSubscriptionContext.dbInvoiceId);
            if (priorPaymentsError) {
              console.error(
                "[webhook] Could not classify first subscription payment",
                priorPaymentsError,
              );
            } else {
              priorPositiveSubscriptionPayments = count ?? 0;
            }
          }
          const isFirstPositiveSubscriptionPayment =
            priorPositiveSubscriptionPayments !== null &&
            isUcatPaidAcquisitionConversion(
              amountPaidCents,
              priorPositiveSubscriptionPayments,
            );
          const billingReason = fullInvoice?.billing_reason ?? null;
          const commonPaymentProperties = {
            stripe_subscription_id:
              paidSubscriptionContext.stripeSubscriptionId,
            stripe_invoice_id: invoice.id,
            plan_tier: subscriptionRow?.plan_tier ?? null,
            billing_interval: subscriptionRow?.billing_interval ?? null,
            billing_reason: billingReason,
            amount_paid_cents: amountPaidCents,
            currency: invoiceForAmounts.currency ?? null,
            is_positive_value: amountPaidCents > 0,
            is_paid_acquisition_conversion:
              isFirstPositiveSubscriptionPayment,
          };
          await captureUcatSubscriptionPosthogEvent(supabase, {
            eventName: "subscription_payment_succeeded",
            providerEventId: event.id,
            occurredAt: new Date(event.created * 1000).toISOString(),
            studentId: paidSubscriptionContext.studentId,
            properties: commonPaymentProperties,
          });
          if (isUcatSubscriptionRenewal(billingReason, amountPaidCents)) {
            await captureUcatSubscriptionPosthogEvent(supabase, {
              eventName: "subscription_renewed",
              providerEventId: event.id,
              occurredAt: new Date(event.created * 1000).toISOString(),
              studentId: paidSubscriptionContext.studentId,
              properties: commonPaymentProperties,
            });
          }
        }

        await supabase
          .from("stripe_webhook_events")
          .update({ processed: true, processed_at: new Date().toISOString() })
          .eq("stripe_event_id", event.id);
        return json({ received: true });
      }

      case "invoice.payment_action_required": {
        const invoice = event.data.object as Stripe.Invoice;
        const actionSync = await syncSubscriptionInvoiceFromStripe(
          supabase,
          stripe,
          invoice.id,
        );
        if (
          !actionSync.ok &&
          !("skipped" in actionSync && actionSync.skipped)
        ) {
          console.error(
            "[webhook] subscription invoice sync (payment_action_required):",
            actionSync,
          );
        }

        let fullInvoice = invoice;
        try {
          fullInvoice = await retrieveInvoiceWithLines(stripe, invoice.id);
        } catch (error: unknown) {
          console.warn(
            "[webhook] Could not refresh action-required invoice:",
            error instanceof Error ? error.message : String(error),
          );
        }

        await recordSubscriptionBillingRecovery(supabase, fullInvoice, {
          failureCode: "authentication_required",
          requiresAction: true,
        });
        await notifyUcatInvoicePaymentFailed(supabase, {
          stripeInvoiceId: invoice.id,
          failureCode: "authentication_required",
          nextPaymentAttemptAt: stripeTimestampToIso(
            fullInvoice.next_payment_attempt,
          ),
          requiresAction: true,
        });

        await supabase
          .from("stripe_webhook_events")
          .update({ processed: true, processed_at: new Date().toISOString() })
          .eq("stripe_event_id", event.id);
        return json({ received: true });
      }

      case "invoice.finalization_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const finalizationSync = await syncSubscriptionInvoiceFromStripe(
          supabase,
          stripe,
          invoice,
        );
        if (
          !finalizationSync.ok &&
          !("skipped" in finalizationSync && finalizationSync.skipped)
        ) {
          console.error(
            "[webhook] subscription invoice sync (finalization_failed):",
            finalizationSync,
          );
        }

        await notifyUcatInvoiceFinalizationFailed(supabase, {
          stripeInvoiceId: invoice.id,
          failureCode:
            invoice.last_finalization_error?.code ?? "finalization_failed",
        });

        await supabase
          .from("stripe_webhook_events")
          .update({ processed: true, processed_at: new Date().toISOString() })
          .eq("stripe_event_id", event.id);
        return json({ received: true });
      }

      case "invoice.payment_failed": {
        // CRITICAL: Invoice payment failed
        // For UCAT subscriptions: customer.subscription.updated will sync past_due status.
        // Configure Stripe Smart Retries + Customer emails in Dashboard for payment failure notifications.
        const invoice = event.data.object as Stripe.Invoice;

        const failSync = await syncSubscriptionInvoiceFromStripe(
          supabase,
          stripe,
          invoice.id,
        );
        if (!failSync.ok && !("skipped" in failSync && failSync.skipped)) {
          console.error(
            "[webhook] subscription invoice sync (payment_failed):",
            failSync,
          );
        }
        const failedSubscriptionContext = failSync.ok
          ? {
              studentId: failSync.studentId,
              stripeSubscriptionId: failSync.stripeSubscriptionId,
            }
          : null;

        let fullInvoice = invoice;
        try {
          fullInvoice = await retrieveInvoiceWithLines(stripe, invoice.id);
        } catch (error: unknown) {
          console.warn(
            "[webhook] Could not refresh failed invoice:",
            error instanceof Error ? error.message : String(error),
          );
        }

        const lastError = fullInvoice.last_payment_error;
        const failure_code = lastError?.code || "unknown_error";
        const failure_message = lastError?.message || "payment_failed";
        const requiresAction =
          failure_code === "authentication_required" ||
          failure_code === "invoice_payment_intent_requires_action";

        const { data: prevInv } = await supabase
          .from("invoices")
          .select("metadata")
          .eq("stripe_invoice_id", invoice.id)
          .is("deleted_at", null)
          .maybeSingle();

        const prevMeta =
          prevInv?.metadata &&
          typeof prevInv.metadata === "object" &&
          !Array.isArray(prevInv.metadata)
            ? (prevInv.metadata as Record<string, unknown>)
            : {};

        // Update invoice status (remains 'open' for retries)
        // Store failure details in metadata (merge so we do not wipe other keys)
        const { error: updErr } = await supabase
          .from("invoices")
          .update({
            // Status remains 'open' for Stripe's automatic retries
            metadata: {
              ...prevMeta,
              last_payment_error: {
                code: failure_code,
                message: failure_message,
                type: lastError?.type || "card_error",
              },
              last_failure_at: new Date().toISOString(),
            },
          })
          .eq("stripe_invoice_id", invoice.id)
          .is("deleted_at", null);

        if (updErr)
          console.error("[webhook] invoices fail update error", updErr);

        await recordSubscriptionBillingRecovery(supabase, fullInvoice, {
          failureCode: failure_code,
          requiresAction,
        });

        await notifyUcatInvoicePaymentFailed(supabase, {
          stripeInvoiceId: invoice.id,
          failureCode: failure_code,
          nextPaymentAttemptAt: stripeTimestampToIso(
            fullInvoice.next_payment_attempt,
          ),
          requiresAction,
        });

        if (failedSubscriptionContext) {
          const { data: subscriptionRow } = await supabase
            .from("student_subscriptions")
            .select("plan_tier, billing_interval")
            .eq(
              "stripe_subscription_id",
              failedSubscriptionContext.stripeSubscriptionId,
            )
            .maybeSingle();
          await captureUcatSubscriptionPosthogEvent(supabase, {
            eventName: "payment_failed",
            providerEventId: event.id,
            occurredAt: new Date(event.created * 1000).toISOString(),
            studentId: failedSubscriptionContext.studentId,
            properties: {
              stripe_subscription_id:
                failedSubscriptionContext.stripeSubscriptionId,
              stripe_invoice_id: invoice.id,
              plan_tier: subscriptionRow?.plan_tier ?? null,
              billing_interval: subscriptionRow?.billing_interval ?? null,
              billing_reason: fullInvoice.billing_reason ?? null,
              amount_due_cents: fullInvoice.amount_due ?? 0,
              currency: fullInvoice.currency ?? null,
              attempt_count: fullInvoice.attempt_count ?? 0,
              failure_code,
              requires_action: requiresAction,
              next_payment_attempt_at: stripeTimestampToIso(
                fullInvoice.next_payment_attempt,
              ),
            },
          });
        }

        await supabase
          .from("stripe_webhook_events")
          .update({ processed: true, processed_at: new Date().toISOString() })
          .eq("stripe_event_id", event.id);
        return json({ received: true });
      }

      case "invoice.updated": {
        // MEDIUM: Handle status changes, updates to amounts, etc.
        const invoice = event.data.object as Stripe.Invoice;

        // Check current invoice status before updating
        // Don't downgrade status from 'paid' to lower statuses (e.g., 'open')
        const { data: currentInvoice } = await supabase
          .from("invoices")
          .select("status")
          .eq("stripe_invoice_id", invoice.id)
          .is("deleted_at", null)
          .maybeSingle();

        // Fetch full invoice from Stripe API to get reliable subtotal/total values
        // Webhook payloads may not include these fields or may have them as null
        let fullInvoice: Stripe.Invoice | null = null;
        try {
          fullInvoice = await retrieveInvoiceWithLines(stripe, invoice.id);
          const updSync = await syncSubscriptionInvoiceFromStripe(
            supabase,
            stripe,
            fullInvoice,
          );
          if (!updSync.ok && !("skipped" in updSync && updSync.skipped)) {
            console.error(
              "[webhook] subscription invoice sync (updated):",
              updSync,
            );
          }
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : String(e);
          console.error(
            "[webhook] Error fetching invoice from Stripe for invoice.updated:",
            msg,
          );
          // Continue with webhook payload if fetch fails
        }

        // Calculate amount paid from customer balance
        // Use fullInvoice if available (has reliable subtotal/total), otherwise fall back to webhook payload
        const invoiceForAmounts = fullInvoice || invoice;
        const subtotalCents = invoiceForAmounts.subtotal ?? null;
        const totalCents = invoiceForAmounts.total ?? null;
        const amountDueCents = invoiceForAmounts.amount_due ?? 0;
        const amountPaidFromBalanceCents =
          totalCents !== null ? Math.max(0, totalCents - amountDueCents) : null;

        const updateData: Record<string, unknown> = {
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
        if (currentInvoice?.status === "paid" && invoice.status !== "paid") {
          // Don't overwrite 'paid' status with lower status
          console.log(
            "[webhook] Skipping status update from paid to",
            invoice.status,
            "for invoice:",
            invoice.id,
          );
        } else {
          // Safe to update status
          updateData.status = invoice.status;
        }

        await supabase
          .from("invoices")
          .update(updateData)
          .eq("stripe_invoice_id", invoice.id)
          .is("deleted_at", null);

        await updateSubscriptionBillingRetryTime(
          supabase,
          fullInvoice ?? invoice,
        );

        await supabase
          .from("stripe_webhook_events")
          .update({ processed: true, processed_at: new Date().toISOString() })
          .eq("stripe_event_id", event.id);
        return json({ received: true });
      }

      case "invoice.voided": {
        const invoice = event.data.object as { id: string };

        await requeueReferralReward(supabase, invoice.id);

        await supabase
          .from("invoices")
          .update({ status: "void" })
          .eq("stripe_invoice_id", invoice.id)
          .is("deleted_at", null);

        await supabase
          .from("stripe_webhook_events")
          .update({ processed: true, processed_at: new Date().toISOString() })
          .eq("stripe_event_id", event.id);
        return json({ received: true });
      }

      case "invoice.marked_uncollectible": {
        const invoice = event.data.object as { id: string };

        await requeueReferralReward(supabase, invoice.id);

        await supabase
          .from("invoices")
          .update({ status: "uncollectible" })
          .eq("stripe_invoice_id", invoice.id)
          .is("deleted_at", null);

        await supabase
          .from("stripe_webhook_events")
          .update({ processed: true, processed_at: new Date().toISOString() })
          .eq("stripe_event_id", event.id);
        return json({ received: true });
      }

      case "checkout.session.completed": {
        // UCAT subscription: provision access when checkout completes
        const session = event.data.object as {
          id: string;
          mode?: string;
          subscription?: string;
          customer?: string;
          customer_email?: string;
          payment_status?: string;
          amount_total?: number | null;
          currency?: string | null;
          metadata?: {
            student_id?: string;
            ucat_plan_tier?: string;
            ucat_billing_interval?: string;
            ucat_checkout_context?: string;
            ucat_acquisition_benefit?: string;
            ucat_standard_trial_days?: string;
            ucat_referral_gift_id?: string;
            ucat_referral_gift_kind?: string;
          };
        };

        if (session.mode !== "subscription" || !session.subscription) {
          await supabase
            .from("stripe_webhook_events")
            .update({ processed: true, processed_at: new Date().toISOString() })
            .eq("stripe_event_id", event.id);
          return json({ received: true });
        }

        const studentId = session.metadata?.student_id;
        if (!studentId) {
          console.warn(
            "[webhook] checkout.session.completed: missing student_id in metadata",
          );
          await supabase
            .from("stripe_webhook_events")
            .update({ processed: true, processed_at: new Date().toISOString() })
            .eq("stripe_event_id", event.id);
          return json({ received: true });
        }

        try {
          const ucatSubjectId = await getUcatSubjectId(supabase);
          if (!ucatSubjectId) {
            console.warn(
              "[webhook] checkout.session.completed: UCAT subject not found",
            );
          } else {
            const subscription = await stripe.subscriptions.retrieve(
              session.subscription,
              {
                expand: ["items.data.price", "default_payment_method"],
              },
            );
            const price = subscription.items?.data?.[0]?.price;
            const priceId =
              price && typeof price === "object" && "id" in price
                ? price.id
                : null;
            const productRaw =
              price && typeof price === "object" && "product" in price
                ? price.product
                : null;
            const productId =
              typeof productRaw === "string"
                ? productRaw
                : productRaw &&
                    typeof productRaw === "object" &&
                    "id" in productRaw
                  ? (productRaw as { id: string }).id
                  : null;

            // Ensure students_billing exists (Checkout may have created new customer)
            const customerId = session.customer as string;
            if (customerId) {
              await supabase.from("students_billing").upsert(
                {
                  student_id: studentId,
                  stripe_customer_id: customerId,
                },
                { onConflict: "student_id" },
              );
            }

            const planFields = await resolveUcatPlanFields(
              supabase,
              priceId,
              productId,
              {
                ...(session.metadata ?? {}),
                ...(subscription.metadata ?? {}),
              },
            );

            const { error: subscriptionUpsertError } = await supabase
              .from("student_subscriptions")
              .upsert(
                {
                  student_id: studentId,
                  subject_id: ucatSubjectId,
                  stripe_subscription_id: subscription.id,
                  stripe_price_id: priceId,
                  stripe_product_id: productId,
                  plan_tier: planFields.plan_tier,
                  billing_interval: planFields.billing_interval,
                  status: subscription.status,
                  ...subscriptionPeriodFields(subscription),
                  ...subscriptionCancelFields(subscription),
                  updated_at: new Date().toISOString(),
                },
                { onConflict: "student_id,subject_id" },
              );
            if (subscriptionUpsertError) throw subscriptionUpsertError;

            if (ACTIVE_SUBSCRIPTION_STATUSES.has(subscription.status)) {
              await resolveUcatBillingAccessEndedNotificationsForStudent(
                supabase,
                studentId,
              );
            }

            const referralGiftKind =
              session.metadata?.ucat_referral_gift_kind ??
              subscription.metadata?.ucat_referral_gift_kind;
            const referralGiftId =
              session.metadata?.ucat_referral_gift_id ??
              subscription.metadata?.ucat_referral_gift_id;
            let activationAllowed = true;

            if (referralGiftKind === "recipient" && customerId) {
              const defaultPaymentMethod = subscription.default_payment_method;
              const paymentMethodId =
                typeof defaultPaymentMethod === "string"
                  ? defaultPaymentMethod
                  : (defaultPaymentMethod?.id ?? null);
              const fingerprint = await resolveCustomerCardFingerprint(
                stripe,
                customerId,
                paymentMethodId,
              );
              const referralResult = await maybeQualifyPaidUcatReferral({
                supabase,
                stripe,
                referredStudentId: studentId,
                checkoutSessionId: session.id,
                subscriptionId: subscription.id,
                customerId,
                currentFingerprint: fingerprint,
              });
              console.log(
                "[webhook] UCAT referral gift result",
                referralResult,
                "for student",
                studentId,
              );
              if (referralResult === "rejected") {
                activationAllowed = false;
                await stripe.subscriptions.cancel(subscription.id, {
                  prorate: false,
                });
              }
            } else if (
              referralGiftKind === "earned_referrer" &&
              referralGiftId
            ) {
              const now = new Date().toISOString();
              const { error: giftUseError } = await supabase
                .from("ucat_referral_access_gifts")
                .update({
                  status: "used",
                  stripe_checkout_session_id: session.id,
                  stripe_subscription_id: subscription.id,
                  used_at: now,
                  updated_at: now,
                })
                .eq("id", referralGiftId)
                .eq("student_id", studentId)
                .eq("status", "checkout_pending");
              if (giftUseError) throw giftUseError;

              await supabase
                .from("notifications")
                .update({ resolved_at: now, updated_at: now })
                .eq(
                  "dedupe_key",
                  `ucat:referral:access-gift:${referralGiftId}`,
                )
                .is("resolved_at", null);
            }
            const rawContext = session.metadata?.ucat_checkout_context;
            const journeyContext =
              rawContext === "referral_gift"
                ? "subscribe"
                : rawContext === "signup_onboarding" ||
                    rawContext === "practice_session" ||
                    rawContext === "subscribe"
                  ? rawContext
                  : "subscribe";
            if (activationAllowed) {
              await captureUcatSubscriptionPosthogEvent(supabase, {
                eventName: "subscription_started",
                providerEventId: event.id,
                occurredAt: new Date(event.created * 1000).toISOString(),
                studentId,
                properties: {
                  stripe_subscription_id: subscription.id,
                  stripe_checkout_session_id: session.id,
                  plan_tier: planFields.plan_tier,
                  billing_interval: planFields.billing_interval,
                  subscription_status: subscription.status,
                  starts_with_trial: subscription.status === "trialing",
                  initial_payment_collected:
                    session.payment_status === "paid" &&
                    (session.amount_total ?? 0) > 0,
                  initial_amount_total_cents: session.amount_total ?? 0,
                  currency: session.currency ?? null,
                  journey_context: journeyContext,
                  acquisition_benefit:
                    session.metadata?.ucat_acquisition_benefit ??
                    subscription.metadata?.ucat_acquisition_benefit ??
                    (subscription.status === "trialing"
                      ? "standard_trial"
                      : "none"),
                },
              });
              await queueUcatTransactionalEmail(supabase, {
                studentId,
                template: "subscription_activated",
                eventKey: `stripe:${event.id}:subscription-activated`,
                payload: {
                  stripe_subscription_id: subscription.id,
                  trial_end: subscription.trial_end
                    ? new Date(subscription.trial_end * 1000).toISOString()
                    : null,
                },
              });
            }
            console.log(
              "[webhook] UCAT subscription provisioned for student",
              studentId,
            );
            await supabase.from("ucat_subscription_journey_events").insert({
              student_id: studentId,
              event_type: "checkout_completed",
              journey_context: journeyContext,
              plan_tier: planFields.plan_tier,
              billing_interval: planFields.billing_interval,
              trial_eligible: subscription.status === "trialing",
              stripe_checkout_session_id: session.id,
              metadata: {
                acquisition_benefit:
                  session.metadata?.ucat_acquisition_benefit ??
                  subscription.metadata?.ucat_acquisition_benefit ??
                  (subscription.status === "trialing"
                    ? "standard_trial"
                    : "none"),
                trial_days:
                  session.metadata?.ucat_standard_trial_days ??
                  subscription.metadata?.ucat_standard_trial_days ??
                  null,
              },
            });
          }
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : String(e);
          console.error(
            "[webhook] checkout.session.completed UCAT handler error:",
            msg,
          );
        }

        await supabase
          .from("stripe_webhook_events")
          .update({ processed: true, processed_at: new Date().toISOString() })
          .eq("stripe_event_id", event.id);
        return json({ received: true });
      }

      case "customer.subscription.trial_will_end": {
        const subscription = event.data.object as {
          id: string;
          trial_end?: number | null;
        };
        // Let delivery errors reach the outer handler. Returning a non-2xx
        // response keeps the event unprocessed so Stripe can retry it.
        await sendUcatTrialReminder(supabase, subscription);
        await supabase
          .from("stripe_webhook_events")
          .update({ processed: true, processed_at: new Date().toISOString() })
          .eq("stripe_event_id", event.id);
        return json({ received: true });
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as {
          id: string;
          status: string;
          current_period_start?: number;
          current_period_end?: number;
          cancel_at_period_end?: boolean;
          cancel_at?: number | null;
          items?: {
            data?: Array<{
              current_period_start?: number;
              current_period_end?: number;
              price?: { id?: string; product?: string | { id?: string } };
            }>;
          };
        };

        const { data: existing } = await supabase
          .from("student_subscriptions")
          .select(
            "id, student_id, subject_id, status, plan_tier, billing_interval, billing_recovery_invoice_id, cancel_at_period_end, cancel_at",
          )
          .eq("stripe_subscription_id", subscription.id)
          .maybeSingle();

        if (!existing) {
          await supabase
            .from("stripe_webhook_events")
            .update({ processed: true, processed_at: new Date().toISOString() })
            .eq("stripe_event_id", event.id);
          return json({ received: true });
        }

        const price = subscription.items?.data?.[0]?.price;
        const priceId =
          price && typeof price === "object" && "id" in price ? price.id : null;
        const productRaw =
          price && typeof price === "object" && "product" in price
            ? price.product
            : null;
        const productId =
          typeof productRaw === "string"
            ? productRaw
            : productRaw && typeof productRaw === "object" && "id" in productRaw
              ? (productRaw as { id: string }).id
              : null;

        const planFields = await resolveUcatPlanFields(
          supabase,
          priceId,
          productId,
          (subscription as { metadata?: Record<string, string> }).metadata ??
            null,
        );

        await supabase
          .from("student_subscriptions")
          .update({
            status: subscription.status,
            stripe_price_id: priceId,
            stripe_product_id: productId,
            plan_tier: planFields.plan_tier,
            billing_interval: planFields.billing_interval,
            ...subscriptionPeriodFields(subscription),
            ...subscriptionCancelFields(subscription),
            ...(subscription.status === "unpaid"
              ? {
                  billing_recovery_invoice_id: null,
                  billing_recovery_started_at: null,
                  billing_recovery_next_attempt_at: null,
                  billing_recovery_failure_code: null,
                  billing_recovery_requires_action: false,
                }
              : {}),
            updated_at: new Date().toISOString(),
          })
          .eq("stripe_subscription_id", subscription.id);

        const ucatSubjectId = await getUcatSubjectId(supabase);
        if (ucatSubjectId && existing.subject_id === ucatSubjectId) {
          const cancellation = subscriptionCancelFields(subscription);
          if (
            !existing.cancel_at_period_end &&
            cancellation.cancel_at_period_end &&
            cancellation.cancel_at
          ) {
            await queueUcatTransactionalEmail(supabase, {
              studentId: existing.student_id,
              template: "subscription_cancellation_scheduled",
              eventKey: `stripe:${event.id}:cancellation-scheduled`,
              payload: {
                stripe_subscription_id: subscription.id,
                cancel_at: cancellation.cancel_at,
              },
            });
            await captureUcatSubscriptionPosthogEvent(supabase, {
              eventName: "subscription_cancellation_scheduled",
              providerEventId: event.id,
              occurredAt: new Date(event.created * 1000).toISOString(),
              studentId: existing.student_id,
              properties: {
                stripe_subscription_id: subscription.id,
                plan_tier: planFields.plan_tier ?? existing.plan_tier,
                billing_interval:
                  planFields.billing_interval ?? existing.billing_interval,
                subscription_status: subscription.status,
                cancel_at: cancellation.cancel_at,
              },
            });
          } else if (
            existing.cancel_at_period_end &&
            !cancellation.cancel_at_period_end &&
            ACTIVE_SUBSCRIPTION_STATUSES.has(subscription.status)
          ) {
            await queueUcatTransactionalEmail(supabase, {
              studentId: existing.student_id,
              template: "subscription_cancellation_reversed",
              eventKey: `stripe:${event.id}:cancellation-reversed`,
              payload: { stripe_subscription_id: subscription.id },
            });
          }
        }

        if (
          subscription.status === "unpaid" &&
          (existing.status !== "unpaid" ||
            Boolean(existing.billing_recovery_invoice_id))
        ) {
          await handleUcatFailedBillingTerminalState(supabase, stripe, {
            studentId: existing.student_id,
            subjectId: existing.subject_id,
            stripeSubscriptionId: subscription.id,
            planTier: planFields.plan_tier ?? existing.plan_tier,
            wasInRecovery:
              existing.status === "past_due" ||
              Boolean(existing.billing_recovery_invoice_id),
          });
        }

        await supabase
          .from("stripe_webhook_events")
          .update({ processed: true, processed_at: new Date().toISOString() })
          .eq("stripe_event_id", event.id);
        return json({ received: true });
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as {
          id: string;
          cancellation_details?: { reason?: string | null } | null;
        };

        const { data: endedSub } = await supabase
          .from("student_subscriptions")
          .select(
            "student_id, subject_id, status, plan_tier, billing_interval, billing_recovery_invoice_id",
          )
          .eq("stripe_subscription_id", subscription.id)
          .maybeSingle();

        if (endedSub?.student_id) {
          const ucatSubjectId = await getUcatSubjectId(supabase);
          if (ucatSubjectId && endedSub.subject_id === ucatSubjectId) {
            const failedBillingCancellation =
              subscription.cancellation_details?.reason === "payment_failed" ||
              endedSub.status === "past_due" ||
              endedSub.status === "unpaid" ||
              Boolean(endedSub.billing_recovery_invoice_id);

            if (failedBillingCancellation) {
              await handleUcatFailedBillingTerminalState(supabase, stripe, {
                studentId: endedSub.student_id,
                subjectId: endedSub.subject_id,
                stripeSubscriptionId: subscription.id,
                planTier: endedSub.plan_tier,
                wasInRecovery: true,
              });
            } else {
              await forfeitPracticeDayCreditsForStudent(
                supabase,
                stripe,
                endedSub.student_id,
              );
              await queueUcatTransactionalEmail(supabase, {
                studentId: endedSub.student_id,
                template: "subscription_canceled",
                eventKey: `stripe:${event.id}:subscription-canceled`,
                payload: { stripe_subscription_id: subscription.id },
              });
            }
            await captureUcatSubscriptionPosthogEvent(supabase, {
              eventName: "subscription_cancelled",
              providerEventId: event.id,
              occurredAt: new Date(event.created * 1000).toISOString(),
              studentId: endedSub.student_id,
              properties: {
                stripe_subscription_id: subscription.id,
                plan_tier: endedSub.plan_tier,
                billing_interval: endedSub.billing_interval,
                previous_subscription_status: endedSub.status,
                cancellation_reason:
                  subscription.cancellation_details?.reason ?? null,
                failed_billing_cancellation: failedBillingCancellation,
              },
            });
          }
        }

        await supabase
          .from("student_subscriptions")
          .update({
            status: "canceled",
            cancel_at_period_end: false,
            cancel_at: new Date().toISOString(),
            billing_recovery_invoice_id: null,
            billing_recovery_started_at: null,
            billing_recovery_next_attempt_at: null,
            billing_recovery_failure_code: null,
            billing_recovery_requires_action: false,
            updated_at: new Date().toISOString(),
          })
          .eq("stripe_subscription_id", subscription.id);

        await supabase
          .from("stripe_webhook_events")
          .update({ processed: true, processed_at: new Date().toISOString() })
          .eq("stripe_event_id", event.id);
        return json({ received: true });
      }

      case "charge.dispute.created": {
        // CRITICAL: Update invoice dispute fields
        const dispute = event.data.object as {
          id: string;
          charge: string;
          status?: string;
          reason?: string;
          amount?: number;
          currency?: string;
          created?: number;
        };
        const chargeId = dispute.charge as string;

        // Find invoice by stripe_charge_id
        const { data: invoice, error: findErr } = await supabase
          .from("invoices")
          .select("id")
          .eq("stripe_charge_id", chargeId)
          .is("deleted_at", null)
          .maybeSingle();

        if (findErr) {
          console.error(
            "[webhook] Error finding invoice for dispute:",
            findErr,
          );
        } else if (invoice) {
          // Update invoice with dispute information
          const { error: updateErr } = await supabase
            .from("invoices")
            .update({
              status: "disputed",
              dispute_id: dispute.id,
              dispute_status: dispute.status,
              dispute_reason: dispute.reason,
              dispute_amount_cents: dispute.amount,
              dispute_currency: dispute.currency,
              dispute_created_at: new Date(
                dispute.created * 1000,
              ).toISOString(),
              dispute_updated_at: new Date().toISOString(),
            })
            .eq("id", invoice.id)
            .is("deleted_at", null);

          if (updateErr) {
            console.error(
              "[webhook] Error updating invoice with dispute:",
              updateErr,
            );
          } else {
            console.log(
              "[webhook] Dispute created for invoice:",
              invoice.id,
              "dispute:",
              dispute.id,
            );
          }
        } else {
          console.warn(
            "[webhook] No invoice found for dispute charge:",
            chargeId,
          );
        }

        await supabase
          .from("stripe_webhook_events")
          .update({ processed: true, processed_at: new Date().toISOString() })
          .eq("stripe_event_id", event.id);
        return json({ received: true });
      }

      case "charge.dispute.updated": {
        // CRITICAL: Update invoice dispute status
        const dispute = event.data.object as {
          charge: string;
          status?: string;
          reason?: string;
          amount?: number;
        };
        const chargeId = dispute.charge as string;

        // Find invoice by stripe_charge_id
        const { data: invoice, error: findErr } = await supabase
          .from("invoices")
          .select("id")
          .eq("stripe_charge_id", chargeId)
          .is("deleted_at", null)
          .maybeSingle();

        if (findErr) {
          console.error(
            "[webhook] Error finding invoice for dispute update:",
            findErr,
          );
        } else if (invoice) {
          // Update dispute details
          const { error: updateErr } = await supabase
            .from("invoices")
            .update({
              dispute_status: dispute.status,
              dispute_reason: dispute.reason,
              dispute_amount_cents: dispute.amount,
              dispute_updated_at: new Date().toISOString(),
            })
            .eq("id", invoice.id)
            .is("deleted_at", null);

          if (updateErr) {
            console.error("[webhook] Error updating dispute:", updateErr);
          } else {
            console.log("[webhook] Dispute updated for invoice:", invoice.id);
          }
        } else {
          console.warn(
            "[webhook] No invoice found for dispute update charge:",
            chargeId,
          );
        }

        await supabase
          .from("stripe_webhook_events")
          .update({ processed: true, processed_at: new Date().toISOString() })
          .eq("stripe_event_id", event.id);
        return json({ received: true });
      }

      case "charge.dispute.closed": {
        // CRITICAL: Update invoice dispute status, set dispute_resolved_at
        const dispute = event.data.object as { charge: string; status: string };
        const chargeId = dispute.charge as string;

        // Find invoice by stripe_charge_id
        const { data: invoice, error: findErr } = await supabase
          .from("invoices")
          .select("id, status")
          .eq("stripe_charge_id", chargeId)
          .is("deleted_at", null)
          .maybeSingle();

        if (findErr) {
          console.error(
            "[webhook] Error finding invoice for dispute closure:",
            findErr,
          );
        } else if (invoice) {
          const disputeStatus = dispute.status; // 'won' or 'lost'
          const resolvedAt = new Date().toISOString();

          const updateData: Record<string, unknown> = {
            dispute_status: disputeStatus,
            dispute_resolved_at: resolvedAt,
            dispute_updated_at: resolvedAt,
          };

          // If dispute was won, restore invoice to paid status
          // If lost, keep as disputed
          if (disputeStatus === "won") {
            updateData.status = "paid";
            console.log(
              "[webhook] Dispute won - restoring invoice to paid:",
              invoice.id,
            );
          } else if (disputeStatus === "lost") {
            // Keep status as 'disputed' - the dispute was lost
            console.log(
              "[webhook] Dispute lost - keeping status as disputed:",
              invoice.id,
            );
          }

          const { error: updateErr } = await supabase
            .from("invoices")
            .update(updateData)
            .eq("id", invoice.id)
            .is("deleted_at", null);

          if (updateErr) {
            console.error(
              "[webhook] Error updating dispute closure:",
              updateErr,
            );
          } else {
            console.log(
              "[webhook] Dispute closed for invoice:",
              invoice.id,
              "result:",
              disputeStatus,
            );
          }
        } else {
          console.warn(
            "[webhook] No invoice found for dispute closure charge:",
            chargeId,
          );
        }

        await supabase
          .from("stripe_webhook_events")
          .update({ processed: true, processed_at: new Date().toISOString() })
          .eq("stripe_event_id", event.id);
        return json({ received: true });
      }

      case "credit_note.created": {
        // HIGH: Create or update credit_notes record (upsert: API may have already inserted).
        // Stripe does NOT send payment_refund_amount/credit_amount in webhook; use refund/refunds and customer_balance_transaction.
        const creditNote = event.data.object as {
          id: string;
          invoice: string;
          amount?: number;
          currency?: string;
          reason?: string;
          status?: string;
          metadata?: Record<string, unknown>;
          refund?: string | null;
          refunds?: Array<{ amount_refunded?: number }> | null;
          customer_balance_transaction?: string | null;
          out_of_band_amount?: number | null;
        };
        const invoiceId = creditNote.invoice as string;
        const totalCents = creditNote.amount ?? 0;
        const hasRefund =
          Boolean(creditNote.refund) ||
          (Array.isArray(creditNote.refunds) && creditNote.refunds.length > 0);
        const refundCents = hasRefund
          ? (creditNote.refunds?.[0]?.amount_refunded ?? totalCents)
          : null;
        const creditCents = creditNote.customer_balance_transaction
          ? totalCents
          : null;
        const outOfBandCents =
          typeof creditNote.out_of_band_amount === "number"
            ? creditNote.out_of_band_amount
            : null;

        const { data: invoice, error: findErr } = await supabase
          .from("invoices")
          .select("id")
          .eq("stripe_invoice_id", invoiceId)
          .is("deleted_at", null)
          .maybeSingle();

        if (findErr) {
          console.error(
            "[webhook] Error finding invoice for credit note:",
            findErr,
          );
        } else if (invoice) {
          const { error: upsertErr } = await supabase
            .from("credit_notes")
            .upsert(
              {
                invoice_id: invoice.id,
                stripe_credit_note_id: creditNote.id,
                amount_cents: totalCents,
                currency: creditNote.currency ?? "aud",
                reason: creditNote.reason ?? null,
                status: creditNote.status ?? "issued",
                metadata: creditNote.metadata ?? {},
                refund_amount_cents: refundCents,
                credit_amount_cents: creditCents,
                out_of_band_amount_cents: outOfBandCents,
              },
              { onConflict: "stripe_credit_note_id" },
            );

          if (upsertErr) {
            console.error("[webhook] Error upserting credit note:", upsertErr);
          } else {
            console.log(
              "[webhook] Credit note synced:",
              creditNote.id,
              "for invoice:",
              invoice.id,
            );
            // Keep invoice.has_credit_notes in sync for "Paid (Refunded)" display
            const { data: nonVoid } = await supabase
              .from("credit_notes")
              .select("id")
              .eq("invoice_id", invoice.id)
              .neq("status", "void")
              .limit(1);
            await supabase
              .from("invoices")
              .update({ has_credit_notes: (nonVoid?.length ?? 0) > 0 })
              .eq("id", invoice.id)
              .is("deleted_at", null);
          }
        } else {
          console.warn(
            "[webhook] No invoice found for credit note:",
            invoiceId,
          );
        }

        await supabase
          .from("stripe_webhook_events")
          .update({ processed: true, processed_at: new Date().toISOString() })
          .eq("stripe_event_id", event.id);
        return json({ received: true });
      }

      case "credit_note.updated": {
        // HIGH: Update credit_notes status and settlement breakdown (same field mapping as created).
        const creditNote = event.data.object as {
          id: string;
          invoice?: string;
          status?: string;
          reason?: string;
          amount?: number;
          refund?: string | null;
          refunds?: Array<{ amount_refunded?: number }> | null;
          customer_balance_transaction?: string | null;
          out_of_band_amount?: number | null;
        };
        const totalCents = creditNote.amount ?? null;
        const hasRefund =
          Boolean(creditNote.refund) ||
          (Array.isArray(creditNote.refunds) && creditNote.refunds.length > 0);
        const refundCents =
          hasRefund && totalCents != null
            ? (creditNote.refunds?.[0]?.amount_refunded ?? totalCents)
            : null;
        const creditCents =
          creditNote.customer_balance_transaction && totalCents != null
            ? totalCents
            : null;
        const outOfBandCents =
          typeof creditNote.out_of_band_amount === "number"
            ? creditNote.out_of_band_amount
            : null;

        const { data: existing } = await supabase
          .from("credit_notes")
          .select("invoice_id")
          .eq("stripe_credit_note_id", creditNote.id)
          .maybeSingle();

        await supabase
          .from("credit_notes")
          .update({
            status: creditNote.status,
            reason: creditNote.reason,
            refund_amount_cents: refundCents,
            credit_amount_cents: creditCents,
            out_of_band_amount_cents: outOfBandCents,
            updated_at: new Date().toISOString(),
          })
          .eq("stripe_credit_note_id", creditNote.id);

        if (existing?.invoice_id) {
          const { data: nonVoid } = await supabase
            .from("credit_notes")
            .select("id")
            .eq("invoice_id", existing.invoice_id)
            .neq("status", "void")
            .limit(1);
          await supabase
            .from("invoices")
            .update({ has_credit_notes: (nonVoid?.length ?? 0) > 0 })
            .eq("id", existing.invoice_id)
            .is("deleted_at", null);
        }

        await supabase
          .from("stripe_webhook_events")
          .update({ processed: true, processed_at: new Date().toISOString() })
          .eq("stripe_event_id", event.id);
        return json({ received: true });
      }

      case "credit_note.voided": {
        // HIGH: Update credit_notes status to 'void'
        const creditNote = event.data.object as { id: string };

        const { data: existing } = await supabase
          .from("credit_notes")
          .select("invoice_id")
          .eq("stripe_credit_note_id", creditNote.id)
          .maybeSingle();

        await supabase
          .from("credit_notes")
          .update({
            status: "void",
            voided_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("stripe_credit_note_id", creditNote.id);

        if (existing?.invoice_id) {
          const { data: nonVoid } = await supabase
            .from("credit_notes")
            .select("id")
            .eq("invoice_id", existing.invoice_id)
            .neq("status", "void")
            .limit(1);
          await supabase
            .from("invoices")
            .update({ has_credit_notes: (nonVoid?.length ?? 0) > 0 })
            .eq("id", existing.invoice_id)
            .is("deleted_at", null);
        }

        await supabase
          .from("stripe_webhook_events")
          .update({ processed: true, processed_at: new Date().toISOString() })
          .eq("stripe_event_id", event.id);
        return json({ received: true });
      }

      case "charge.refunded": {
        // HIGH: Track direct charge refunds (not via credit notes)
        const charge = event.data.object as { id: string };
        const chargeId = charge.id;

        // Find invoice by stripe_charge_id
        const { data: invoice, error: findErr } = await supabase
          .from("invoices")
          .select("id")
          .eq("stripe_charge_id", chargeId)
          .is("deleted_at", null)
          .maybeSingle();

        if (findErr) {
          console.error(
            "[webhook] Error finding invoice for refunded charge:",
            findErr,
          );
        } else if (invoice) {
          const { error: updateErr } = await supabase
            .from("invoices")
            .update({
              is_refunded: true,
              refunded_at: new Date().toISOString(),
            })
            .eq("id", invoice.id)
            .is("deleted_at", null);

          if (updateErr) {
            console.error(
              "[webhook] Error updating invoice refund status:",
              updateErr,
            );
          } else {
            console.log(
              "[webhook] Charge refunded for invoice:",
              invoice.id,
              "charge:",
              chargeId,
            );
          }
        } else {
          // Charge refunded but no invoice found - this is okay, might be a standalone charge
          console.log(
            "[webhook] Charge refunded but no invoice found:",
            chargeId,
          );
        }

        await supabase
          .from("stripe_webhook_events")
          .update({ processed: true, processed_at: new Date().toISOString() })
          .eq("stripe_event_id", event.id);
        return json({ received: true });
      }

      case "customer.source.expiring": {
        const source = event.data.object as {
          id: string;
          exp_month?: number;
          exp_year?: number;
          last4?: string;
        };
        const paymentMethodId = source.id;

        try {
          // Get student info for SMS notification
          const { data: pm } = await supabase
            .from("student_payment_methods")
            .select("student_id, is_default")
            .eq("stripe_payment_method_id", paymentMethodId)
            .maybeSingle();

          if (!pm || !pm.is_default) {
            await supabase
              .from("stripe_webhook_events")
              .update({
                processed: true,
                processed_at: new Date().toISOString(),
              })
              .eq("stripe_event_id", event.id);
            return json({ received: true });
          }

          // Get student's contact info
          const { data: contact } = await supabase
            .from("contacts")
            .select("id, phone_e164")
            .eq("student_id", pm.student_id)
            .maybeSingle();

          if (!contact?.phone_e164) {
            await supabase
              .from("stripe_webhook_events")
              .update({
                processed: true,
                processed_at: new Date().toISOString(),
              })
              .eq("stripe_event_id", event.id);
            return json({ received: true });
          }

          // Get owned number for SMS
          const { data: ownedNum } = await supabase
            .from("owned_numbers")
            .select("id")
            .eq("is_default", true)
            .maybeSingle();

          if (!ownedNum) {
            await supabase
              .from("stripe_webhook_events")
              .update({
                processed: true,
                processed_at: new Date().toISOString(),
              })
              .eq("stripe_event_id", event.id);
            return json({ received: true });
          }

          // Find or create conversation
          let convoId: string | undefined;
          const { data: existing } = await supabase
            .from("conversations")
            .select("id")
            .eq("contact_id", contact.id)
            .eq("owned_number_id", ownedNum.id)
            .maybeSingle();

          if (existing) {
            convoId = existing.id;
          } else {
            const { data: newConvo } = await supabase
              .from("conversations")
              .insert({
                contact_id: contact.id,
                owned_number_id: ownedNum.id,
                status: "OPEN",
              })
              .select("id")
              .single();
            convoId = newConvo?.id;
          }

          if (!convoId) {
            await supabase
              .from("stripe_webhook_events")
              .update({
                processed: true,
                processed_at: new Date().toISOString(),
              })
              .eq("stripe_event_id", event.id);
            return json({ received: true });
          }

          // Queue SMS
          const expMonth = source.exp_month;
          const expYear = source.exp_year;
          const body = `Your payment card ending in ${source.last4} expires ${expMonth}/${expYear}. Please update your payment method in the student portal to avoid payment issues.`;

          await supabase.from("messages").insert({
            conversation_id: convoId,
            body,
            direction: "OUTGOING",
            status: "QUEUED",
          });

          console.log(
            "[webhook] Card expiry SMS queued for student",
            pm.student_id,
          );
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : String(e);
          console.error(
            "[webhook] customer.source.expiring handler error",
            msg,
          );
        }

        await supabase
          .from("stripe_webhook_events")
          .update({ processed: true, processed_at: new Date().toISOString() })
          .eq("stripe_event_id", event.id);
        return json({ received: true });
      }

      default:
        // Mark event as processed for unknown/unhandled event types
        await supabase
          .from("stripe_webhook_events")
          .update({ processed: true, processed_at: new Date().toISOString() })
          .eq("stripe_event_id", event.id);
        return json({ received: true });
    }
  } catch (e: unknown) {
    sentry.captureException(e);
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[webhook] handler error", msg);

    // Log error to webhook events table
    await supabase
      .from("stripe_webhook_events")
      .update({ error_message: String(msg) })
      .eq("stripe_event_id", event.id);

    return json({ error: "handler_error" }, 500);
  }
});
