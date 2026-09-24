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
    trialEndsAt?: string;
    expired?: boolean;
    occurredAt: string;
  },
): Promise<void> {
  const { data: claim, error } = await supabase.from("ucat_founder_redemptions")
    .select("id, student_id, checkout_session_id, status, kind").eq(
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
  if (!input.expired && claim.kind === "access_pass" && (!input.subscriptionId || !input.trialEndsAt || Date.parse(input.trialEndsAt) <= Date.parse(input.occurredAt))) {
    throw new Error("Founder free period is missing its confirmed Stripe trial end.");
  }
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
        ...(claim.kind === "access_pass" ? { access_ends_at: input.trialEndsAt } : {}),
      },
  ).eq("id", claim.id);
  if (input.expired) update = update.eq("status", "reserved");
  const { error: updateError } = await update;
  if (updateError) throw updateError;
  if (!input.expired && claim.kind === "access_pass") {
    const { error: consumedError } = await supabase.from("students")
      .update({ ucat_unlimited_trial_consumed_at: input.occurredAt })
      .eq("id", input.studentId).is("ucat_unlimited_trial_consumed_at", null);
    if (consumedError) throw consumedError;
  }
}

/** Invoice events may precede checkout completion; attach attribution from Stripe. */
export async function founderSubscriptionProperties(
  stripe: Stripe,
  subscriptionId: string,
): Promise<Record<string, string | null>> {
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const metadata = subscription.metadata;
  const prefix = metadata.ucat_founder_kind === "access_pass" ? "founder_access" : "founder_discount";
  return metadata.ucat_founder_offer_id
    ? {
      [`${prefix}_offer_id`]: metadata.ucat_founder_offer_id,
      [`${prefix}_code`]: metadata.ucat_founder_code ?? null,
      [`${prefix}_campaign`]: metadata.ucat_founder_campaign ?? null,
    }
    : {};
}
