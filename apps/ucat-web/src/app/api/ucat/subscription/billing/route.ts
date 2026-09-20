import { supabaseAdmin } from "@/lib/supabase/admin";
import { captureApiError } from "@/lib/sentry/capture-api-error";
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
    // IDs come exclusively from student-scoped views; service-role reads only
    // enrich those owned records with billing fields unavailable in the views.
    if (!supabaseAdmin) throw new Error("Server not configured");
    const invoiceIds = billing.invoices.map((invoice) => invoice.id);
    const [redemption, invoiceTotals] = await Promise.all([
      billing.subscription
        ? supabaseAdmin
            .from("ucat_founder_redemptions")
            .select("ucat_founder_offers(percent_off)")
            .eq(
              "stripe_subscription_id",
              billing.subscription.stripe_subscription_id,
            )
            .eq("kind", "discount")
            .eq("status", "redeemed")
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      invoiceIds.length
        ? supabaseAdmin
            .from("invoices")
            .select("id, total_cents")
            .in("id", invoiceIds)
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (redemption.error) throw redemption.error;
    if (invoiceTotals.error) throw invoiceTotals.error;
    const totals = new Map(
      (invoiceTotals.data ?? []).map((row) => [row.id, row.total_cents]),
    );
    return NextResponse.json({
      ...billing,
      founderPercentOff:
        redemption.data?.ucat_founder_offers?.percent_off ?? null,
      invoices: billing.invoices.map((invoice) => ({
        ...invoice,
        total_cents: totals.get(invoice.id) ?? null,
      })),
    });
  } catch (err) {
    captureApiError(err, "/api/ucat/subscription/billing");
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[ucat subscription billing] fetch failed:", msg);
    return NextResponse.json(
      { error: "Failed to load subscription billing" },
      { status: 500 },
    );
  }
}
