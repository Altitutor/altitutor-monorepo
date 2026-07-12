import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import type Stripe from "npm:stripe@16.6.0";

const REFERRAL_COUPON_ID = "ucat-referral-next-bill-free";

type CardLike = { fingerprint?: string | null };

function paymentMethodFingerprint(
  paymentMethod: Stripe.PaymentMethod,
): string | null {
  const card = (paymentMethod as Stripe.PaymentMethod & { card?: CardLike })
    .card;
  return card?.fingerprint?.trim() || null;
}

async function customerCardFingerprints(
  stripe: Stripe,
  customerId: string,
): Promise<Set<string>> {
  const methods = await stripe.paymentMethods.list({
    customer: customerId,
    type: "card",
    limit: 100,
  });
  return new Set(
    methods.data
      .map(paymentMethodFingerprint)
      .filter((value): value is string => Boolean(value)),
  );
}

export async function resolveCustomerCardFingerprint(
  stripe: Stripe,
  customerId: string,
  paymentMethodId?: string | null,
): Promise<string | null> {
  if (paymentMethodId) {
    const method = await stripe.paymentMethods.retrieve(paymentMethodId);
    const fingerprint = paymentMethodFingerprint(method);
    if (fingerprint) return fingerprint;
  }

  const fingerprints = await customerCardFingerprints(stripe, customerId);
  return fingerprints.values().next().value ?? null;
}

export async function maybeQualifyPaidUcatReferral(args: {
  supabase: SupabaseClient;
  stripe: Stripe;
  referredStudentId: string;
  checkoutSessionId?: string | null;
  subscriptionId: string;
  customerId: string;
  currentFingerprint?: string | null;
}): Promise<"qualified" | "rejected" | "pending" | "not_referred"> {
  const {
    supabase,
    stripe,
    referredStudentId,
    checkoutSessionId,
    subscriptionId,
    customerId,
  } = args;

  const { data: referral } = await supabase
    .from("ucat_referrals")
    .select("id, referrer_student_id, paid_qualified_at, rejected_at")
    .eq("referred_student_id", referredStudentId)
    .maybeSingle();

  if (!referral) return "not_referred";
  if (referral.rejected_at) return "rejected";
  if (referral.paid_qualified_at) return "qualified";

  let fingerprint = args.currentFingerprint ?? null;
  if (!fingerprint) {
    try {
      fingerprint = await resolveCustomerCardFingerprint(stripe, customerId);
    } catch (error: unknown) {
      console.warn(
        "[webhook] Could not resolve referred card fingerprint:",
        error instanceof Error ? error.message : String(error),
      );
      return "pending";
    }
  }
  if (!fingerprint) return "pending";

  const { data: referrerBilling } = await supabase
    .from("students_billing")
    .select("stripe_customer_id")
    .eq("student_id", referral.referrer_student_id)
    .maybeSingle();

  if (referrerBilling?.stripe_customer_id) {
    try {
      if (referrerBilling.stripe_customer_id === customerId) {
        await rejectReferral(supabase, referral.id, "same_stripe_customer");
        return "rejected";
      }
      const referrerFingerprints = await customerCardFingerprints(
        stripe,
        referrerBilling.stripe_customer_id,
      );
      if (referrerFingerprints.has(fingerprint)) {
        await rejectReferral(supabase, referral.id, "same_payment_fingerprint");
        return "rejected";
      }
    } catch (error: unknown) {
      console.warn(
        "[webhook] Could not compare referrer card fingerprints:",
        error instanceof Error ? error.message : String(error),
      );
      return "pending";
    }
  }

  const { data, error } = await supabase.rpc("qualify_ucat_paid_referral", {
    p_referred_student_id: referredStudentId,
    p_checkout_session_id: checkoutSessionId ?? "",
    p_subscription_id: subscriptionId,
  });
  if (error) throw error;
  return data ? "qualified" : "not_referred";
}

async function rejectReferral(
  supabase: SupabaseClient,
  referralId: string,
  reason: string,
): Promise<void> {
  const { error } = await supabase
    .from("ucat_referrals")
    .update({
      rejected_at: new Date().toISOString(),
      rejection_reason: reason,
      updated_at: new Date().toISOString(),
    })
    .eq("id", referralId)
    .is("paid_qualified_at", null)
    .is("rejected_at", null);
  if (error) throw error;
}

