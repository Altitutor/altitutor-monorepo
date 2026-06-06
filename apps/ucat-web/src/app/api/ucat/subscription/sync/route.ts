import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  getStudentIdForUser,
  getUcatSubscriptionForStudent,
} from "@/lib/ucat/ucat-subscription";

type StripeSubscriptionSnapshot = {
  status: string;
  cancel_at_period_end?: boolean;
  cancel_at?: number | null;
  current_period_start?: number;
  current_period_end?: number;
};

function cancelFieldsFromStripe(subscription: StripeSubscriptionSnapshot): {
  cancel_at_period_end: boolean;
  cancel_at: string | null;
} {
  const cancelAtPeriodEnd = subscription.cancel_at_period_end ?? false;
  if (subscription.cancel_at) {
    return {
      cancel_at_period_end: cancelAtPeriodEnd,
      cancel_at: new Date(subscription.cancel_at * 1000).toISOString(),
    };
  }
  if (cancelAtPeriodEnd && subscription.current_period_end) {
    return {
      cancel_at_period_end: true,
      cancel_at: new Date(subscription.current_period_end * 1000).toISOString(),
    };
  }
  return { cancel_at_period_end: cancelAtPeriodEnd, cancel_at: null };
}

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
    )) as unknown as StripeSubscriptionSnapshot;
    const cancelFields = cancelFieldsFromStripe(stripeSub);

    await supabaseAdmin
      .from("student_subscriptions")
      .update({
        status: stripeSub.status,
        current_period_start: stripeSub.current_period_start
          ? new Date(stripeSub.current_period_start * 1000).toISOString()
          : null,
        current_period_end: stripeSub.current_period_end
          ? new Date(stripeSub.current_period_end * 1000).toISOString()
          : null,
        ...cancelFields,
        updated_at: new Date().toISOString(),
      })
      .eq("id", subscription.id);

    return NextResponse.json({ synced: true, ...cancelFields });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[ucat subscription sync] Stripe error:", msg);
    return NextResponse.json({ synced: false });
  }
}
