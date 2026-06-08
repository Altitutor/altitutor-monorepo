import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { syncUcatSubscriptionForUser } from "@/lib/ucat/subscription/sync-ucat-subscription";

/**
 * GET /api/ucat/subscription/sync
 * Refreshes cancel-at-period-end fields from Stripe for the current UCAT subscription.
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

  if (!supabaseAdmin) {
    return NextResponse.json({ synced: false });
  }

  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecretKey) {
    return NextResponse.json({ synced: false });
  }

  const stripe = new Stripe(stripeSecretKey, {
    apiVersion: "2025-12-15.clover",
  });

  const result = await syncUcatSubscriptionForUser(supabase, user.id, stripe);
  return NextResponse.json(result);
}