async function getOrCreateReferralCoupon(
  stripe: Stripe,
): Promise<Stripe.Coupon> {
  try {
    return await stripe.coupons.retrieve(REFERRAL_COUPON_ID);
  } catch (error: unknown) {
    const stripeError = error as { code?: string; statusCode?: number };
    if (
      stripeError.code !== "resource_missing" &&
      stripeError.statusCode !== 404
    ) {
      throw error;
    }
  }

  try {
    return await stripe.coupons.create({
      id: REFERRAL_COUPON_ID,
      name: "Referral reward — next bill free",
      percent_off: 100,
      duration: "once",
      metadata: { source: "ucat_referral" },
    });
  } catch (error: unknown) {
    // Concurrent webhook deliveries can both try to create the stable coupon.
    const stripeError = error as { code?: string };
    if (stripeError.code === "resource_already_exists") {
      return stripe.coupons.retrieve(REFERRAL_COUPON_ID);
    }
    throw error;
  }
}

function stripeId(
  value: string | { id?: string } | null | undefined,
): string | null {
  if (!value) return null;
  return typeof value === "string" ? value : (value.id ?? null);
}

export async function applyQueuedReferralRewardToInvoice(args: {
  supabase: SupabaseClient;
  stripe: Stripe;
  invoice: Stripe.Invoice;
}): Promise<boolean> {
  const { supabase, stripe, invoice } = args;
  const subscriptionId = stripeId(invoice.subscription);
  if (!subscriptionId || invoice.billing_reason !== "subscription_cycle") {
    return false;
  }

  const [{ data: subscription }, { data: ucatSubject }] = await Promise.all([
    supabase
      .from("student_subscriptions")
      .select("student_id, subject_id")
      .eq("stripe_subscription_id", subscriptionId)
      .maybeSingle(),
    supabase.from("subjects").select("id").eq("name", "UCAT").maybeSingle(),
  ]);
  if (
    !subscription?.student_id ||
    !ucatSubject?.id ||
    subscription.subject_id !== ucatSubject.id
  ) {
    return false;
  }

  const { data: alreadyApplied } = await supabase
    .from("ucat_referral_bill_rewards")
    .select("id")
    .eq("stripe_subscription_id", subscriptionId)
    .eq("status", "applied")
    .maybeSingle();
  if (alreadyApplied) return false;

  const { data: reward } = await supabase
    .from("ucat_referral_bill_rewards")
    .select("id")
    .eq("student_id", subscription.student_id)
    .eq("status", "queued")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!reward) return false;

  // Claim before touching Stripe so duplicate invoice.created deliveries cannot
  // consume two rewards. The partial unique index also prevents two rewards
  // being applied to the same subscription concurrently.
  const now = new Date().toISOString();
  const { data: claimedReward, error: claimError } = await supabase
    .from("ucat_referral_bill_rewards")
    .update({
      status: "applied",
      stripe_subscription_id: subscriptionId,
      stripe_invoice_id: invoice.id,
      applied_at: now,
      updated_at: now,
    })
    .eq("id", reward.id)
    .eq("status", "queued")
    .select("id")
    .maybeSingle();
  if (claimError) {
    if (claimError.code === "23505") return false;
    throw claimError;
  }
  if (!claimedReward) return false;

  try {
    const coupon = await getOrCreateReferralCoupon(stripe);
    const existingDiscounts = (
      (
        invoice as Stripe.Invoice & {
          discounts?: Array<string | { id?: string }>;
        }
      ).discounts ?? []
    )
      .map(stripeId)
      .filter((id): id is string => Boolean(id))
      .map((discount) => ({ discount }));

    await stripe.invoices.update(invoice.id, {
      discounts: [...existingDiscounts, { coupon: coupon.id }],
      metadata: {
        ...(invoice.metadata ?? {}),
        ucat_referral_reward_id: reward.id,
      },
    } as Stripe.InvoiceUpdateParams);
  } catch (error: unknown) {
    await requeueReferralReward(supabase, invoice.id);
    throw error;
  }

  return true;
}

export async function markReferralRewardRedeemed(
  supabase: SupabaseClient,
  invoiceId: string,
): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("ucat_referral_bill_rewards")
    .update({ status: "redeemed", redeemed_at: now, updated_at: now })
    .eq("stripe_invoice_id", invoiceId)
    .eq("status", "applied");
  if (error) throw error;
}

export async function requeueReferralReward(
  supabase: SupabaseClient,
  invoiceId: string,
): Promise<void> {
  const { error } = await supabase
    .from("ucat_referral_bill_rewards")
    .update({
      status: "queued",
      stripe_subscription_id: null,
      stripe_invoice_id: null,
      applied_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_invoice_id", invoiceId)
    .eq("status", "applied");
  if (error) throw error;
}
