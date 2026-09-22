import { addMonths, addWeeks, differenceInCalendarDays } from "date-fns";
import { captureUcatReferral } from "@/lib/ucat/referrals/capture-referral";
import {
  findFounderOffer,
  founderHistory,
  founderCoupon,
  claimFounderOffer,
  type FounderRedemption,
  type FounderOffer,
} from "@/lib/ucat/founder-offers/server";
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
  buildUcatCheckoutReturnPath,
  parseUcatCheckoutRequest,
  type UcatCheckoutRequest,
} from "@/lib/ucat/subscription-plan";
import { isStandardUcatTrialEligible } from "@/lib/ucat/subscription-trial";
import { safePostAuthReturnPath } from "@/features/auth/lib/return-intent";

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
  if (authError) {
    return NextResponse.json({ error: "Failed to get user" }, { status: 500 });
  }
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!parsedSelection) {
    return NextResponse.json(
      { error: "Invalid checkout selection" },
      { status: 400 },
    );
  }
  const requestedSelection: UcatCheckoutRequest = parsedSelection;
  const returnContext = requestedSelection.returnContext ?? "subscribe";
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

  let founderOffer: FounderOffer | null = null;
  let hasFounderPass = false;
  let requestedGiftId = requestedSelection.referralGiftId;
  try {
    const history = await founderHistory(student.id);
    hasFounderPass = history.some((row) => row.kind === "access_pass");
    if (requestedSelection.referralGiftId && hasFounderPass) {
      return NextResponse.json(
        {
          error:
            "Referral gifts cannot be combined with a founder access pass.",
        },
        { status: 409 },
      );
    }
    if (requestedSelection.founderCode) {
      const found = await findFounderOffer(requestedSelection.founderCode);
      if (found) {
        if (requestedSelection.referralGiftId)
          throw new Error("Choose one promotional offer.");
        founderOffer = found;
      } else {
        if (requestedGiftId) throw new Error("Choose one promotional offer.");
        if (hasFounderPass)
          throw new Error(
            "Referral gifts cannot be combined with a founder free period.",
          );
        await captureUcatReferral(student.id, requestedSelection.founderCode);
        const { data: referral, error } = await supabaseAdmin
          .from("ucat_referrals")
          .select("id, ucat_referral_codes(code)")
          .eq("referred_student_id", student.id)
          .maybeSingle();
        if (error) throw error;
        if (
          !referral ||
          referral.ucat_referral_codes?.code !== requestedSelection.founderCode
        )
          throw new Error(
            "This referral code is not available to your account.",
          );
        requestedGiftId = referral.id;
      }
    }
    const pending = history.find((row) => row.status === "reserved");
    if (
      pending &&
      (!founderOffer ||
        pending.offer_id !== founderOffer.id ||
        pending.billing_interval !== requestedSelection.interval)
    ) {
      throw new Error(
        "Cancel your open founder checkout before choosing another offer or billing interval.",
      );
    }
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not confirm offer eligibility.",
      },
      { status: 409 },
    );
  }

  const referralGift = requestedGiftId
    ? await resolveReferralGift(student.id, requestedGiftId)
    : null;
  if (requestedGiftId && !referralGift) {
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
    if (referralTrialContext.hasPendingRecipientGift && !founderOffer) {
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

  // A gift changes the introductory period, never the selected renewal interval.
  const selection: UcatCheckoutRequest = {
    ...requestedSelection,
    referralGiftId: referralGift?.id,
  };

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

  const { data: checkoutHold, error: holdError } = await supabaseAdmin.rpc(
    "reserve_ucat_checkout",
    {
      p_student_id: student.id,
      p_selection_key: JSON.stringify([
        selection.interval,
        returnContext,
        selection.returnTo ?? null,
        referralGift?.id ?? null,
        founderOffer?.id ?? null,
      ]),
      p_referral: Boolean(referralGift),
    },
  );
  if (holdError || !checkoutHold)
    return NextResponse.json(
      { error: holdError?.message ?? "Could not prepare checkout." },
      { status: 409 },
    );
  if (checkoutHold.checkout_session_id) {
    try {
      const previous = await stripe.checkout.sessions.retrieve(
        checkoutHold.checkout_session_id,
      );
      if (previous.status === "open" && previous.client_secret) {
        return NextResponse.json({
          clientSecret: previous.client_secret,
          checkoutSessionId: previous.id,
          referralGiftApplied: Boolean(
            previous.metadata?.ucat_referral_gift_id,
          ),
          trialEligible: Boolean(previous.metadata?.ucat_standard_trial_days),
          trialDays: Number(previous.metadata?.ucat_standard_trial_days ?? 0),
          founderPercentOff: founderOffer?.percent_off ?? null,
          offerTrialDays: Number(previous.metadata?.ucat_offer_trial_days ?? 0),
        });
      }
      if (previous.status === "expired") {
        await supabaseAdmin
          .from("ucat_checkout_holds")
          .delete()
          .eq("id", checkoutHold.id);
        await supabaseAdmin
          .from("ucat_founder_redemptions")
          .update({ status: "expired" })
          .eq("checkout_session_id", previous.id)
          .eq("status", "reserved");
      }
      return NextResponse.json(
        {
          error:
            previous.status === "complete"
              ? "Your purchase is being confirmed."
              : "Your checkout expired. Please try again.",
        },
        { status: 409 },
      );
    } catch (error) {
      captureApiError(error, "/api/ucat/checkout");
      return NextResponse.json(
        { error: "Could not recover checkout. Please retry." },
        { status: 503 },
      );
    }
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
    !founderOffer &&
    !hasFounderPass &&
    !checkoutHold.suppress_trial &&
    trialDays > 0 &&
    isStandardUcatTrialEligible({
      trialConsumedAt: student.ucat_unlimited_trial_consumed_at,
      hasPriorUcatSubscription,
      hasAcceptedRecipientGift: referralTrialContext.hasAcceptedRecipientGift,
      hasReferralAccessGift: referralTrialContext.hasReferralAccessGift,
    });

  const giftStart = new Date(checkoutHold.created_at);
  const freePeriodEnd =
    founderOffer?.kind === "access_pass"
      ? (founderOffer.duration_unit === "month" ? addMonths : addWeeks)(
          giftStart,
          founderOffer.duration_count ?? 1,
        )
      : referralGift
        ? (referralGift.interval === "month" ? addMonths : addWeeks)(
            giftStart,
            1,
          )
        : null;
  const offerTrialDays = freePeriodEnd
    ? differenceInCalendarDays(freePeriodEnd, giftStart)
    : 0;
  if (offerTrialDays > 730) {
    await supabaseAdmin
      .from("ucat_checkout_holds")
      .delete()
      .eq("id", checkoutHold.id)
      .is("checkout_session_id", null);
    return NextResponse.json(
      {
        error:
          "This offer exceeds the maximum free period of 730 days. Please request a shorter invitation.",
      },
      { status: 409 },
    );
  }

  const origin = request.headers.get("origin") ?? request.nextUrl.origin;
  const metadata: Stripe.MetadataParam = {
    student_id: student.id,
    ucat_checkout_hold_id: checkoutHold.id,
    ucat_plan_tier: selection.tier,
    ucat_billing_interval: selection.interval,
    ucat_checkout_context: returnContext,
    ucat_acquisition_benefit: referralGift
      ? "referral_gift"
      : founderOffer
        ? founderOffer.kind === "access_pass"
          ? "founder_access"
          : "founder_discount"
        : trialEligible
          ? "standard_trial"
          : "none",
  };
  if (referralGift) {
    metadata.ucat_referral_gift_id = referralGift.id;
    metadata.ucat_referral_gift_kind = referralGift.kind;
  }

  const returnTo = safePostAuthReturnPath(selection.returnTo);
  const checkoutReturnPath = buildUcatCheckoutReturnPath(
    returnContext,
    returnTo,
  );

  const subscriptionData: Stripe.Checkout.SessionCreateParams.SubscriptionData =
    { metadata };
  if (offerTrialDays) {
    subscriptionData.trial_period_days = offerTrialDays;
    metadata.ucat_offer_trial_days = String(offerTrialDays);
  }
  if (trialEligible) {
    subscriptionData.trial_period_days = trialDays;
    metadata.ucat_standard_trial_days = String(trialDays);
  }

  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    mode: "subscription",
    expires_at:
      Math.floor(Date.parse(checkoutHold.created_at) / 1000) + 60 * 60,
    ui_mode: "custom",
    wallet_options: { link: { display: "never" } },
    line_items: [{ price: priceId, quantity: 1 }],
    subscription_data: subscriptionData,
    payment_method_collection: "always",
    customer_email: student.email ?? undefined,
    metadata,
    return_url: new URL(checkoutReturnPath, origin).toString(),
  };

  const billing = student.students_billing;
  if (billing?.stripe_customer_id) {
    sessionParams.customer = billing.stripe_customer_id;
    delete sessionParams.customer_email;
  }

  let founderClaim: FounderRedemption | null = null;
  if (founderOffer) {
    try {
      const coupon =
        founderOffer.kind === "discount"
          ? await founderCoupon(stripe, founderOffer)
          : null;
      founderClaim = await claimFounderOffer(
        student.id,
        founderOffer.code,
        selection.interval,
      );
      if (founderClaim.checkout_session_id) {
        const prior = await stripe.checkout.sessions.retrieve(
          founderClaim.checkout_session_id,
        );
        if (prior.status !== "open" || !prior.client_secret) {
          if (prior.status === "expired") {
            await supabaseAdmin
              .from("ucat_founder_redemptions")
              .update({ status: "expired" })
              .eq("id", founderClaim.id)
              .eq("status", "reserved");
          }
          throw new Error(
            prior.status === "complete"
              ? "Your purchase is being confirmed."
              : "Your checkout expired. Please try again.",
          );
        }
        return NextResponse.json({
          clientSecret: prior.client_secret,
          checkoutSessionId: prior.id,
          referralGiftApplied: false,
          trialEligible: prior.metadata?.ucat_standard_trial_days !== undefined,
          trialDays: Number(prior.metadata?.ucat_standard_trial_days ?? 0),
          founderPercentOff: founderOffer.percent_off,
          offerTrialDays: Number(prior.metadata?.ucat_offer_trial_days ?? 0),
        });
      }
      metadata.ucat_founder_redemption_id = founderClaim.id;
      metadata.ucat_founder_offer_id = founderOffer.id;
      metadata.ucat_founder_code = founderOffer.code;
      metadata.ucat_founder_campaign = founderOffer.campaign;
      metadata.ucat_founder_kind = founderOffer.kind;
      if (coupon) sessionParams.discounts = [{ coupon: coupon.id }];
      // Stable across retries. Expiry releases the reserved place through Stripe's webhook.
      sessionParams.expires_at =
        Math.floor(Date.parse(checkoutHold.created_at) / 1000) + 60 * 60;
    } catch (error) {
      await supabaseAdmin
        .from("ucat_checkout_holds")
        .delete()
        .eq("id", checkoutHold.id)
        .is("checkout_session_id", null);
      if (
        error instanceof Error &&
        error.message ===
          "Cancel your open checkout before starting a free access pass."
      ) {
        return NextResponse.json(
          {
            code: "CHECKOUT_SETUP_REQUIRED",
            error:
              "Invitation checkout is temporarily unavailable. Please try again later.",
          },
          { status: 503 },
        );
      }
      return NextResponse.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Could not apply founder discount.",
        },
        { status: 409 },
      );
    }
  }

  try {
    const session = await stripe.checkout.sessions.create(sessionParams, {
      idempotencyKey: `ucat-checkout:${checkoutHold.id}`,
    });
    if (!session.client_secret) {
      return NextResponse.json(
        { error: "Failed to initialize checkout" },
        { status: 500 },
      );
    }

    const { error: holdSaveError } = await supabaseAdmin
      .from("ucat_checkout_holds")
      .update({ checkout_session_id: session.id })
      .eq("id", checkoutHold.id);
    if (holdSaveError) throw holdSaveError;

    if (founderClaim) {
      const { error } = await supabaseAdmin
        .from("ucat_founder_redemptions")
        .update({ checkout_session_id: session.id })
        .eq("id", founderClaim.id);
      if (error) throw error;
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
        trial_days: offerTrialDays || (trialEligible ? trialDays : 0),
      },
    });

    return NextResponse.json({
      clientSecret: session.client_secret,
      checkoutSessionId: session.id,
      referralGiftApplied: Boolean(referralGift),
      founderPercentOff: founderOffer?.percent_off ?? null,
      offerTrialDays,
      trialEligible,
      trialDays: trialEligible ? trialDays : 0,
    });
  } catch (error: unknown) {
    // Definitive validation failures created no session; network/5xx failures
    // retain the hold so retrying uses the same Stripe idempotency key.
    if (error instanceof Stripe.errors.StripeInvalidRequestError) {
      await supabaseAdmin
        .from("ucat_checkout_holds")
        .delete()
        .eq("id", checkoutHold.id)
        .is("checkout_session_id", null);
      if (founderClaim)
        await supabaseAdmin
          .from("ucat_founder_redemptions")
          .update({ status: "expired" })
          .eq("id", founderClaim.id)
          .eq("status", "reserved")
          .is("checkout_session_id", null);
    }
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
