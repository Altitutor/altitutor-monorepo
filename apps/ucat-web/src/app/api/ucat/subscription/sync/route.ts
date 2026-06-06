import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  getStudentIdForUser,
  getUcatSubscriptionForStudent,
} from "@/lib/ucat/ucat-subscription";
import {
  subscriptionCancelFields,
  subscriptionPeriodFields,
  type StripeSubscriptionSnapshot,
} from "@/lib/ucat/stripe-subscription-fields";

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

  const studentId = await getStudentIdForUser(supabaseAdmin, user.id);
  if (!studentId) {
    return NextResponse.json({ synced: false });
  }

  const subscription = await getUcatSubscriptionForStudent(
    supabaseAdmin,
    studentId,
  );
  if (!subscription) {
    return NextResponse.json({ synced: false });
  }

  const stripe = new Stripe(stripeSecretKey, {
    apiVersion: "2025-12-15.clover",
  });

  try {
    const stripeSub = (await stripe.subscriptions.retrieve(
      subscription.stripe_subscription_id,
      { expand: ["items.data"] },
    )) as unknown as StripeSubscriptionSnapshot;
    const cancelFields = subscriptionCancelFields(stripeSub);
    const periodFields = subscriptionPeriodFields(stripeSub);

    const { error: updateError } = await supabaseAdmin
      .from("student_subscriptions")
      .update({
        status: stripeSub.status ?? subscription.status,
        ...periodFields,
        ...cancelFields,
        updated_at: new Date().toISOString(),
      })
      .eq("id", subscription.id);

    if (updateError) {
      console.error("[ucat subscription sync] DB update failed:", updateError);
      return NextResponse.json({ synced: false });
    }

    return NextResponse.json({
      synced: true,
      ...cancelFields,
      ...periodFields,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[ucat subscription sync] Stripe error:", msg);
    return NextResponse.json({ synced: false });
  }
}
