import type { User } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase/admin";

const REFERRAL_CODE_PATTERN = /^[A-Z0-9]{8,16}$/;

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
  });

  // A student can be attributed once. Replaying signup completion is harmless.
  if (error && error.code !== "23505") {
    console.warn("[ucat referral] Failed to capture attribution", error);
  }
}
