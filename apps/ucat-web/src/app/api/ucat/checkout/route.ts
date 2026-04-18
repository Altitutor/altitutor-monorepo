import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getUcatSubjectId } from "@/lib/ucat/ucat-subject-id";

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

  if (authError) {
    return NextResponse.json({ error: "Failed to get user" }, { status: 500 });
  }

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: "Server not configured" },
      { status: 500 },
    );
  }

  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  const priceId =
    process.env.UCAT_STRIPE_PRICE_ID ?? (await getConfigPriceId(supabaseAdmin));

  if (!stripeSecretKey || !priceId) {
    return NextResponse.json(
      { error: "Subscription not configured. Please contact support." },
      { status: 503 },
    );
  }

  const { data: student, error: studentError } = await supabaseAdmin
    .from("students")
    .select("id, first_name, last_name, email")
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

  // Check if already has active UCAT subscription
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

  const origin = request.headers.get("origin") ?? request.nextUrl.origin;

  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    subscription_data: {
      trial_period_days: trialDays,
      metadata: {
        student_id: student.id,
      },
    },
    payment_method_collection: "always",
    customer_email: student.email ?? undefined,
    metadata: {
      student_id: student.id,
    },
    success_url: `${origin}/subscribe/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/subscribe?canceled=1`,
    allow_promotion_codes: true,
  };

  // Use existing Stripe customer if student has one (from students_billing)
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

async function getConfigPriceId(
  supabase: NonNullable<typeof supabaseAdmin>,
): Promise<string | null> {
  const { data } = await supabase
    .from("ucat_subscription_config")
    .select("stripe_price_id")
    .not("stripe_price_id", "is", null)
    .limit(1)
    .maybeSingle();

  return data?.stripe_price_id ?? null;
}
