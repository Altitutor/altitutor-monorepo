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
    .insert({ student_id: studentId });
  if (insertError && insertError.code !== "23505") {
    console.error("[ucat referrals] Failed to create share code", insertError);
    return NextResponse.json(
      { error: "Failed to create referral link" },
      { status: 500 },
    );
  }

  const [{ data: codeRow }, { data: referrals }, { data: rewards }] =
    await Promise.all([
      supabaseAdmin
        .from("ucat_referral_codes")
        .select("code")
        .eq("student_id", studentId)
        .single(),
      supabaseAdmin
        .from("ucat_referrals")
        .select("free_qualified_at, paid_qualified_at, rejected_at")
        .eq("referrer_student_id", studentId),
      supabaseAdmin
        .from("ucat_referral_bill_rewards")
        .select("status")
        .eq("student_id", studentId),
    ]);

  if (!codeRow?.code) {
    return NextResponse.json(
      { error: "Failed to load referral link" },
      { status: 500 },
    );
  }

  const validReferrals = (referrals ?? []).filter((row) => !row.rejected_at);
  return NextResponse.json({
    code: codeRow.code,
    stats: {
      signups: validReferrals.length,
      freeQualified: validReferrals.filter((row) => row.free_qualified_at)
        .length,
      paidQualified: validReferrals.filter((row) => row.paid_qualified_at)
        .length,
      queuedFreeBills: (rewards ?? []).filter(
        (row) => row.status === "queued" || row.status === "applied",
      ).length,
      redeemedFreeBills: (rewards ?? []).filter(
        (row) => row.status === "redeemed",
      ).length,
    },
  });
}
