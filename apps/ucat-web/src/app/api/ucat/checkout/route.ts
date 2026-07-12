import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getUcatSubjectId } from "@/lib/ucat/ucat-subject-id";
import { isManageableUcatSubscriptionStatus } from "@/lib/ucat/subscription-status";
import {
  getUcatPlanPrice,
  stripePriceMatchesUcatPlan,
} from "@/lib/ucat/plan-price-lookup";
import {
  parseUcatCheckoutRequest,
  type UcatCheckoutRequest,
} from "@/lib/ucat/subscription-plan";

/**
 * POST /api/ucat/checkout
 * Creates a Stripe Checkout Session for UCAT subscription.
 * Requires authenticated student. Returns a client secret for Stripe's custom
 * Checkout UI; payment details never touch Altitutor servers.
 */
export async function POST(request: NextRequest) {
  const supabase = await getSupabaseServerClient();
  const [authResult, parsedSelection] = await Promise.all([
    supabase.auth.getUser(),
    request
      .json()
      .then((body: unknown) => parseUcatCheckoutRequest(body))
      .catch(() => null),
  ]);
  const {
    data: { user },
    error: authError,
  } = authResult;
  const selection: UcatCheckoutRequest = parsedSelection ?? {
    tier: "unlimited",
    interval: "week",
  };
  const returnContext = selection.returnContext ?? "subscribe";

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
      { error: "This plan is not available yet. Please try another option." },
      { status: 503 },
    );
  }

  const stripe = new Stripe(stripeSecretKey, {
    apiVersion: "2025-12-15.clover",
  });
  const planPricePromise = getUcatPlanPrice(
    supabaseAdmin,
    selection.tier,
    selection.interval,
  );
  const priceValidationPromise = planPricePromise.then(async (planPrice) => {
    if (!planPrice?.checkout_enabled || !planPrice.stripe_price_id?.trim()) {
      return { matches: false, error: null };
    }
    try {
      return {
        matches: await stripePriceMatchesUcatPlan(stripe, planPrice),
        error: null,
      };
    } catch (error: unknown) {
      return { matches: false, error };
    }
  });

  const [
    planPrice,
    priceValidation,
    studentResult,
    ucatSubjectId,
    configResult,
  ] = await Promise.all([
    planPricePromise,
    priceValidationPromise,
    supabaseAdmin
      .from("students")
      .select(
        "id, email, ucat_unlimited_trial_consumed_at, students_billing(stripe_customer_id), student_subscriptions(id, subject_id, status)",
      )
      .eq("user_id", user.id)
      .maybeSingle(),
    getUcatSubjectId(supabaseAdmin),
    supabaseAdmin
      .from("ucat_subscription_config")
      .select("trial_days")
      .limit(1)
      .maybeSingle(),
  ]);

  const priceId = planPrice?.stripe_price_id?.trim() ?? null;
  if (!priceId || !planPrice?.checkout_enabled) {
    return NextResponse.json(
      { error: "This plan is not available yet. Please try another option." },
      { status: 503 },
    );
  }

  const { data: student, error: studentError } = studentResult;

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

  if (!ucatSubjectId) {
    return NextResponse.json(
      { error: "UCAT subject not configured" },
      { status: 503 },
    );
  }

  const existingSub = student.student_subscriptions.some(
    (subscription) =>
      subscription.subject_id === ucatSubjectId &&
      isManageableUcatSubscriptionStatus(subscription.status),
  );

  if (existingSub) {
    return NextResponse.json(
      {
        error:
          "You already have a subscription. Review its billing status before starting another plan.",
        code: "existing_subscription",
      },
      { status: 400 },
    );
  }

  if (priceValidation.error) {
    console.error(
      "[ucat checkout] Failed to validate Stripe price:",
      priceValidation.error instanceof Error
        ? priceValidation.error.message
        : String(priceValidation.error),
    );
    return NextResponse.json(
      { error: "This plan is being updated. Please try again shortly." },
      { status: 503 },
    );
  }
  if (!priceValidation.matches) {
    console.error(
      "[ucat checkout] Stripe price does not match configured plan amount",
      selection,
    );
    return NextResponse.json(
      { error: "This plan is being updated. Please try again shortly." },
      { status: 503 },
    );
  }

  const trialDays = configResult.data?.trial_days ?? 7;
  const trialEligible = student.ucat_unlimited_trial_consumed_at == null;

  const origin = request.headers.get("origin") ?? request.nextUrl.origin;

  const subscriptionData: Stripe.Checkout.SessionCreateParams.SubscriptionData =
    {
      metadata: {
        student_id: student.id,
        ucat_plan_tier: selection.tier,
        ucat_billing_interval: selection.interval,
        ucat_checkout_context: returnContext,
      },
    };

  if (trialEligible && trialDays > 0) {
    subscriptionData.trial_period_days = trialDays;
  }

  const checkoutReturnBase =
    returnContext === "signup_onboarding"
      ? `${origin}/signup/complete`
      : returnContext === "practice_session"
        ? `${origin}/practice/session`
        : `${origin}/dashboard`;

  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    mode: "subscription",
    ui_mode: "custom",
    payment_method_types: ["card"],
    wallet_options: { link: { display: "never" } },
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
      ucat_checkout_context: returnContext,
    },
    return_url:
      returnContext === "subscribe"
        ? `${checkoutReturnBase}?checkout=success`
        : `${checkoutReturnBase}?checkout=success`,
  };

  const billing = student.students_billing;

  if (billing?.stripe_customer_id) {
    sessionParams.customer = billing.stripe_customer_id;
    delete sessionParams.customer_email;
  }

  try {
    const session = await stripe.checkout.sessions.create(sessionParams);

    if (!session.client_secret) {
      return NextResponse.json(
        { error: "Failed to initialize checkout" },
        { status: 500 },
      );
    }

    await supabaseAdmin.from("ucat_subscription_journey_events").insert({
      student_id: student.id,
      event_type: "checkout_loaded",
      journey_context: returnContext,
      plan_tier: selection.tier,
      billing_interval: selection.interval,
      trial_eligible: trialEligible,
      stripe_checkout_session_id: session.id,
    });

    return NextResponse.json({
      clientSecret: session.client_secret,
      checkoutSessionId: session.id,
      trialEligible,
      trialDays: trialEligible ? trialDays : 0,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[ucat checkout] Stripe error:", msg);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 },
    );
  }
}
