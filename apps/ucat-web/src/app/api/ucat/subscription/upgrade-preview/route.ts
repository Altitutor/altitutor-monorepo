import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getUcatPlanPrice } from "@/lib/ucat/plan-price-lookup";
import {
  getStudentIdForUser,
  getUcatSubscriptionForStudent,
} from "@/lib/ucat/ucat-subscription";
import { parseBillingInterval } from "@/features/subscription/lib/pricing";
import { billingIntervalNoun } from "@/features/subscription/lib/format-subscription-copy";

/**
 * GET /api/ucat/subscription/upgrade-preview
 * Prorated charge preview for Unlimited → Pro on the current subscription.
 */
export async function GET() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    return NextResponse.json({ error: "Failed to get user" }, { status: 500 });
  }

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: "Server not configured" },
      { status: 503 },
    );
  }

  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecretKey) {
    return NextResponse.json(
      { error: "Billing not configured" },
      { status: 503 },
    );
  }

  const studentId = await getStudentIdForUser(supabaseAdmin, user.id);
  if (!studentId) {
    return NextResponse.json(
      { error: "No student profile found" },
      { status: 404 },
    );
  }

  const subscription = await getUcatSubscriptionForStudent(
    supabaseAdmin,
    studentId,
  );
  if (!subscription) {
    return NextResponse.json(
      { error: "No active subscription found" },
      { status: 404 },
    );
  }

  if (subscription.plan_tier === "pro") {
    return NextResponse.json(
      { error: "You are already on UCAT Pro" },
      { status: 400 },
    );
  }

  const billingInterval = parseBillingInterval(subscription.billing_interval);
  if (!billingInterval) {
    return NextResponse.json(
      { error: "Could not resolve your billing interval" },
      { status: 400 },
    );
  }

  const proPrice = await getUcatPlanPrice(
    supabaseAdmin,
    "pro",
    billingInterval,
  );
  const proPriceId = proPrice?.stripe_price_id?.trim() ?? null;
  if (!proPriceId || proPrice == null) {
    return NextResponse.json(
      { error: "UCAT Pro is not available for your billing interval" },
      { status: 503 },
    );
  }

  const { data: billing } = await supabaseAdmin
    .from("students_billing")
    .select("stripe_customer_id")
    .eq("student_id", studentId)
    .maybeSingle();

  if (!billing?.stripe_customer_id) {
    return NextResponse.json(
      { error: "No billing profile found" },
      { status: 404 },
    );
  }

  const stripe = new Stripe(stripeSecretKey, {
    apiVersion: "2025-12-15.clover",
  });

  try {
    const stripeSub = await stripe.subscriptions.retrieve(
      subscription.stripe_subscription_id,
      { expand: ["items.data"] },
    );
    const subscriptionItem = stripeSub.items.data[0];
    if (!subscriptionItem?.id) {
      return NextResponse.json(
        { error: "Subscription has no billable items" },
        { status: 500 },
      );
    }

    const preview = await stripe.invoices.createPreview({
      customer: billing.stripe_customer_id,
      subscription: subscription.stripe_subscription_id,
      subscription_details: {
        items: [{ id: subscriptionItem.id, price: proPriceId }],
        proration_behavior: "create_prorations",
      },
    });

    const { data: config } = await supabaseAdmin
      .from("ucat_subscription_config")
      .select("currency")
      .limit(1)
      .maybeSingle();

    const isTrialing = subscription.status === "trialing";

    return NextResponse.json({
      currency: config?.currency ?? preview.currency ?? "aud",
      billingInterval,
      billingIntervalNoun: billingIntervalNoun(billingInterval),
      isTrialing,
      dueTodayCents: isTrialing ? 0 : Math.max(0, preview.amount_due ?? 0),
      renewalStandardCents: proPrice.base_price_cents,
      currentPeriodEnd: subscription.current_period_end,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[ucat upgrade-preview] Stripe error:", msg);
    return NextResponse.json(
      { error: "Failed to preview upgrade pricing" },
      { status: 500 },
    );
  }
}
