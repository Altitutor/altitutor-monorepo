import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getUcatSubjectId } from "@/lib/ucat/ucat-subject-id";
import { getUcatPlanPrice } from "@/lib/ucat/plan-price-lookup";
import {
  parseUcatCheckoutRequest,
  type UcatCheckoutSelection,
} from "@/lib/ucat/subscription-plan";

/**
 * POST /api/ucat/checkout
 * Creates a Stripe Checkout Session for UCAT subscription.
 * Requires authenticated student. Redirects to Stripe hosted checkout.
 */
export async function POST(request: NextRequest) {
  const supabase = await getSupabaseServerClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  let selection: UcatCheckoutSelection = { tier: "unlimited", interval: "week" };
  let returnContext: "signup_onboarding" | "subscribe" = "subscribe";
  try {
    const body = (await request.clone().json()) as unknown;
    const parsed = parseUcatCheckoutRequest(body);
    if (parsed) {
      selection = parsed;
      returnContext = parsed.returnContext ?? "subscribe";
    }
  } catch {
    // No body or invalid JSON — default to Unlimited weekly
  }

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

  const planPrice = await getUcatPlanPrice(
    supabaseAdmin,
    selection.tier,
    selection.interval,
  );
  const priceId = planPrice?.stripe_price_id?.trim() ?? null;

  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecretKey || !priceId) {
    return NextResponse.json(
      { error: "This plan is not available yet. Please try another option." },
      { status: 503 },
    );
  }

  const { data: student, error: studentError } = await supabaseAdmin
    .from("students")
    .select("id, first_name, last_name, email, ucat_unlimited_trial_consumed_at")
    .eq("user_id", user.id)
    .maybeSingle();

  if (studentError) {
    return NextResponse.json(
      { error: "Failed to resolve student" },
      { status: 500 },
    );
  }

  if (!student) {
    return NextResponse.json(
      { error: "No student profile found" },
      { status: 404 },
    );
  }

  const ucatSubjectId = await getUcatSubjectId(supabaseAdmin);
  if (!ucatSubjectId) {
    return NextResponse.json(
      { error: "UCAT subject not configured" },
      { status: 503 },
    );
  }

  const { data: existingSub } = await supabaseAdmin
    .from("student_subscriptions")
    .select("id")
    .eq("student_id", student.id)
    .eq("subject_id", ucatSubjectId)
    .in("status", ["trialing", "active"])
    .maybeSingle();

  if (existingSub) {
    return NextResponse.json(
      { error: "You already have an active subscription" },
      { status: 400 },
    );
  }

  const stripe = new Stripe(stripeSecretKey, {
    apiVersion: "2025-12-15.clover",
  });

  const { data: config } = await supabaseAdmin
    .from("ucat_subscription_config")
    .select("trial_days")
    .limit(1)
    .maybeSingle();

  const trialDays = config?.trial_days ?? 7;
  const trialEligible = student.ucat_unlimited_trial_consumed_at == null;

  const origin = request.headers.get("origin") ?? request.nextUrl.origin;

  const subscriptionData: Stripe.Checkout.SessionCreateParams.SubscriptionData =
    {
      metadata: {
        student_id: student.id,
        ucat_plan_tier: selection.tier,
        ucat_billing_interval: selection.interval,
      },
    };

  if (trialEligible && trialDays > 0) {
    subscriptionData.trial_period_days = trialDays;
  }

  const checkoutReturnBase =
    returnContext === "signup_onboarding"
      ? `${origin}/signup/complete`
      : `${origin}/dashboard`;

  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    subscription_data: subscriptionData,
    payment_method_collection: "always",
    customer_email: student.email ?? undefined,
    metadata: {
      student_id: student.id,
      ucat_plan_tier: selection.tier,
      ucat_billing_interval: selection.interval,
    },
    success_url:
      returnContext === "signup_onboarding"
        ? `${checkoutReturnBase}?checkout=success`
        : checkoutReturnBase,
    cancel_url:
      returnContext === "signup_onboarding"
        ? `${origin}/signup/complete?checkout=canceled`
        : `${origin}/subscribe?canceled=1`,
    allow_promotion_codes: true,
  };

  const { data: billing } = await supabaseAdmin
    .from("students_billing")
    .select("stripe_customer_id")
    .eq("student_id", student.id)
    .maybeSingle();

  if (billing?.stripe_customer_id) {
    sessionParams.customer = billing.stripe_customer_id;
    delete sessionParams.customer_email;
  }

  try {
    const session = await stripe.checkout.sessions.create(sessionParams);

    if (!session.url) {
      return NextResponse.json(
        { error: "Failed to create checkout session" },
        { status: 500 },
      );
    }

    return NextResponse.json({ url: session.url });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[ucat checkout] Stripe error:", msg);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 },
    );
  }
}
