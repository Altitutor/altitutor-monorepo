import type Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@altitutor/shared";
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

export type SyncUcatSubscriptionResult = {
  synced: boolean;
  cancel_at_period_end?: boolean;
  cancel_at?: string | null;
  current_period_start?: string | null;
  current_period_end?: string | null;
};

/**
 * Refreshes cancel-at-period-end and billing period fields from Stripe for the
 * current user's UCAT subscription. Writes via service role (API-only).
 */
export async function syncUcatSubscriptionForUser(
  userSupabase: SupabaseClient<Database>,
  userId: string,
  stripe: Stripe,
): Promise<SyncUcatSubscriptionResult> {
  if (!supabaseAdmin) {
    return { synced: false };
  }

  const studentId = await getStudentIdForUser(supabaseAdmin, userId);
  if (!studentId) {
    return { synced: false };
  }

  const subscription = await getUcatSubscriptionForStudent(
    supabaseAdmin,
    studentId,
  );
  if (!subscription) {
    return { synced: false };
  }

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
      return { synced: false };
    }

    return {
      synced: true,
      ...cancelFields,
      ...periodFields,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[ucat subscription sync] Stripe error:", msg);
    return { synced: false };
  }
}
