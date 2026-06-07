import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type {
  PublicUcatPlanPrice,
  PublicUcatSubscriptionConfig,
} from "@/features/subscription/types/public-subscription-config";
import { mapQuotaConfigRow } from "@/lib/ucat/quota/config";
import {
  isUcatBillingInterval,
  isUcatPaidPlanTier,
} from "@altitutor/shared";

/**
 * GET /api/ucat/subscription-config
 * Public marketing fields for the subscribe page (no Stripe secrets).
 */
export async function GET() {
  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: "Server not configured" },
      { status: 503 },
    );
  }

  const [configResult, pricesResult, discountResult] = await Promise.all([
    supabaseAdmin
      .from("ucat_subscription_config")
      .select(
        "trial_days, min_questions_per_day, currency, unlimited_stripe_product_id, pro_stripe_product_id, free_practice_limit, free_practice_period, free_sets_limit, free_sets_period, free_mocks_limit, free_mocks_period, free_learn_limit, free_learn_period, free_skill_trainer_limit, free_skill_trainer_period",
      )
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
    supabaseAdmin
      .from("ucat_plan_prices")
      .select("plan_tier, billing_interval, base_price_cents, stripe_price_id")
      .order("plan_tier")
      .order("billing_interval"),
    supabaseAdmin
      .from("ucat_practice_day_discount_config")
      .select(
        "billing_interval, discount_per_day_cents, max_discounts_per_period",
      )
      .order("billing_interval"),
  ]);

  if (configResult.error) {
    console.error("[subscription-config]", configResult.error.message);
    return NextResponse.json(
      { error: "Failed to load config" },
      { status: 500 },
    );
  }

  if (pricesResult.error) {
    console.error("[subscription-config/prices]", pricesResult.error.message);
    return NextResponse.json(
      { error: "Failed to load plan prices" },
      { status: 500 },
    );
  }

  if (discountResult.error) {
    console.error(
      "[subscription-config/discounts]",
      discountResult.error.message,
    );
    return NextResponse.json(
      { error: "Failed to load practice-day discount config" },
      { status: 500 },
    );
  }

  const data = configResult.data;
  if (!data) {
    return NextResponse.json({ error: "Not configured" }, { status: 404 });
  }

  const planPrices: PublicUcatPlanPrice[] = (pricesResult.data ?? []).flatMap(
    (row) => {
      if (
        !isUcatPaidPlanTier(row.plan_tier) ||
        !isUcatBillingInterval(row.billing_interval)
      ) {
        return [];
      }
      return [
        {
          tier: row.plan_tier,
          interval: row.billing_interval,
          basePriceCents: row.base_price_cents ?? 0,
          available: Boolean(row.stripe_price_id?.trim()),
        },
      ];
    },
  );

  const practiceDayDiscounts = (discountResult.data ?? []).flatMap((row) => {
    if (!isUcatBillingInterval(row.billing_interval)) return [];
    return [
      {
        interval: row.billing_interval,
        discountPerDayCents: row.discount_per_day_cents ?? 0,
        maxDiscountsPerPeriod: row.max_discounts_per_period ?? 1,
      },
    ];
  });

  const body: PublicUcatSubscriptionConfig = {
    trialDays: data.trial_days ?? 7,
    minQuestionsPerDay: data.min_questions_per_day ?? 20,
    currency: (data.currency ?? "aud").toLowerCase(),
    freeQuotas: mapQuotaConfigRow(data),
    planPrices,
    practiceDayDiscounts,
    unlimitedProductConfigured: Boolean(
      data.unlimited_stripe_product_id?.trim(),
    ),
    proProductConfigured: Boolean(data.pro_stripe_product_id?.trim()),
  };

  return NextResponse.json(body, {
    headers: {
      "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
    },
  });
}
