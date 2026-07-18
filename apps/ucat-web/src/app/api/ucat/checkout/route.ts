import { captureApiError } from "@/lib/sentry/capture-api-error";
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
import { isStandardUcatTrialEligible } from "@/lib/ucat/subscription-trial";

const REFERRAL_GIFT_COUPON_ID = "ucat-referral-unlimited-gift";
const REFERRAL_GIFT_COUPON_NAME = "UCAT gift — first period free";

type ReferralGiftCheckout = {
  id: string;
  kind: "recipient" | "earned_referrer";
  interval: "week" | "month";
};

type ReferralTrialContext = {
  hasPendingRecipientGift: boolean;
  hasAcceptedRecipientGift: boolean;
  hasReferralAccessGift: boolean;
};

async function loadReferralTrialContext(
  studentId: string,
): Promise<ReferralTrialContext> {
  if (!supabaseAdmin) {
    throw new Error("Server not configured");
  }

  const { error: expiryError } = await supabaseAdmin.rpc(
    "expire_ucat_referral_gifts",
  );
  if (expiryError) throw expiryError;
  const [pendingResult, acceptedResult, accessGiftResult] = await Promise.all([
    supabaseAdmin
      .from("ucat_referrals")
      .select("id")
      .eq("referred_student_id", studentId)
      .in("gift_status", ["pending", "checkout_pending"])
      .gt("gift_expires_at", new Date().toISOString())
      .limit(1)
      .maybeSingle(),
    supabaseAdmin
      .from("ucat_referrals")
      .select("id")
      .eq("referred_student_id", studentId)
      .eq("gift_status", "accepted")
      .limit(1)
      .maybeSingle(),
    supabaseAdmin
      .from("ucat_referral_access_gifts")
      .select("id")
      .eq("student_id", studentId)
      .in("status", ["available", "checkout_pending", "used"])
      .limit(1)
      .maybeSingle(),
  ]);

  const error =
    pendingResult.error ?? acceptedResult.error ?? accessGiftResult.error;
  if (error) throw error;

  return {
    hasPendingRecipientGift: Boolean(pendingResult.data),
    hasAcceptedRecipientGift: Boolean(acceptedResult.data),
    hasReferralAccessGift: Boolean(accessGiftResult.data),
  };
}

async function getOrCreateReferralGiftCoupon(
  stripe: Stripe,
): Promise<Stripe.Coupon> {
  try {
    return await stripe.coupons.retrieve(REFERRAL_GIFT_COUPON_ID);
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
      id: REFERRAL_GIFT_COUPON_ID,
      name: REFERRAL_GIFT_COUPON_NAME,
      percent_off: 100,
      duration: "once",
      metadata: { source: "ucat_referral_gift", tier: "unlimited" },
    });
  } catch (error: unknown) {
    if ((error as { code?: string }).code === "resource_already_exists") {
      return stripe.coupons.retrieve(REFERRAL_GIFT_COUPON_ID);
    }
    throw error;
  }
}

async function resolveReferralGift(
  studentId: string,
  giftId: string | undefined,
): Promise<ReferralGiftCheckout | null> {
  if (!supabaseAdmin || !giftId) return null;

  await supabaseAdmin.rpc("expire_ucat_referral_gifts");

  const { data: recipientGift } = await supabaseAdmin
    .from("ucat_referrals")
    .select("id, gift_duration_interval, gift_status, gift_expires_at")
    .eq("id", giftId)
    .eq("referred_student_id", studentId)
    .in("gift_status", ["pending", "checkout_pending"])
    .gt("gift_expires_at", new Date().toISOString())
    .maybeSingle();

  if (recipientGift) {
    return {
      id: recipientGift.id,
      kind: "recipient",
      interval:
        recipientGift.gift_duration_interval === "month" ? "month" : "week",
    };
  }

  const { data: earnedGift } = await supabaseAdmin
    .from("ucat_referral_access_gifts")
    .select("id, duration_interval, status")
    .eq("id", giftId)
    .eq("student_id", studentId)
    .in("status", ["available", "checkout_pending"])
    .maybeSingle();

  if (!earnedGift) return null;
  return {
    id: earnedGift.id,
    kind: "earned_referrer",
    interval: earnedGift.duration_interval === "month" ? "month" : "week",
  };
}

