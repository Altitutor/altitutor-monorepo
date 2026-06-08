import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@altitutor/shared";
import {
  isUcatBillingInterval,
  isUcatPaidPlanTier,
  type UcatBillingInterval,
  type UcatPaidPlanTier,
} from "@altitutor/shared";

type AdminClient = SupabaseClient<Database>;

export type UcatPlanPriceRow = {
  plan_tier: UcatPaidPlanTier;
  billing_interval: UcatBillingInterval;
  base_price_cents: number;
  stripe_price_id: string | null;
};

export async function getUcatPlanPrice(
  supabase: AdminClient,
  tier: UcatPaidPlanTier,
  interval: UcatBillingInterval,
): Promise<UcatPlanPriceRow | null> {
  const { data, error } = await supabase
    .from("ucat_plan_prices")
    .select("plan_tier, billing_interval, base_price_cents, stripe_price_id")
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
  };
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
      .select("unlimited_stripe_product_id, pro_stripe_product_id")
      .limit(1)
      .maybeSingle();

    if (config?.pro_stripe_product_id === stripeProductId) {
      return { plan_tier: "pro", billing_interval: null };
    }
    if (config?.unlimited_stripe_product_id === stripeProductId) {
      return { plan_tier: "unlimited", billing_interval: null };
    }
  }

  return { plan_tier: null, billing_interval: null };
}
