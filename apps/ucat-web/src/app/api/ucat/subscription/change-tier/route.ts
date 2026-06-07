import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import {
  isUcatBillingInterval,
  isUcatPaidPlanTier,
  type UcatPaidPlanTier,
} from "@altitutor/shared";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getUcatPlanPrice } from "@/lib/ucat/plan-price-lookup";
import {
  getStudentIdForUser,
  getUcatSubscriptionForStudent,
} from "@/lib/ucat/ucat-subscription";
import { parseBillingInterval } from "@/features/subscription/lib/pricing";

type ChangeTierBody = {
  tier?: unknown;
};

function parseTargetTier(value: unknown): UcatPaidPlanTier | null {
  return isUcatPaidPlanTier(value) ? value : null;
}

function currentPaidTier(
  planTier: string | null | undefined,
): UcatPaidPlanTier {
  return planTier === "pro" ? "pro" : "unlimited";
}

/**
 * POST /api/ucat/subscription/change-tier
 * Changes UCAT Unlimited ↔ UCAT Pro on the existing Stripe subscription (same interval).
 * Upgrades are immediate with proration; downgrades are not supported here (use Stripe portal).
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

  let body: ChangeTierBody = {};
  try {
    body = (await request.json()) as ChangeTierBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const targetTier = parseTargetTier(body.tier);
  if (!targetTier) {
    return NextResponse.json({ error: "Invalid plan tier" }, { status: 400 });
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

  const billingInterval = parseBillingInterval(subscription.billing_interval);
  if (!billingInterval || !isUcatBillingInterval(billingInterval)) {
    return NextResponse.json(
      { error: "Could not resolve your billing interval" },
      { status: 400 },
    );
  }

  const fromTier = currentPaidTier(subscription.plan_tier);

  if (fromTier === targetTier) {
    return NextResponse.json(
      { error: "You are already on this plan" },
      { status: 400 },
    );
  }

  if (fromTier === "pro" && targetTier === "unlimited") {
    return NextResponse.json(
      {
        error:
          "To downgrade to UCAT Unlimited, manage your subscription on the Subscription tab.",
        code: "use_subscription_settings",
      },
      { status: 400 },
    );
  }

  const planPrice = await getUcatPlanPrice(
    supabaseAdmin,
    targetTier,
    billingInterval,
  );
  const priceId = planPrice?.stripe_price_id?.trim() ?? null;
  if (!priceId) {
    return NextResponse.json(
      { error: "This plan is not available yet. Please contact support." },
      { status: 503 },
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

    const updated = await stripe.subscriptions.update(
      subscription.stripe_subscription_id,
      {
        items: [{ id: subscriptionItem.id, price: priceId }],
        proration_behavior: "create_prorations",
        metadata: {
          student_id: studentId,
          ucat_plan_tier: targetTier,
          ucat_billing_interval: billingInterval,
        },
      },
    );

    const updatedPriceId =
      updated.items.data[0]?.price &&
      typeof updated.items.data[0].price === "object"
        ? updated.items.data[0].price.id
        : priceId;

    await supabaseAdmin
      .from("student_subscriptions")
      .update({
        plan_tier: targetTier,
        billing_interval: billingInterval,
        stripe_price_id: updatedPriceId,
        status: updated.status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", subscription.id);

    return NextResponse.json({
      tier: targetTier,
      billingInterval,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[ucat change-tier] Stripe error:", msg);
    return NextResponse.json(
      { error: "Failed to change plan. Please try again or contact support." },
      { status: 500 },
    );
  }
}
