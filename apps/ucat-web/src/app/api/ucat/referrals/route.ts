import { captureApiError } from "@/lib/sentry/capture-api-error";
import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getStudentIdForUser } from "@/lib/ucat/ucat-subscription";

export async function GET() {
  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: "Server not configured" },
      { status: 500 },
    );
  }

  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const studentId = await getStudentIdForUser(supabaseAdmin, user.id);
  if (!studentId) {
    return NextResponse.json(
      { error: "Student profile not found" },
      { status: 404 },
    );
  }

  const { error: insertError } = await supabaseAdmin
    .from("ucat_referral_codes")
    .upsert(
      { student_id: studentId },
      { onConflict: "student_id", ignoreDuplicates: true },
    );
  if (insertError) {
    console.error("[ucat referrals] Failed to create share code", insertError);
    captureApiError(insertError, "/api/ucat/referrals");
    return NextResponse.json(
      { error: "Failed to create referral link" },
      { status: 500 },
    );
  }

  const [
    { data: codeRow },
    { data: referrals },
    { data: billRewards },
    { data: accessGifts },
  ] =
    await Promise.all([
      supabaseAdmin
        .from("ucat_referral_codes")
        .select("code")
        .eq("student_id", studentId)
        .single(),
      supabaseAdmin
        .from("ucat_referrals")
        .select("gift_status")
        .eq("referrer_student_id", studentId),
      supabaseAdmin
        .from("ucat_referral_bill_rewards")
        .select("status, reward_type")
        .eq("student_id", studentId),
      supabaseAdmin
        .from("ucat_referral_access_gifts")
        .select("status")
        .eq("student_id", studentId),
    ]);

  if (!codeRow?.code) {
    return NextResponse.json(
      { error: "Failed to load referral link" },
      { status: 500 },
    );
  }

  const activeBillRewards = (billRewards ?? []).filter(
    (row) => row.status === "queued" || row.status === "applied",
  );

  return NextResponse.json({
    code: codeRow.code,
    stats: {
      friendsJoined: referrals?.length ?? 0,
      giftsAccepted: (referrals ?? []).filter(
        (row) => row.gift_status === "accepted",
      ).length,
      giftsPending: (referrals ?? []).filter(
        (row) =>
          row.gift_status === "pending" ||
          row.gift_status === "checkout_pending",
      ).length,
      availableFreePeriods: (accessGifts ?? []).filter(
        (row) => row.status === "available" || row.status === "checkout_pending",
      ).length,
      usedFreePeriods: (accessGifts ?? []).filter(
        (row) => row.status === "used",
      ).length,
      queuedFreeBills: activeBillRewards.length,
      redeemedFreeBills: (billRewards ?? []).filter(
        (row) => row.status === "redeemed",
      ).length,
      nextBillFreeFromReferral: activeBillRewards.some(
        (row) => row.reward_type !== "fixed_credit",
      ),
    },
  });
}
