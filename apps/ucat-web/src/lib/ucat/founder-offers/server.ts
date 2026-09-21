import "server-only";
import Stripe from "stripe";
import { normalizeUcatInvitationCode, type Tables } from "@altitutor/shared";
import { supabaseAdmin } from "@/lib/supabase/admin";

export type FounderOffer = Tables<"ucat_founder_offers">;
export type FounderRedemption = Tables<"ucat_founder_redemptions">;

export async function findFounderOffer(
  rawCode: unknown,
): Promise<FounderOffer | null> {
  const code = normalizeUcatInvitationCode(rawCode);
  if (!code || !supabaseAdmin) return null;
  const { data, error } = await supabaseAdmin
    .from("ucat_founder_offers")
    .select("*")
    .eq("code", code)
    .maybeSingle();
  if (error)
    throw new Error("Could not load this invitation. Please try again.");
  return data;
}

export async function founderHistory(studentId: string) {
  if (!supabaseAdmin) throw new Error("Server not configured");
  const { data, error } = await supabaseAdmin
    .from("ucat_founder_redemptions")
    .select("*, ucat_founder_offers(*)")
    .eq("student_id", studentId)
    .in("status", ["reserved", "redeemed"]);
  if (error) throw new Error("Could not confirm invitation eligibility.");
  return data ?? [];
}

export async function claimFounderOffer(
  studentId: string,
  code: string,
  interval?: string,
): Promise<FounderRedemption> {
  if (!supabaseAdmin) throw new Error("Server not configured");
  const { data, error } = await supabaseAdmin.rpc("claim_ucat_founder_offer", {
    p_student_id: studentId,
    p_code: code,
    p_billing_interval: interval,
  });
  if (error || !data)
    throw new Error(error?.message ?? "Could not redeem this invitation.");
  return data;
}

/** Fixed ID plus idempotency makes parallel first redemptions share one coupon. */
export async function founderCoupon(
  stripe: Stripe,
  offer: FounderOffer,
): Promise<Stripe.Coupon> {
  if (offer.kind !== "discount" || !offer.percent_off)
    throw new Error("This code grants free access; redeem it before checkout.");
  const id = `ucat-founder-${offer.id}`;
  try {
    return await stripe.coupons.retrieve(id);
  } catch (error) {
    if (
      !(error instanceof Stripe.errors.StripeInvalidRequestError) ||
      error.code !== "resource_missing"
    )
      throw error;
  }
  try {
    return await stripe.coupons.create(
      {
        id,
        name: `${offer.percent_off}% founding-member discount`,
        percent_off: offer.percent_off,
        duration: "forever",
        metadata: { ucat_offer_id: offer.id, ucat_campaign: offer.campaign },
      },
      { idempotencyKey: id },
    );
  } catch (error) {
    if (
      error instanceof Stripe.errors.StripeInvalidRequestError &&
      error.code === "resource_already_exists"
    )
      return stripe.coupons.retrieve(id);
    throw error;
  }
}

/** Only release after Stripe confirms the old session cannot complete. */
export async function cancelFounderCheckout(
  stripe: Stripe,
  claim: FounderRedemption,
): Promise<void> {
  if (!supabaseAdmin || claim.status !== "reserved") return;
  if (!claim.checkout_session_id)
    throw new Error(
      "Your checkout is still being prepared. Retry the same offer shortly.",
    );
  const session = await stripe.checkout.sessions.retrieve(
    claim.checkout_session_id,
  );
  if (session.status === "complete")
    throw new Error("Your purchase is being confirmed. Please wait a moment.");
  if (session.status === "open")
    await stripe.checkout.sessions.expire(session.id);
  const { error } = await supabaseAdmin
    .from("ucat_founder_redemptions")
    .update({ status: "expired" })
    .eq("id", claim.id)
    .eq("status", "reserved");
  if (error) throw error;
}
