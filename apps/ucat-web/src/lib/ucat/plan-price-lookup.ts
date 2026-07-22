import type { SupabaseClient } from "@supabase/supabase-js";
import type Stripe from "stripe";
import type { Database } from "@altitutor/shared";
import {
  isUcatBillingInterval,
  isUcatPaidPlanTier,
  type UcatBillingInterval,
  type UcatPaidPlanTier,
} from "@altitutor/shared";

type AdminClient = SupabaseClient<Database>;

const STRIPE_PRICE_VALIDATION_TTL_MS = 5 * 60 * 1000;
const validatedStripePrices = new Map<string, number>();

export type UcatPlanPriceRow = {
  plan_tier: UcatPaidPlanTier;
  billing_interval: UcatBillingInterval;
  base_price_cents: number;
  stripe_price_id: string | null;
  checkout_enabled: boolean;
};

export async function getUcatPlanPrice(
  supabase: AdminClient,
  tier: UcatPaidPlanTier,
  interval: UcatBillingInterval,
): Promise<UcatPlanPriceRow | null> {
  const { data, error } = await supabase
    .from("ucat_plan_prices")
    .select(
      "plan_tier, billing_interval, base_price_cents, stripe_price_id, checkout_enabled",
    )
    .eq("plan_tier", tier)
    .eq("billing_interval", interval)
    .maybeSingle();

  if (error || !data) return null;
  if (
    !isUcatPaidPlanTier(data.plan_tier) ||
    !isUcatBillingInterval(data.billing_interval)
  ) {
    return null;
  }

  return {
    plan_tier: data.plan_tier,
    billing_interval: data.billing_interval,
    base_price_cents: data.base_price_cents,
    stripe_price_id: data.stripe_price_id,
    checkout_enabled: data.checkout_enabled ?? true,
  };
}

export async function stripePriceMatchesUcatPlan(
  stripe: Stripe,
  planPrice: UcatPlanPriceRow,
): Promise<boolean> {
  const priceId = planPrice.stripe_price_id?.trim();
  if (!priceId) return false;

  const cacheKey = [
    priceId,
    planPrice.base_price_cents,
    planPrice.billing_interval,
  ].join(":");
  const validatedUntil = validatedStripePrices.get(cacheKey) ?? 0;
  if (validatedUntil > Date.now()) return true;

  const price = await stripe.prices.retrieve(priceId);
  const matches =
    price.active &&
    price.currency.toLowerCase() === "aud" &&
    price.unit_amount === planPrice.base_price_cents &&
    price.recurring?.interval === planPrice.billing_interval &&
    (price.recurring.interval_count ?? 1) === 1;

  if (matches) {
    validatedStripePrices.set(
      cacheKey,
      Date.now() + STRIPE_PRICE_VALIDATION_TTL_MS,
    );
  }
  return matches;
}

export async function resolveUcatPlanFromStripePriceId(
  supabase: AdminClient,
  stripePriceId: string | null,
  stripeProductId: string | null,
): Promise<{
  plan_tier: UcatPaidPlanTier | null;
  billing_interval: UcatBillingInterval | null;
}> {
  if (stripePriceId) {
    const { data } = await supabase
      .from("ucat_plan_prices")
      .select("plan_tier, billing_interval")
      .eq("stripe_price_id", stripePriceId)
      .maybeSingle();

    if (
      data &&
      isUcatPaidPlanTier(data.plan_tier) &&
      isUcatBillingInterval(data.billing_interval)
    ) {
      return {
        plan_tier: data.plan_tier,
        billing_interval: data.billing_interval,
      };
    }
  }

  if (stripeProductId) {
    const { data: config } = await supabase
      .from("ucat_subscription_config")
      .select("unlimited_stripe_product_id")
      .limit(1)
      .maybeSingle();

    if (config?.unlimited_stripe_product_id === stripeProductId) {
      return { plan_tier: "unlimited", billing_interval: null };
    }
  }

  return { plan_tier: null, billing_interval: null };
}
