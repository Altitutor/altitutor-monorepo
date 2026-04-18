import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { PublicUcatSubscriptionConfig } from "@/features/subscription/types/public-subscription-config";

const BILLING_INTERVALS = new Set(["week", "fortnight", "month"]);

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

  const { data, error } = await supabaseAdmin
    .from("ucat_subscription_config")
    .select(
      "trial_days, min_questions_per_day, discount_per_day_cents, base_price_cents, currency, billing_interval",
    )
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[subscription-config]", error.message);
    return NextResponse.json(
      { error: "Failed to load config" },
      { status: 500 },
    );
  }

  if (!data) {
    return NextResponse.json({ error: "Not configured" }, { status: 404 });
  }

  const billingInterval = BILLING_INTERVALS.has(data.billing_interval)
    ? (data.billing_interval as PublicUcatSubscriptionConfig["billingInterval"])
    : "week";

  const body: PublicUcatSubscriptionConfig = {
    trialDays: data.trial_days ?? 7,
    minQuestionsPerDay: data.min_questions_per_day ?? 20,
    discountPerDayCents: data.discount_per_day_cents ?? 1000,
    basePriceCents: data.base_price_cents ?? 0,
    currency: (data.currency ?? "aud").toLowerCase(),
    billingInterval,
  };

  return NextResponse.json(body, {
    headers: {
      "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
    },
  });
}