/**
 * Creates Stripe's custom Checkout Session. Card data stays inside Stripe.
 * Eligible first-time students receive the admin-configured standard trial.
 * A validated referral gift is mutually exclusive and instead applies a
 * once-only 100%-off coupon to the first UCAT Unlimited invoice.
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
  const requestedSelection: UcatCheckoutRequest = parsedSelection ?? {
    tier: "unlimited",
    interval: "week",
  };
  const returnContext = requestedSelection.returnContext ?? "subscribe";

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

  const [studentResult, ucatSubjectId, configResult] = await Promise.all([
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
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);
  const { data: student, error: studentError } = studentResult;

  if (studentError) {
    return NextResponse.json(
      { error: "Failed to resolve student" },
      { status: 500 },
    );
  }
  if (configResult.error) {
    console.error(
      "[ucat checkout] Failed to load trial config:",
      configResult.error,
    );
    return NextResponse.json(
      { error: "Failed to load subscription configuration" },
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

  const referralGift = requestedSelection.referralGiftId
    ? await resolveReferralGift(student.id, requestedSelection.referralGiftId)
    : null;
  if (requestedSelection.referralGiftId && !referralGift) {
    return NextResponse.json(
      { error: "This referral gift is no longer available." },
      { status: 409 },
    );
  }

  let referralTrialContext: ReferralTrialContext = {
    hasPendingRecipientGift: false,
    hasAcceptedRecipientGift: false,
    hasReferralAccessGift: false,
  };
  if (!referralGift) {
    try {
      referralTrialContext = await loadReferralTrialContext(student.id);
    } catch (error: unknown) {
      captureApiError(error, "/api/ucat/checkout");
      console.error(
        "[ucat checkout] Failed to resolve trial eligibility:",
        error,
      );
      return NextResponse.json(
        { error: "Failed to confirm trial eligibility" },
        { status: 500 },
      );
    }
    if (referralTrialContext.hasPendingRecipientGift) {
      return NextResponse.json(
        {
          error:
            "Accept or decline your pending referral gift before starting another plan.",
          code: "pending_referral_gift",
        },
        { status: 409 },
      );
    }
  }

  const selection: UcatCheckoutRequest = referralGift
    ? {
        tier: "unlimited",
        interval: referralGift.interval,
        returnContext,
        referralGiftId: referralGift.id,
      }
    : requestedSelection;

  const planPrice = await getUcatPlanPrice(
    supabaseAdmin,
    selection.tier,
    selection.interval,
  );
  const priceId = planPrice?.stripe_price_id?.trim() ?? null;
  if (!priceId || !planPrice?.checkout_enabled) {
    return NextResponse.json(
      { error: "This plan is not available yet. Please try another option." },
      { status: 503 },
    );
  }

  let priceMatches = false;
  try {
    priceMatches = await stripePriceMatchesUcatPlan(stripe, planPrice);
  } catch (error: unknown) {
    console.error("[ucat checkout] Failed to validate Stripe price:", error);
  }
  if (!priceMatches) {
    return NextResponse.json(
      { error: "This plan is being updated. Please try again shortly." },
      { status: 503 },
    );
  }

  const configuredTrialDays = configResult.data?.trial_days ?? 5;
  const trialDays = Number.isInteger(configuredTrialDays)
    ? Math.max(0, Math.min(730, configuredTrialDays))
    : 5;
  const hasPriorUcatSubscription = student.student_subscriptions.some(
    (subscription) => subscription.subject_id === ucatSubjectId,
  );
  const trialEligible =
    !referralGift &&
    trialDays > 0 &&
    isStandardUcatTrialEligible({
      trialConsumedAt: student.ucat_unlimited_trial_consumed_at,
      hasPriorUcatSubscription,
      hasAcceptedRecipientGift: referralTrialContext.hasAcceptedRecipientGift,
      hasReferralAccessGift: referralTrialContext.hasReferralAccessGift,
    });

  const origin = request.headers.get("origin") ?? request.nextUrl.origin;
  const metadata: Stripe.MetadataParam = {
    student_id: student.id,
    ucat_plan_tier: selection.tier,
    ucat_billing_interval: selection.interval,
    ucat_checkout_context: returnContext,
    ucat_acquisition_benefit: referralGift
      ? "referral_gift"
      : trialEligible
        ? "standard_trial"
        : "none",
  };
  if (referralGift) {
    metadata.ucat_referral_gift_id = referralGift.id;
    metadata.ucat_referral_gift_kind = referralGift.kind;
  }

  const checkoutReturnBase =
    returnContext === "signup_onboarding"
      ? `${origin}/signup/complete`
      : returnContext === "practice_session"
        ? `${origin}/practice/session`
        : `${origin}/dashboard`;

  const subscriptionData: Stripe.Checkout.SessionCreateParams.SubscriptionData =
    { metadata };
  if (trialEligible) {
    subscriptionData.trial_period_days = trialDays;
    metadata.ucat_standard_trial_days = String(trialDays);
  }

  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    mode: "subscription",
    ui_mode: "custom",
    payment_method_types: ["card"],
    wallet_options: { link: { display: "never" } },
    line_items: [{ price: priceId, quantity: 1 }],
    subscription_data: subscriptionData,
    payment_method_collection: "always",
    customer_email: student.email ?? undefined,
    metadata,
    return_url: `${checkoutReturnBase}?checkout=success`,
  };

  if (referralGift) {
    const coupon = await getOrCreateReferralGiftCoupon(stripe);
    sessionParams.discounts = [{ coupon: coupon.id }];
  }

  const billing = student.students_billing;
  if (billing?.stripe_customer_id) {
    sessionParams.customer = billing.stripe_customer_id;
    delete sessionParams.customer_email;
  }

  try {
    const session = await stripe.checkout.sessions.create(
      sessionParams,
      referralGift
        ? {
            idempotencyKey: `ucat-referral-gift:${referralGift.kind}:${referralGift.id}`,
          }
        : undefined,
    );
    if (!session.client_secret) {
      return NextResponse.json(
        { error: "Failed to initialize checkout" },
        { status: 500 },
      );
    }

    if (referralGift?.kind === "recipient") {
      await supabaseAdmin
        .from("ucat_referrals")
        .update({
          gift_status: "checkout_pending",
          referred_checkout_session_id: session.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", referralGift.id)
        .eq("referred_student_id", student.id)
        .in("gift_status", ["pending", "checkout_pending"]);
    } else if (referralGift?.kind === "earned_referrer") {
      await supabaseAdmin
        .from("ucat_referral_access_gifts")
        .update({
          status: "checkout_pending",
          stripe_checkout_session_id: session.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", referralGift.id)
        .eq("student_id", student.id)
        .in("status", ["available", "checkout_pending"]);
    }

    await supabaseAdmin.from("ucat_subscription_journey_events").insert({
      student_id: student.id,
      event_type: "checkout_loaded",
      journey_context:
        returnContext === "referral_gift" ? "subscribe" : returnContext,
      plan_tier: selection.tier,
      billing_interval: selection.interval,
      trial_eligible: trialEligible,
      stripe_checkout_session_id: session.id,
      metadata: {
        acquisition_benefit: metadata.ucat_acquisition_benefit,
        trial_days: trialEligible ? trialDays : 0,
      },
    });

    return NextResponse.json({
      clientSecret: session.client_secret,
      checkoutSessionId: session.id,
      referralGiftApplied: Boolean(referralGift),
      trialEligible,
      trialDays: trialEligible ? trialDays : 0,
    });
  } catch (error: unknown) {
    captureApiError(error, "/api/ucat/checkout");
    console.error(
      "[ucat checkout] Stripe error:",
      error instanceof Error ? error.message : String(error),
    );
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 },
    );
  }
}
