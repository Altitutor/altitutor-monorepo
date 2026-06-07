import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { fetchSubscriptionBillingForUser } from "@/lib/ucat/subscription/fetch-subscription-billing";
import { syncUcatSubscriptionForUser } from "@/lib/ucat/subscription/sync-ucat-subscription";

/**
 * GET /api/ucat/subscription/billing
 * Syncs subscription fields from Stripe, then returns subscription + invoices
 * via student views (read) with Stripe sync writes on the server only.
 */
export async function GET() {
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

  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  if (stripeSecretKey) {
    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2025-12-15.clover",
    });
    await syncUcatSubscriptionForUser(supabase, user.id, stripe);
  }

  try {
    const billing = await fetchSubscriptionBillingForUser(supabase);
    return NextResponse.json(billing);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[ucat subscription billing] fetch failed:", msg);
    return NextResponse.json(
      { error: "Failed to load subscription billing" },
      { status: 500 },
    );
  }
}
