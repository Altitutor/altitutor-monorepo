import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

/** Late expiry events must never reset a completed gift or a replacement session. */
export async function releaseExpiredReferralCheckout(
  supabase: SupabaseClient,
  session: { id: string; metadata?: Record<string, string> | null },
): Promise<void> {
  const studentId = session.metadata?.student_id;
  const giftId = session.metadata?.ucat_referral_gift_id;
  if (!studentId || !giftId) return;
  const earned =
    session.metadata?.ucat_referral_gift_kind === "earned_referrer";
  const { error } = earned
    ? await supabase.from("ucat_referral_access_gifts")
      .update({ status: "available", stripe_checkout_session_id: null })
      .eq("id", giftId).eq("student_id", studentId)
      .eq("stripe_checkout_session_id", session.id).eq(
        "status",
        "checkout_pending",
      )
    : await supabase.from("ucat_referrals")
      .update({ gift_status: "pending", referred_checkout_session_id: null })
      .eq("id", giftId).eq("referred_student_id", studentId)
      .eq("referred_checkout_session_id", session.id).eq(
        "gift_status",
        "checkout_pending",
      );
  if (error) throw error;
}
