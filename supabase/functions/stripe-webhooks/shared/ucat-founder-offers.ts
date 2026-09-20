import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import type Stripe from "npm:stripe@16.6.0";

/** Metadata survives a crash between Stripe creation and persisting its session ID. */
export async function releaseUcatCheckoutHold(
  supabase: SupabaseClient,
  session: {
    id: string;
    metadata?: { ucat_checkout_hold_id?: string; student_id?: string } | null;
  },
): Promise<void> {
  let deletion = supabase.from("ucat_checkout_holds").delete();
  const metadata = session.metadata;
  deletion = metadata?.ucat_checkout_hold_id && metadata.student_id
    ? deletion.eq("id", metadata.ucat_checkout_hold_id).eq(
      "student_id",
      metadata.student_id,
    )
    : deletion.eq("checkout_session_id", session.id);
  const { error } = await deletion;
  if (error) throw error;
}

/** Stripe is authoritative for completion; expired reservations never grant access. */
export async function settleFounderCheckout(
  supabase: SupabaseClient,
  input: {
    redemptionId: string;
    studentId: string;
    sessionId: string;
    subscriptionId?: string;
    expired?: boolean;
    occurredAt: string;
  },
): Promise<void> {
  const { data: claim, error } = await supabase.from("ucat_founder_redemptions")
    .select("id, student_id, checkout_session_id, status").eq(
      "id",
      input.redemptionId,
    ).single();
  if (error) throw error;
  if (
    claim.student_id !== input.studentId ||
    (claim.checkout_session_id && claim.checkout_session_id !== input.sessionId)
  ) {
    throw new Error("Founder checkout does not match its reservation.");
  }
  if (input.expired && claim.status !== "reserved") return;
  let update = supabase.from("ucat_founder_redemptions").update(
    input.expired
      ? {
        status: "expired",
        checkout_session_id: input.sessionId,
      }
      : {
        status: "redeemed",
        checkout_session_id: input.sessionId,
        stripe_subscription_id: input.subscriptionId,
        redeemed_at: input.occurredAt,
      },
  ).eq("id", claim.id);
  if (input.expired) update = update.eq("status", "reserved");
  const { error: updateError } = await update;
  if (updateError) throw updateError;
}

/** Invoice events may precede checkout completion; attach attribution from Stripe. */
export async function founderSubscriptionProperties(
  stripe: Stripe,
  subscriptionId: string,
): Promise<Record<string, string | null>> {
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const metadata = subscription.metadata;
  return metadata.ucat_founder_offer_id
    ? {
      founder_discount_offer_id: metadata.ucat_founder_offer_id,
      founder_discount_code: metadata.ucat_founder_code ?? null,
      founder_discount_campaign: metadata.ucat_founder_campaign ?? null,
    }
    : {};
}
