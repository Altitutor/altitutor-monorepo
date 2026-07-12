import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import type Stripe from "npm:stripe@16.6.0";

function stripeObjectId(
  value: string | { id?: string } | null | undefined,
): string | null {
  if (typeof value === "string") return value;
  return value?.id ?? null;
}

export function getInvoiceSubscriptionId(
  invoice: Pick<Stripe.Invoice, "subscription">,
): string | null {
  return stripeObjectId(invoice.subscription);
}

export function stripeTimestampToIso(
  timestamp: number | null | undefined,
): string | null {
  return timestamp == null ? null : new Date(timestamp * 1000).toISOString();
}

export async function recordSubscriptionBillingRecovery(
  supabase: SupabaseClient,
  invoice: Stripe.Invoice,
  input: { failureCode: string; requiresAction: boolean },
): Promise<void> {
  const subscriptionId = getInvoiceSubscriptionId(invoice);
  if (!subscriptionId) return;

  const { data: current, error: currentError } = await supabase
    .from("student_subscriptions")
    .select("billing_recovery_invoice_id, billing_recovery_started_at")
    .eq("stripe_subscription_id", subscriptionId)
    .maybeSingle();

  if (currentError) {
    console.warn(
      "[webhook] Failed to load billing recovery state",
      currentError,
    );
    return;
  }
  if (!current) return;

  const sameInvoice = current.billing_recovery_invoice_id === invoice.id;
  const { error } = await supabase
    .from("student_subscriptions")
    .update({
      billing_recovery_invoice_id: invoice.id,
      billing_recovery_started_at:
        sameInvoice && current.billing_recovery_started_at
          ? current.billing_recovery_started_at
          : new Date().toISOString(),
      billing_recovery_next_attempt_at: stripeTimestampToIso(
        invoice.next_payment_attempt,
      ),
      billing_recovery_failure_code: input.failureCode,
      billing_recovery_requires_action: input.requiresAction,
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_subscription_id", subscriptionId);

  if (error) {
    console.warn("[webhook] Failed to record billing recovery state", error);
  }
}

export async function updateSubscriptionBillingRetryTime(
  supabase: SupabaseClient,
  invoice: Stripe.Invoice,
): Promise<void> {
  const subscriptionId = getInvoiceSubscriptionId(invoice);
  if (!subscriptionId) return;

  const { error } = await supabase
    .from("student_subscriptions")
    .update({
      billing_recovery_next_attempt_at: stripeTimestampToIso(
        invoice.next_payment_attempt,
      ),
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_subscription_id", subscriptionId)
    .eq("billing_recovery_invoice_id", invoice.id);

  if (error) {
    console.warn("[webhook] Failed to update billing retry time", error);
  }
}

export async function clearSubscriptionBillingRecovery(
  supabase: SupabaseClient,
  stripeInvoiceId: string,
): Promise<void> {
  const { error } = await supabase
    .from("student_subscriptions")
    .update({
      billing_recovery_invoice_id: null,
      billing_recovery_started_at: null,
      billing_recovery_next_attempt_at: null,
      billing_recovery_failure_code: null,
      billing_recovery_requires_action: false,
      updated_at: new Date().toISOString(),
    })
    .eq("billing_recovery_invoice_id", stripeInvoiceId);

  if (error) {
    console.warn("[webhook] Failed to clear billing recovery state", error);
  }
}
