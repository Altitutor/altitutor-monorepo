import type { User } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getUcatSubjectId } from "@/lib/ucat/ucat-subject-id";

const REFERRAL_CODE_PATTERN = /^[A-Z0-9]{8,16}$/;

export type UcatReferralOfferPreview = {
  referrerName: string;
  duration: "week" | "month";
};

export async function resolveUcatReferralOfferPreview(
  referralCode: string | null,
): Promise<UcatReferralOfferPreview | null> {
  if (!supabaseAdmin || !referralCode) return null;

  const { data: codeRow, error: codeError } = await supabaseAdmin
    .from("ucat_referral_codes")
    .select("student_id")
    .eq("code", referralCode)
    .maybeSingle();
  if (codeError || !codeRow) return null;

  const [studentResult, ucatSubjectId] = await Promise.all([
    supabaseAdmin
      .from("students")
      .select("first_name")
      .eq("id", codeRow.student_id)
      .maybeSingle(),
    getUcatSubjectId(supabaseAdmin),
  ]);
  if (studentResult.error || !studentResult.data) return null;

  let duration: UcatReferralOfferPreview["duration"] = "week";
  if (ucatSubjectId) {
    const { data: subscription } = await supabaseAdmin
      .from("student_subscriptions")
      .select("billing_interval")
      .eq("student_id", codeRow.student_id)
      .eq("subject_id", ucatSubjectId)
      .in("status", ["active", "past_due"])
      .limit(1)
      .maybeSingle();
    if (
      subscription?.billing_interval === "month" ||
      subscription?.billing_interval === "year"
    ) {
      duration = "month";
    }
  }

  return {
    referrerName: studentResult.data.first_name.trim() || "A friend",
    duration,
  };
}

export function pendingReferralCodeFromUser(user: User): string | null {
  const raw = user.user_metadata?.pending_referral_code;
  if (typeof raw !== "string") return null;
  const code = raw.trim().toUpperCase();
  return REFERRAL_CODE_PATTERN.test(code) ? code : null;
}

export async function captureUcatReferral(
  referredStudentId: string,
  referralCode: string | null,
): Promise<void> {
  if (!supabaseAdmin || !referralCode) return;

  const { data: existingSubscription } = await supabaseAdmin
    .from("student_subscriptions")
    .select("id")
    .eq("student_id", referredStudentId)
    .in("status", ["trialing", "active", "past_due"])
    .limit(1)
    .maybeSingle();
  if (existingSubscription) return;

  const { data: codeRow, error: codeError } = await supabaseAdmin
    .from("ucat_referral_codes")
    .select("id, student_id")
    .eq("code", referralCode)
    .maybeSingle();

  if (codeError) {
    console.warn("[ucat referral] Failed to resolve referral code", codeError);
    return;
  }
  if (!codeRow || codeRow.student_id === referredStudentId) return;

  const { error } = await supabaseAdmin.from("ucat_referrals").insert({
    referral_code_id: codeRow.id,
    referrer_student_id: codeRow.student_id,
    referred_student_id: referredStudentId,
    // The insert trigger replaces this with its authoritative seven-day value.
    gift_expires_at: new Date(Date.now() + 7 * 86_400_000).toISOString(),
  });

  // A student can be attributed once. Replaying signup completion is harmless.
  if (error && error.code !== "23505") {
    console.warn("[ucat referral] Failed to capture attribution", error);
  }
}
